import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
function fixture(){
 let admin=true,fail=false,conflict=false;const writes=[];
 const metadata={summary:'Original summary',passcode:'retained',sectionTemplates:{lesson:'eiu-business-v1'},folderGroupId:'folder',folderGroupName:'Original folder',folderGroups:[{id:'folder',name:'Original folder',description:'Folder description',order:1}],sectionWheel:{section:true}};
 const tables={courses:[{id:'course',slug:'applied-agentic-ai',title:'Original course',description:JSON.stringify(metadata),status:'active',language_label:'en'}],course_sections:[{id:'section',course_id:'course',section_key:'lesson',title:'Original section',status:'active',position:1,content_type:'tsx',content_path:'local:lesson.js'}]};
 const db={from(table){const filters=[];let patch;const q={select(){return this;},eq(key,value){filters.push(row=>row[key]===value);return this;},is(key,value){return this.eq(key,value);},neq(key,value){filters.push(row=>row[key]!==value);return this;},order(){return this;},update(value){patch=value;return this;},async single(){const result=await q;return {...result,data:result.data?.[0]};},async maybeSingle(){return q.single();},then(resolve){const selected=tables[table].filter(row=>filters.every(filter=>filter(row)));if(patch){writes.push({table,patch});if(fail)return Promise.resolve({error:Error('database failed')}).then(resolve);if(conflict)return Promise.resolve({data:[],error:null}).then(resolve);selected.forEach(row=>Object.assign(row,patch));}return Promise.resolve({data:selected,error:null}).then(resolve);}};return q;}};
 const storage=loadTS('lib/auth/courseAccessStorage.ts',{'@/lib/supabase/server':{getSupabaseAdmin:()=>db},'@/lib/learningIdentity':{parseIdentityPolicy:value=>value||{enabled:false,fields:[]}},'@/lib/auth/types':{FIXED_ADMIN_EMAIL:'admin@test',APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai',normalizeEmail:value=>value.toLowerCase(),isValidEmail:()=>true}});
 const route=loadTS('app/api/admin/catalog/route.ts',{'next/cache':{revalidatePath(){}},'@/lib/auth/currentUser':{currentUserAccess:async()=>({isActive:true,isAdmin:admin})},'@/lib/supabase/server':{getSupabaseAdmin:()=>db},'@/lib/auth/courseAccessStorage':storage});
 return {tables,writes,storage,admin:value=>{admin=value;},fail:()=>{fail=true;},conflict:()=>{conflict=true;},save:(body,headers={})=>route.PATCH(new Request('http://localhost/api/admin/catalog',{method:'PATCH',headers,body:JSON.stringify(body)}))};
}
test('only actual Admin can edit catalog items, including direct requests',async()=>{
 const f=fixture(),body={kind:'course',id:'course',title:'Changed',description:'Updated'};
 f.admin(false);assert.equal((await f.save(body)).status,403);f.admin(true);assert.equal((await f.save(body,{origin:'https://other.test'})).status,403);assert.equal(f.writes.length,0);
 for(const change of [{title:''},{title:'x'.repeat(121)},{description:'x'.repeat(4001)},{kind:'unknown'},{id:'missing'}])assert.ok((await f.save({...body,...change})).status>=400);assert.equal(f.writes.length,0);
});
test('course name and summary save together and preserve access, template, wheel and identity keys',async()=>{
 const f=fixture(),before={...f.tables.courses[0]};assert.equal((await f.save({kind:'course',id:'course',title:' New course ',description:' New summary '})).status,200);
 const course=f.tables.courses[0],meta=JSON.parse(course.description);assert.equal(course.title,'New course');assert.equal(meta.summary,'New summary');assert.equal(meta.passcode,'retained');assert.equal(meta.sectionTemplates.lesson,'eiu-business-v1');assert.equal(meta.sectionWheel.section,true);assert.equal(course.slug,before.slug);assert.equal(course.id,before.id);assert.equal(f.writes.length,1);
});
test('section title and description survive reload and unrelated metadata edits with stable section IDs and content',async()=>{
 const f=fixture();assert.equal((await f.save({kind:'section',id:'section',title:'New section',description:'New description'})).status,200);
 await f.storage.updateCourseSummary('course','Unrelated summary');const catalog=await f.storage.getCoursesAndSectionsData();assert.equal(catalog.sections[0].title,'New section');assert.equal(catalog.sections[0].description,'New description');assert.equal(catalog.sections[0].section_key,'lesson');assert.equal(catalog.sections[0].content_path,'local:lesson.js');
 assert.equal((await f.save({kind:'section',id:'section',title:'New section',description:''})).status,200);assert.equal((await f.storage.getCoursesAndSectionsData()).sections[0].description,'');
 const hierarchy=loadTS('lib/courseHierarchy.ts').courseHierarchy(f.tables.courses),scope=loadTS('lib/reportScopes.ts').reportScope({courseId:'course',sectionId:'section'},hierarchy.courses,f.tables.course_sections);assert.equal(scope.sectionTitle,'New section','report selectors and filenames use the renamed section');
});
test('folder edit updates its master record and child names while preserving permissions',async()=>{
 const f=fixture();assert.equal((await f.save({kind:'folder',id:'folder',title:'New folder',description:'New folder description'})).status,200);const catalog=await f.storage.getCoursesAndSectionsData();assert.equal(catalog.folderGroups[0].name,'New folder');assert.equal(catalog.folderGroups[0].description,'New folder description');assert.equal(catalog.courses[0].folderGroupName,'New folder');assert.equal(catalog.courses[0].metadata.passcode,'retained');
});
test('failed or conflicting writes never report successful edits',async()=>{
 for(const mode of ['fail','conflict']){const f=fixture();f[mode]();const response=await f.save({kind:'course',id:'course',title:'Changed',description:'Updated'});assert.equal(response.status,mode==='fail'?500:409);assert.equal(f.tables.courses[0].title,'Original course');}
});
