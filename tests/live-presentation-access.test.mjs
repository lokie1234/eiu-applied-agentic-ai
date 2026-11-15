import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTS} from './helpers/mis301-fixture.mjs';
const root='http://localhost:3000';
test('Live route denies non-admins and cross-origin commands before touching private storage',async()=>{
 let reads=0,admin=false;const route=loadTS('app/api/admin/live/route.ts',{'@/lib/auth/currentUser':{requireAdminAccess:async()=>admin?{}:null},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:'active',content_type:'tsx',courses:{description:'{}'}}})})})})})},'@/lib/livePresentationBackup':{liveBackup:async()=>{reads++;return null;}}});
 let response=await route.GET(new Request(root+'/api/admin/live?sectionId=b7bd6b13-c654-412b-badb-12853350e148'));assert.equal(response.status,403);assert.equal(reads,0);admin=true;
 response=await route.POST(new Request(root+'/api/admin/live',{method:'POST',headers:{origin:'https://foreign.test'},body:'{}'}));assert.equal(response.status,403);assert.equal(reads,0);
 response=await route.GET(new Request(root+'/api/admin/live?sectionId=b7bd6b13-c654-412b-badb-12853350e148'));assert.equal(response.status,200);assert.equal(reads,1);
});
test('Live is rendered only under the actual admin view, independent of teaching privileges',()=>{
 const source=fs.readFileSync('components/LessonPortal.tsx','utf8');assert.match(source,/isAdmin && courseSection\.contentType === 'tsx' && courseSection.liveEnabled !== false && <LiveSectionControl/);assert.match(source,/const isAdmin = sessionIsAdmin && previewMode === null/);assert.match(source,/setLiveSelection\(null\)/);
});
