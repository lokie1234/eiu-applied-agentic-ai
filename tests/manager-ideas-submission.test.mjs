import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const section='98694749-2879-46e2-82bd-03fd27f23c5e',course='500c7192-961d-4e41-9917-9b9f85f0b667';
function fixture({teacher=false,admin=false,allowed=true,fail=false,terminated=false}={}){
 const rows=[],state={signals:0,writes:0},identity={sessionId:'signed-session',name:'Manager',email:null,information:{department:'Operations'}};
 const access={isActive:true,isAdmin:admin,learnerIdentity:identity,courses:[{id:course,title:'Applied Agentic AI'}],sections:[{id:section,courseId:course,sectionKey:'manager-section1',title:'Section 1',canFacilitate:teacher}]};
 const db={from(table){assert.equal(table,'access_audit_logs');let selected=rows,deleting=false;const q={select(){return q;},eq(key,value){selected=selected.filter(r=>key==='id'?String(r[key])===String(value):r[key]===value);return q;},contains(key,values){selected=selected.filter(r=>Object.entries(values).every(([k,v])=>r[key][k]===v));return q;},gt(key,value){selected=selected.filter(r=>r[key]>value);return q;},order(){return q;},limit(){return q;},delete(){deleting=true;return q;},maybeSingle:async()=>{if(fail)return{error:Error('storage failed')};const data=selected[0]||null;if(deleting&&data){rows.splice(rows.indexOf(data),1);state.writes++;}return{data};},insert(row){state.writes++;if(!fail)rows.push({...row,id:rows.length+1,created_at:'2026-11-28T06:00:00Z'});return q;},then(resolve){resolve(fail?{error:Error('storage failed')}:{data:selected});}};return q;}};
 const deps={'next/server':{NextResponse:Response},'@/lib/auth/currentUser':{currentUserAccess:async()=>access},'@/lib/supabase/server':{getSupabaseAdmin:()=>db},'@/lib/sectionTermination':{readSectionTermination:async()=>terminated?{id:1}:null},'@/lib/security/rateLimit':{consumeRateLimit:async()=>({allowed,retry_after:60})},'@/lib/realtime/publish':{notifyRealtime(){assert.ok(state.writes);state.signals++;}},'@/lib/showcaseImage':{readShowcaseBytes:async request=>Buffer.from(await request.arrayBuffer()),ShowcaseInputError:class extends Error{}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/sections/[id]/ideas/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>deps[name],URL,console:{error(){}},Buffer});
 const context={params:Promise.resolve({id:section})},request=(body,origin='https://lesson.test')=>new Request(`https://lesson.test/api/sections/${section}/ideas`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 return {api:exports,context,request,rows,state,access};
}
test('ideas bind signed identity and actual scope, store once, then signal; manager teacher board is private',async()=>{
 const f=fixture();const result=await f.api.POST(f.request({idea:'  Reduce approval time  ',name:'Fake',sectionId:'other',courseId:'other'}),f.context);assert.equal(result.status,200);assert.equal(f.rows.length,1);assert.equal(f.state.signals,1);const saved=f.rows[0];assert.equal(saved.course_id,course);assert.equal(saved.details.sectionId,section);assert.equal(saved.details.sessionId,'signed-session');assert.equal(saved.details.name,'Manager');assert.equal(saved.details.email,null);assert.equal(saved.details.idea,'Reduce approval time');assert.equal(saved.details.submissionStorage,'audit');
 assert.equal((await f.api.GET(f.request({}),f.context)).status,403);f.access.sections[0].canFacilitate=true;
 f.rows.push({...saved,id:2,details:{...saved.details,sectionId:'foreign'}});
 const list=await(await f.api.GET(f.request({}),f.context)).json();assert.equal(list.items.length,1);assert.deepEqual(Object.keys(list.items[0]).sort(),['id','idea','name','submittedAt']);
 assert.equal((await f.api.POST(f.request({idea:'Teacher cannot submit'}),f.context)).status,403);
});
test('ideas reject foreign access/origin, whitespace, over-limit text and throttling without writes or signals',async()=>{
 const f=fixture();for(const idea of ['', '   ','x'.repeat(501),123])assert.equal((await f.api.POST(f.request({idea}),f.context)).status,400);
 assert.equal((await f.api.POST(f.request({idea:'valid'},'https://evil.test'),f.context)).status,403);
 assert.equal((await f.api.POST(f.request({idea:'valid'}),{params:Promise.resolve({id:'foreign'})})).status,403);
 assert.equal(f.rows.length,0);assert.equal(f.state.signals,0);
 const throttled=fixture({allowed:false});assert.equal((await throttled.api.POST(throttled.request({idea:'valid'}),throttled.context)).status,429);assert.equal(throttled.rows.length,0);
 const failed=fixture({fail:true});assert.equal((await failed.api.POST(failed.request({idea:'valid'}),failed.context)).status,500);assert.equal(failed.state.signals,0);
});
test('termination hides earlier board records without deleting report history',async()=>{const f=fixture({terminated:true});await f.api.POST(f.request({idea:'Saved before termination'}),f.context);f.access.sections[0].canFacilitate=true;const list=await(await f.api.GET(f.request({}),f.context)).json();assert.equal(list.items.length,0);assert.equal(f.rows.length,1);});

test('only a real administrator permanently deletes exactly the selected scoped idea, then publishes the revision',async()=>{
 const f=fixture();await f.api.POST(f.request({idea:'Remove this idea'}),f.context);const own=f.rows[0];
 f.rows.push({...own,id:2,details:{...own.details,sectionId:'foreign'}},{...own,id:3,action:'SHOWCASE_SUBMITTED'},{...own,id:4,details:{...own.details,submissionStorage:'other'}});
 const request=(id,origin)=>new Request(f.request({}).url,{method:'DELETE',headers:{origin:origin||'https://lesson.test'},body:JSON.stringify({id})});
 assert.equal((await f.api.DELETE(request('1'),f.context)).status,403);f.access.sections[0].canFacilitate=true;assert.equal((await f.api.DELETE(request('1'),f.context)).status,403);
 const teacher=await(await f.api.GET(f.request({}),f.context)).json();assert.equal(teacher.canDelete,false);assert.equal(teacher.items[0].name,'Manager');
 f.access.isAdmin=true;assert.equal((await(await f.api.GET(f.request({}),f.context)).json()).canDelete,true);
 assert.equal((await f.api.DELETE(request('1','https://evil.test'),f.context)).status,403);
 for(const id of ['2','3','4','999'])assert.equal((await f.api.DELETE(request(id),f.context)).status,404);
 assert.equal((await f.api.DELETE(request('1'),{params:Promise.resolve({id:'foreign'})})).status,403);
 for(const id of ['', '0','-1','1 OR 1=1',1])assert.equal((await f.api.DELETE(request(id),f.context)).status,400);
 const removed=await f.api.DELETE(request('1'),f.context);assert.equal(removed.status,200);assert.equal((await removed.json()).deletedId,'1');assert.deepEqual(f.rows.map(r=>r.id),[2,3,4]);assert.equal(f.state.signals,2);
 assert.equal((await f.api.DELETE(request('1'),f.context)).status,404);
});

test('a failed or rate-limited delete never acknowledges success or notifies realtime',async()=>{
 for(const options of [{fail:true},{allowed:false}]){const f=fixture({admin:true,...options});f.rows.push({id:1,action:'IDEA_SUBMITTED',course_id:course,details:{courseId:course,sectionId:section,submissionStorage:'audit'}});const response=await f.api.DELETE(new Request(f.request({}).url,{method:'DELETE',body:JSON.stringify({id:'1'})}),f.context);assert.equal(response.status,options.fail?500:429);assert.equal(f.rows.length,1);assert.equal(f.state.signals,0);}
});
