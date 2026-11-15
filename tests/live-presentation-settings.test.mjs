import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
const sectionId='b7bd6b13-c654-412b-badb-12853350e148';

test('only an administrator can persist Live settings for an existing JavaScript section',async()=>{
 let actor={isAdmin:true};const metadata={summary:'Course',sectionLive:{other:false}};
 const catalog={folderGroups:[],courses:[{id:'course',metadata,status:'active'}],sections:[{id:sectionId,course_id:'course',content_type:'tsx',status:'active'}]};
 const route=loadTS('app/api/admin/access/route.ts',{
  'next/server':{NextResponse:Response},'next/cache':{revalidatePath(){}},'@/lib/auth/currentUser':{requireCourseManager:async()=>actor},
  '@/lib/auth/types':{},'@/lib/auth/passcodes':{},'@/lib/learningIdentity':{},'@/lib/supabase/server':{getSupabaseAdmin:()=>({})},
  '@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>catalog,updateCourseMetadata:async(id,update)=>{assert.equal(id,'course');Object.assign(metadata,update(metadata));}},
 });
 const save=body=>route.POST(new Request('http://localhost/api/admin/access',{method:'POST',body:JSON.stringify({action:'set_section_live',sectionId,...body})}));
 actor={isAdmin:false};assert.equal((await save({enabled:false})).status,403);actor={isAdmin:true};
 assert.equal((await save({sectionId:'missing',enabled:false})).status,404);
 assert.equal((await save({enabled:'false'})).status,400);
 const users=loadTS('lib/auth/currentUser.ts',{'./session':{},'./passcodes':{},'./types':{FIXED_ADMIN_EMAIL:'admin@example.test'},'@/lib/supabase/server':{},'./courseAccessStorage':{getCoursesAndSectionsData:async()=>catalog}});
 assert.equal((await users.currentUserAccess(undefined,{role:'admin'})).sections[0].liveEnabled,true,'existing sections preserve Live until explicitly disabled');
 assert.equal((await save({enabled:false})).status,200);assert.equal(metadata.sectionLive[sectionId],false);assert.equal(metadata.sectionLive.other,false);
 assert.equal((await users.currentUserAccess(undefined,{role:'admin'})).sections[0].liveEnabled,false);
 assert.equal((await save({enabled:true})).status,200);assert.equal((await users.currentUserAccess(undefined,{role:'admin'})).sections[0].liveEnabled,true);
 catalog.sections[0].content_type='pdf';assert.equal((await save({enabled:true})).status,400);
});

test('Live feature flags survive course metadata serialization and ignore malformed values',()=>{
 const storage=loadTS('lib/auth/courseAccessStorage.ts',{'@/lib/learningIdentity':{parseIdentityPolicy:()=>({enabled:false,fields:[]})},'@/lib/supabase/server':{},'@/lib/auth/types':{FIXED_ADMIN_EMAIL:'admin@example.test',normalizeEmail:value=>value,isValidEmail:()=>true}});
 const first=storage.parseCourseMetadata(JSON.stringify({summary:'Course',sectionLive:{one:false,two:true,bad:'false'},passcode:'1234'}));
 const saved=JSON.parse(storage.serializeCourseMetadata(first));assert.deepEqual(saved.sectionLive,{one:false,two:true});assert.equal(saved.passcode,'1234');
 assert.equal(storage.parseCourseMetadata(JSON.stringify(saved)).sectionLive.one,false);
});

test('Supabase transport blocks disabled Live but still lets an admin release the previous lease',async()=>{
 let writes=0;const row={status:'active',content_type:'tsx',courses:{description:JSON.stringify({sectionLive:{[sectionId]:false}})}};
 const route=loadTS('app/api/admin/live/route.ts',{'@/lib/auth/currentUser':{requireAdminAccess:async()=>({})},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:row})})})})})},'@/lib/livePresentationState':{saveLiveState:async()=>{writes++;return null;}}});
 assert.equal((await route.GET(new Request(`http://localhost/api/admin/live?sectionId=${sectionId}`))).status,403);
 const command=action=>route.POST(new Request('http://localhost/api/admin/live',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({sectionId,action,deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'})}));
 assert.equal((await command('start')).status,403);assert.equal(writes,0);
 assert.equal((await command('stop')).status,200);assert.equal(writes,1);
});
