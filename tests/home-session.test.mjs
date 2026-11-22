import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
function fixture(access){
 let reads=0;const Landing=props=>props;
 const page=loadTS('app/page.tsx',{'@/components/LandingPage':{__esModule:true,default:Landing},'next/navigation':{redirect:location=>{throw {redirect:location};}},'@/lib/auth/currentUser':{currentUserAccess:async()=>{reads++;return access;}}}).default;
 return {page:query=>page({searchParams:Promise.resolve(query||{})}),reads:()=>reads,Landing};
}
test('opening the main link reuses active admin, teaching, learner and guest access',async()=>{
 for(const role of ['admin','teacher','learner','guest']){
  const f=fixture({isActive:true,isAdmin:role==='admin',authUserId:'same-session',canFacilitate:role==='teacher'});
  await assert.rejects(()=>f.page(),error=>error.redirect==='/learn');assert.equal(f.reads(),1,'one authorization check and no new login or identity');
 }
});
test('missing, expired or revoked access stays on login without a redirect loop',async()=>{
 for(const access of [null,{isActive:false}]){const f=fixture(access),page=await f.page();assert.equal(page.type,f.Landing);assert.equal(f.reads(),1);}
});
test('Google sign-in feedback remains available to unauthenticated users',async()=>{
 const f=fixture(null),page=await f.page({result:'wrong-account'});assert.equal(page.props.googleResult,'wrong-account');
});
test('authorization outages propagate instead of manufacturing a login or discarding the session',async()=>{
 const page=loadTS('app/page.tsx',{'@/components/LandingPage':{__esModule:true,default:()=>null},'next/navigation':{redirect(){throw Error('unexpected redirect');}},'@/lib/auth/currentUser':{currentUserAccess:async()=>{throw Error('database unavailable');}}}).default;
 await assert.rejects(()=>page({searchParams:Promise.resolve({})}),/database unavailable/);
});
