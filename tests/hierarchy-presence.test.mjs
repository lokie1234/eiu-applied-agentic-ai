import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import ExcelJS from "exceljs";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>deps[name]??(name.startsWith('@/lib/')?load(name.slice(2)+'.ts'):require(name)),URL,Response,Date,console,Buffer});return exports;}
const folders=[{id:'f-ai',name:'AI Training',order:1},{id:'f-web',name:'Web Training',order:2}];
const courses=[{id:'c-ai',slug:'applied-agentic-ai',title:'Applied AI',description:JSON.stringify({folderGroups:folders,folderGroupId:'f-ai'})},{id:'c-web',slug:'web-course',title:'Web Development',description:JSON.stringify({folderGroupId:'f-web'})}];
const sections=[{id:'s-ai',course_id:'c-ai',section_key:'section1',title:'AI 1'},{id:'s-web',course_id:'c-web',section_key:'web-one',title:'Web 1'},{id:'s-web2',course_id:'c-web',section_key:'web-two',title:'Web 2'}];
function user(session='learner-one') {return {isActive:true,isAdmin:false,authUserId:session,displayName:'Alice',email:'alice@example.test',learnerIdentity:{sessionId:session,name:'Alice',email:'alice@example.test',information:{department:'IT'}},courses:[{id:'c-web',title:'Web Development',slug:'web-course',folderGroupId:'f-web',folderGroupName:'Web Training'}],sections:sections.filter(s=>s.course_id==='c-web').map(s=>({id:s.id,courseId:s.course_id,sectionKey:s.section_key,title:s.title}))};}
function db(tables,stats={}){return {from(table){const filters=[];let limit=Infinity;const q={select(){return q;},in(k,values){filters.push(row=>values.includes(row[k]));return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},is(k,v){filters.push(row=>row[k]===v);return q;},gt(k,v){filters.push(row=>row[k]>v);return q;},gte(k,v){filters.push(row=>row[k]>=v);return q;},lte(k,v){filters.push(row=>row[k]<=v);return q;},contains(k,v){filters.push(row=>Object.entries(v).every(([key,value])=>row[k]?.[key]===value));return q;},order(){return q;},limit(n){limit=n;return q;},
      async maybeSingle(){stats.reads=(stats.reads||0)+1;return {data:(tables[table]||[]).find(row=>filters.every(f=>f(row)))||null};},
      async insert(row){stats.inserts=(stats.inserts||0)+1;(tables[table]||=[]).push({...row,id:tables[table].length+1,created_at:new Date().toISOString()});return {};},
      async upsert(row){stats.upserts=(stats.upserts||0)+1;const rows=tables[table]||=[];const old=rows.find(r=>r.client_id===row.client_id);if(old)Object.assign(old,row);else rows.push(row);return {};},
      update(values){return {eq:async(k,v)=>{for(const row of tables[table]||[])if(row[k]===v)Object.assign(row,values);return {};}};},
      async range(a,b){stats.ranges=(stats.ranges||0)+1;return {data:(tables[table]||[]).filter(row=>filters.every(f=>f(row))).slice(a,Math.min(b+1,limit))};},
    };return q;}};}
function endpoint(tables,readAccess,stats={}){return load('app/api/presence/route.ts',{'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200})}},'@/lib/auth/currentUser':{currentUserAccess:async()=>{stats.auth=(stats.auth||0)+1;return readAccess();}},'@/lib/currentRole':{},'@/lib/currentLearnerProfile':{},'@/lib/supabase/server':{getSupabaseAdmin:()=>db(tables,stats)}});}
const req=body=>new Request('http://localhost/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('every uploaded section logs real entry once, then heartbeats only upsert a server-scoped row',async()=>{
  const tables={},stats={},access=user();const route=endpoint(tables,()=>access,stats);
  const body={action:'enter',sectionId:'s-web',clientId:'browser-tab',entryId:'visit-one',name:'Fake',courseId:'c-ai'};
  assert.equal((await route.POST(req(body))).status,200);assert.equal(tables.access_audit_logs.length,1);
  const event=tables.access_audit_logs[0];assert.equal(event.action,'SECTION_OPENED');assert.equal(event.details.name,'Alice');assert.equal(event.details.sectionId,'s-web');assert.equal(event.details.courseId,'c-web');assert.equal(event.details.folderGroupId,'f-web');
  await route.POST(req(body));assert.equal(tables.access_audit_logs.length,1,'retried opens do not duplicate the log');
  const reads=stats.reads,inserts=stats.inserts,upserts=stats.upserts,auth=stats.auth;
  for(let i=0;i<5;i++)await route.POST(req({...body,action:'heartbeat'}));
  assert.equal(stats.reads,reads);assert.equal(stats.inserts,inserts);assert.equal(stats.upserts-upserts,5);assert.equal(stats.auth-auth,5);
  assert.ok(tables.presence_sessions[0].client_id.length<=120);
  assert.equal((await route.POST(req({...body,sectionId:'s-ai'}))).status,403);
  assert.equal((await endpoint(tables,()=>null).POST(req(body))).status,403);
  const teacher=user();teacher.sections[0].canFacilitate=true;
  assert.equal((await endpoint(tables,()=>teacher).POST(req(body))).data.tracked,false);
  assert.equal(tables.access_audit_logs.length,1);
});

test('one admin read aggregates folder/course/section, deduplicates tabs and excludes expired or left sessions',async()=>{
  const helpers=load('lib/scopedPresence.ts'),now=Date.now(),tables={presence_sessions:[]};
  const add=(scope,session,tab,extra={})=>tables.presence_sessions.push({client_id:helpers.scopedPresenceKey(scope,session,tab),section:'section1',left_at:null,last_seen_at:new Date(now).toISOString(),...extra});
  add('s-web','one','tab1');add('s-web','one','tab2');add('s-web2','one','tab1');add('s-web','two','tab');
  add('s-ai','old','tab',{last_seen_at:new Date(now-51_000).toISOString()});add('s-ai','left','tab',{left_at:new Date(now).toISOString()});
  const access={...user(),isAdmin:true,courses:load('lib/courseHierarchy.ts').courseHierarchy(courses).courses,sections:sections.map(s=>({id:s.id,courseId:s.course_id,sectionKey:s.section_key}))};
  const stats={},route=endpoint(tables,()=>access,stats),response=await route.GET(new Request('http://localhost/api/presence?scope=all'));
  assert.equal(response.status,200);assert.equal(response.data.counts.total,2);assert.equal(response.data.counts.bySection['s-web'],2);assert.equal(response.data.counts.bySection['s-web2'],1);assert.equal(response.data.counts.byCourse['c-web'],2);assert.equal(response.data.counts.byFolder['f-web'],2);assert.equal(stats.ranges,1);assert.equal(stats.inserts,undefined);assert.equal(stats.upserts,undefined);
  const restricted=user();restricted.sections[0].canFacilitate=true;
  const restrictedCounts=(await endpoint(tables,()=>restricted).GET(new Request('http://localhost/api/presence?scope=all'))).data.counts;
  assert.equal(restrictedCounts.bySection['s-web2'],undefined);assert.equal(restrictedCounts.bySection['s-web'],2);
  const learner=user('one');await endpoint(tables,()=>learner).POST(req({action:'leave',sectionId:'s-web',clientId:'tab1'}));
  assert.equal(tables.presence_sessions.filter(r=>r.left_at===null&&r.client_id.includes(':s-web:')).length,2,'leaving one tab does not remove another tab or learner');
  assert.equal((await endpoint(tables,()=>user()).GET(new Request('http://localhost/api/presence?scope=all'))).status,403);
});

test('new catalog entries automatically participate in scoped presence and exported folder metadata',async()=>{
  const access=user();access.courses.push({id:'new-course',title:'New Course',folderGroupId:'new-folder',folderGroupName:'New Folder'});access.sections.push({id:'new-section',courseId:'new-course',sectionKey:'future-any-key',title:'New Section'});
  const tables={},route=endpoint(tables,()=>access);
  assert.equal((await route.POST(req({action:'enter',sectionId:'new-section',clientId:'tab',entryId:'future-visit'}))).status,200);
  const admin={...access,isAdmin:true};const counts=(await endpoint(tables,()=>admin).GET(new Request('http://localhost/api/presence?scope=all'))).data.counts;
  assert.equal(counts.byFolder['new-folder'],1);assert.equal(counts.byCourse['new-course'],1);assert.equal(counts.bySection['new-section'],1);
  const {collectReportLearners}=load('lib/reportLearners.ts');
  const login={action:'PASSCODE_LOGIN',created_at:new Date().toISOString(),details:{...access.learnerIdentity,scopeMode:'access',scopes:[{section:'unopened'}]}};
  const learners=collectReportLearners([], [login,...tables.access_audit_logs], []);
  assert.equal(learners.length,1);assert.equal(learners[0].sectionId,'new-section');assert.equal(learners[0].folderGroupId,'new-folder');
});

test('folder export cascades through current catalog and excludes courses and sections outside the selected folder',async()=>{
  const extraCourses=[2,3].map(i=>({id:`c-extra${i}`,slug:`extra${i}`,title:`Extra ${i}`,folderGroupId:'f-web'}));
  const extraSections=[3,4].map(i=>({id:`s-web${i}`,course_id:'c-web',section_key:`web-${i}`,title:`Web ${i}`,position:i}));
  const tables={courses:[...courses,...extraCourses],course_sections:[...sections,...extraSections,...extraCourses.map(c=>({id:`s-${c.id}`,course_id:c.id,section_key:'first',title:'Section 1',position:1}))],section_state:[],access_audit_logs:[{action:'SECTION_OPENED',created_at:'2026-10-21T03:00:00Z',details:{...user().learnerIdentity,courseId:'c-web',sectionId:'s-web',section:'web-one'}}]};
  const report=load('app/api/admin/report/route.ts',{exceljs:{default:ExcelJS},'@/lib/currentRole':{currentRole:async()=>'admin'},'@/lib/supabase/server':{getSupabaseAdmin:()=>db(tables)}});
  const options=await(await report.GET(new Request('http://localhost/api/admin/report?mode=sections'))).json();assert.equal(options.folders.length,2);assert.equal(options.courses.find(c=>c.value==='c-web').folderGroupId,'f-web');assert.equal(options.courseSections.filter(s=>s.courseId==='c-web').length,4);assert.equal(options.courses.filter(c=>c.folderGroupId==='f-web').length,3);
  const response=await report.GET(new Request('http://localhost/api/admin/report?folderId=f-web&courseId=c-web&sectionId=all'));assert.equal(response.status,200);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const learner=book.worksheets.find(sheet=>sheet.name.endsWith('Hoc vien')&&sheet.getCell('A2').value==='Alice');assert.ok(learner);assert.ok(learner.getRow(2).values.includes('Web Training'));assert.ok(learner.getRow(2).values.includes('Web Development'));assert.ok(learner.getRow(2).values.includes('Web 1'));
  assert.equal((await report.GET(new Request('http://localhost/api/admin/report?folderId=f-ai&courseId=c-web'))).status,400);
  assert.equal((await report.GET(new Request('http://localhost/api/admin/report?folderId=f-web&sectionId=s-ai'))).status,400);
  assert.equal(book.worksheets.filter(sheet=>sheet.name.endsWith('Hoc vien')).length,4,'all four sections exported for selected course');
});


test('a slow entry-history lookup does not hold back live presence',async()=>{
  const tables={},base=db(tables);let releaseRead,started;
  const lookupStarted=new Promise(resolve=>started=resolve);
  const route=load('app/api/presence/route.ts',{'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200})}},'@/lib/auth/currentUser':{currentUserAccess:async()=>user()},'@/lib/currentRole':{},'@/lib/currentLearnerProfile':{},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from(table){const q=base.from(table);if(table==='access_audit_logs')q.maybeSingle=()=>{started();return new Promise(resolve=>releaseRead=resolve);};return q;}})}});
  const pending=route.POST(req({action:'enter',sectionId:'s-web',clientId:'tab',entryId:'visit'}));
  await lookupStarted;assert.equal(tables.presence_sessions.length,1);assert.equal(tables.access_audit_logs,undefined);
  releaseRead({data:null});assert.equal((await pending).status,200);assert.equal(tables.access_audit_logs.length,1);
});
