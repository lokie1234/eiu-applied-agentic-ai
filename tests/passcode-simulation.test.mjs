import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
const resolver=loadTS('lib/auth/passcodes.ts',{'./courseAccessStorage':{},'./types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'}});
const simulation=loadTS('lib/auth/passcodeSimulation.ts',{'./passcodes':resolver});
function catalog(){return {globalAccessCodes:{learner:'global-learn',facilitator:'global-teach'},folderGroups:[{id:'f1',name:'Business',accessCodes:{learner:'folder-one'}},{id:'f2',name:'Technology'}],courses:[
 {id:'c1',title:'Analytics',status:'active',folderGroupId:'f1',metadata:{passcode:'course-one',facilitatorPasscode:'teach-one',sectionAccessCodes:{s1:{learner:'section-one'}},hiddenSectionIds:['hidden']}},
 {id:'c2',title:'Web',status:'active',folderGroupId:'f2',metadata:{passcode:'course-two'}},
 {id:'c3',title:'Hidden course',status:'active',folderGroupId:'f2',metadata:{passcode:'hidden-code',hidden:true}},
 ],sections:[{id:'s1',title:'Prompts',course_id:'c1',status:'active'},{id:'s2',title:'Tools',course_id:'c1',status:'active'},{id:'hidden',title:'Hidden section',course_id:'c1',status:'active'},{id:'s3',title:'Web apps',course_id:'c2',status:'active'},{id:'s4',title:'Private',course_id:'c3',status:'active'}]};}

test('simulation uses the real login resolver for every global, folder, course and section credential',()=>{
 const data=catalog(),rows=simulation.simulationCredentials(data);assert.equal(rows.length,8);assert.equal(rows.filter(row=>row.kind==='global').length,2);
 for(const row of rows){const actual=resolver.resolvePasscode(data,resolver.hashPasscode(row.code)),preview=simulation.simulateCredential(data,row.id);assert.equal(Boolean(preview),Boolean(actual));if(actual){assert.deepEqual(Array.from(preview.sections,section=>section.id),Array.from(actual.sections,section=>section.id));assert.equal(preview.mode,row.mode);}}
 assert.equal(simulation.simulateCredential(data,'course:c1:learner').sections.length,2);assert.equal(simulation.simulateCredential(data,'section:s1:learner').sections.length,1);assert.match(simulation.simulateCredential(data,'section:s1:learner').label,/Analytics.*Prompts/);assert.equal(simulation.simulateCredential(data,'course:c3:learner'),null);
 const global=simulation.simulateCredential(data,'global:all:facilitator');assert.equal(global.sections.length,3);assert.ok(global.sections.every(section=>section.canFacilitate));assert.ok(!JSON.stringify(global).includes('global-teach'),'preview does not retain passcodes');
});
test('ambiguous, deleted and hidden passcodes fail closed instead of showing the full admin catalog',()=>{
 const data=catalog();data.courses[1].metadata.passcode='course-one';assert.equal(simulation.simulateCredential(data,'course:c1:learner'),null);assert.equal(simulation.simulateCredential(data,'unknown'),null);assert.equal(simulation.simulateCredential(data,'course:c2:learner'),null);data.folderGroups[0].hidden=true;assert.equal(simulation.simulateCredential(data,'folder:f1:learner'),null);
});
test('legacy codes rejected by the sign-in input format are not offered as valid simulations',()=>{
 const data=catalog();data.courses[0].metadata.passcode='a';assert.equal(simulation.simulateCredential(data,'course:c1:learner'),null);
});
test('only Admin can list or simulate codes; simulation has no session cookies or identity writes',async()=>{
 let admin=true;const data=catalog(),writes=[];
 const api=loadTS('app/api/admin/passcode-simulation/route.ts',{'@/lib/auth/currentUser':{requireAdminAccess:async()=>admin?{isAdmin:true}:null},'@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>data},'@/lib/auth/passcodeSimulation':simulation});
 const get=()=>api.GET(new Request('http://localhost/api/admin/passcode-simulation')),post=(credentialId,headers={})=>api.POST(new Request('http://localhost/api/admin/passcode-simulation',{method:'POST',headers,body:JSON.stringify({credentialId})}));
 admin=false;assert.equal((await get()).status,403);assert.equal((await post('global:all:learner')).status,403);admin=true;const list=await get();assert.equal(list.status,200);assert.match(list.headers.get('cache-control'),/no-store/);assert.equal((await list.json()).credentials.length,8);
 assert.equal((await post('global:all:learner',{origin:'https://other.test'})).status,403);const response=await post('course:c1:learner');assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.deepEqual((await response.json()).preview.sections.map(section=>section.id),['s1','s2']);
 data.courses[0].metadata.hidden=true;assert.equal((await post('course:c1:learner')).status,409);assert.equal((await post('x'.repeat(800))).status,400);assert.equal(writes.length,0);
});
