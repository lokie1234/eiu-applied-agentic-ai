import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS,classroomFixture,practice} from './helpers/mis301-fixture.mjs';
const shared=loadTS('lib/sectionWheel.ts'),common=loadTS('lib/mis311Spotlight.ts');
const a=common.MIS311_SPOTLIGHT_SECTION_ID,b='a2910493-271a-46fd-8707-957361286555';
function fixture(){
  const f=classroomFixture();Object.assign(f.tables,{spotlight:[],spotlightRequests:[],presence:[],counts:[]});
  let now=Date.now();const Clock=class extends Date{static now(){return now;}};
  f.db.get=async id=>Object.values(f.tables).flat().find(row=>row._id===id)||null;f.ctx.scheduler={runAfter:async()=>{}};
  const v=new Proxy({},{get:()=>()=>({})});
  const functions=loadTS('convex/spotlight.ts',{'convex/server':{queryGeneric:s=>s.handler,mutationGeneric:s=>s.handler,internalMutationGeneric:s=>s.handler,makeFunctionReference:n=>n},'convex/values':{v,ConvexError:Error},'./schema':{},'../lib/mis311Spotlight':common},{Date:Clock});
  const identity=(subject='teacher',teaching=true,wheels=[a,b,practice.MIS301_SECTION_ID])=>f.setIdentity({subject,role:teaching?'admin':'learner',sections:JSON.stringify([a,b,practice.MIS301_SECTION_ID]),teaching:JSON.stringify(teaching?[a,b,practice.MIS301_SECTION_ID]:[]),wheelSections:JSON.stringify(wheels)});
  identity();
  return {...f,functions,identity,advance:ms=>now+=ms,async prepare(sectionId=a,total=4){const members=Array.from({length:total},(_,i)=>({subject:`session-${i}`,username:i<2?'Same name':`Learner ${i}`}));const room=await f.room({sectionId,epoch:`epoch:${sectionId}`,members,wheelEnabled:true});for(const member of members)await f.db.insert('presence',{sectionId,subject:member.subject,expiresAt:now+600000});return room;},draw(sectionId=a){return functions.draw(f.ctx,{sectionId,epoch:`epoch:${sectionId}`,slide:0,requestId:crypto.randomUUID()});},configure(sectionId,count){return functions.configure(f.ctx,{sectionId,epoch:`epoch:${sectionId}`,count});}};
}

test('default migration preserves existing wheels, explicit disable wins, and settings have no arbitrary maximum',()=>{
  assert.equal(shared.sectionWheelEnabled(a),true);assert.equal(shared.sectionWheelEnabled(practice.MIS301_SECTION_ID),true);assert.equal(shared.sectionWheelEnabled(b),false);
  assert.equal(shared.sectionWheelEnabled(a,{[a]:false}),false);assert.equal(shared.sectionWheelEnabled(b,{[b]:true}),true);
  for(const n of [1,8,51,500,Number.MAX_SAFE_INTEGER])assert.equal(shared.validWheelCount(n),true);
  for(const n of [0,-1,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1,'4'])assert.equal(shared.validWheelCount(n),false);
});

test('background repair rebuilds only enabled active scopes, not every configured section',async()=>{
  const calls=[],route=loadTS('app/api/realtime/sync/route.ts',{'@/lib/realtime/server':{bridgeAuthorized:()=>true,readRealtimeSignals:async()=>[]},'@/lib/realtime/classroom':{classroomSnapshot:async(_,scope)=>{calls.push(scope);return {sectionId:scope?.sectionId||practice.MIS301_SECTION_ID};}},'@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>({courses:[{id:'course',metadata:{sectionWheel:{[a]:true,[b]:false,idle:true}}}],sections:[{id:a,course_id:'course',status:'active'},{id:b,course_id:'course',status:'active'},{id:'idle',course_id:'course',status:'active'}]})}});
  const response=await route.GET(new Request(`https://example.test/api/realtime/sync?sections=${encodeURIComponent(JSON.stringify([a,b]))}`));assert.equal(response.status,200);assert.equal(calls.length,2);assert.equal(calls[1].sectionId,a);assert.deepEqual((await response.json()).classrooms.map(r=>r.sectionId),[a]);
});

test('each section owns its count, atomic spin lock and rate accounting; simultaneous sections do not block each other',async()=>{
  const f=fixture();await f.prepare(a);await f.prepare(b);
  assert.equal((await f.configure(a,3)).count,3);assert.equal((await f.configure(b,2)).count,2);
  const first=await f.draw(a),second=await f.draw(b);assert.equal(first.targets.length,3);assert.equal(second.targets.length,2);
  assert.equal(new Set(first.targets.map(t=>t.subject)).size,3);assert.equal((await f.draw(a)).code,'DRAW_BUSY');
  f.advance(2100);assert.equal((await f.configure(a,4)).message,'Wait for the current spin to finish.');
  assert.ok(f.tables.limits.some(row=>row.subject===`spotlight:${a}:teacher`));assert.ok(f.tables.limits.some(row=>row.subject===`spotlight:${b}:teacher`));
});

test('large requested counts clamp to the real eligible pool, and every selected learner receives only their own identity',async()=>{
  const f=fixture();await f.prepare(a,64);await f.configure(a,1000000);const selected=await f.draw();assert.equal(selected.targets.length,64);
  for(const person of selected.targets){f.identity(person.subject,false);const view=await f.functions.view(f.ctx,{sectionId:a});assert.equal(view.draws.length,1);assert.equal(view.draws[0].subject,person.subject);assert.equal(view.draws[0].username,person.username);assert.equal(view.draws[0].targets,undefined);assert.equal(view.members.length,0);}
  f.identity('unselected',false);assert.equal((await f.functions.view(f.ctx,{sectionId:a})).draws.length,0);
});

test('disabled scope, learner configuration, stale epochs and invalid counts cannot mutate a room',async()=>{
  const f=fixture(),room=await f.prepare();f.identity('learner',false);await assert.rejects(f.configure(a,3),/Teaching/);
  f.identity('teacher',true,[]);await assert.rejects(f.draw(),/access denied/);
  f.identity();for(const count of [0,-1,2.5,Infinity])await assert.rejects(f.configure(a,count),/positive whole/);
  assert.equal((await f.functions.configure(f.ctx,{sectionId:a,count:3,epoch:'old'})).code,'STALE_CLASSROOM');
  room.wheelEnabled=false;await assert.rejects(f.configure(a,3),/disabled/);await assert.rejects(f.draw(),/disabled/);assert.equal((await f.functions.view(f.ctx,{sectionId:a})).draws.length,0);
});

test('each learner receives the deadline for their ordered admin reveal and the whole group stays locked',async()=>{
  const f=fixture();await f.prepare(a,3);await f.configure(a,3);
  const selected=await f.draw();
  assert.equal(selected.revealAt-selected.createdAt,1667,'first result no longer waits five seconds');
  for(const [index,person] of selected.targets.entries()){
    f.identity(person.subject,false);
    const view=await f.functions.view(f.ctx,{sectionId:a}),own=view.draws[0];
    assert.equal(own.revealAt,common.spotlightRevealAt(selected,index));
    assert.equal(own.targets,undefined,'timing never exposes other winners');
  }
  f.identity();f.advance(1668);
  assert.equal((await f.draw()).code,'DRAW_BUSY','first reveal does not unlock later names');
  f.advance(3732);
  assert.equal((await f.draw()).code,'DRAW_BUSY','final name is still spinning');
  f.advance(1);
  assert.ok((await f.draw()).targets,'unlock exactly at the final deadline');
});

test('large groups retain their later notifications and retry records through the final reveal',async()=>{
  const f=fixture();await f.prepare(a,100);await f.configure(a,100);
  const selected=await f.draw(),last=selected.targets.at(-1);
  f.advance(130000);f.identity(last.subject,false);
  const view=await f.functions.view(f.ctx,{sectionId:a});
  assert.equal(view.draws[0].revealAt,common.spotlightFinishedAt(selected));
  assert.ok(f.tables.spotlightRequests[0].expiresAt>=common.spotlightFinishedAt(selected)+10000);
});

test('MIS 301 uses the same per-section count while retaining frozen parts and reset-before-redraw',async()=>{
  const f=fixture(),room=await f.prepare(practice.MIS301_SECTION_ID,12);await f.configure(practice.MIS301_SECTION_ID,12);
  const draw=await f.module.draw(f.ctx,{sectionId:practice.MIS301_SECTION_ID,requestId:crypto.randomUUID(),excluded:[]});assert.equal(draw.names.length,12);
  assert.deepEqual(Array.from(draw.parts),[1,2,3,4,5,6,7,1,2,3,4,5]);assert.equal(room.draw.requestId,draw.requestId);
  assert.match((await f.module.draw(f.ctx,{sectionId:practice.MIS301_SECTION_ID,requestId:crypto.randomUUID(),excluded:[]})).message,/Reset/);
  f.advance(2100);assert.match((await f.configure(practice.MIS301_SECTION_ID,2)).message,/Reset/);
  await assert.rejects(f.draw(practice.MIS301_SECTION_ID),/assignment wheel/);
});

test('disabling the wheel in renewed tokens blocks assignment draws without removing access to saved practice',async()=>{
  const f=fixture();await f.prepare(practice.MIS301_SECTION_ID);f.identity('teacher',true,[]);
  await assert.rejects(f.module.draw(f.ctx,{sectionId:practice.MIS301_SECTION_ID,requestId:crypto.randomUUID(),excluded:[]}),/disabled/);
  assert.equal((await f.module.view(f.ctx,{sectionId:practice.MIS301_SECTION_ID})).ready,true);
});

test('target mode selects exactly the signed sessions configured by teaching, including identical names',async()=>{
 for(const selected of [['session-1'],['session-0','session-1','session-3']]){
  const f=fixture();await f.prepare(a,5);
  const saved=await f.functions.configure(f.ctx,{sectionId:a,epoch:`epoch:${a}`,count:99,targetSubjects:selected});assert.equal(saved.count,selected.length);
  const settings=await f.functions.settings(f.ctx,{sectionId:a});assert.deepEqual(Array.from(settings.targetSubjects),selected);
  const result=await f.draw();assert.deepEqual(Array.from(result.targets,t=>t.subject).sort(),[...selected].sort());assert.equal(new Set(result.targets.map(t=>t.subject)).size,selected.length);
  const replay=await f.functions.draw(f.ctx,{sectionId:a,epoch:`epoch:${a}`,slide:0,requestId:result.requestId});assert.equal(JSON.stringify(replay.targets),JSON.stringify(result.targets));
  f.identity('other',false);await assert.rejects(f.functions.settings(f.ctx,{sectionId:a}),/Teaching/);
  f.identity(result.targets[0].subject,false);assert.equal((await f.functions.view(f.ctx,{sectionId:a})).draws[0].targets,undefined);
 }
});

test('target mode validates membership and presence, rejects stale targets and clears on disable',async()=>{
 const f=fixture();await f.prepare(a,4);
 for(const ids of [['missing'],['session-0','session-0']]){f.advance(2100);await assert.rejects(f.functions.configure(f.ctx,{sectionId:a,epoch:`epoch:${a}`,count:1,targetSubjects:ids}),/existing learner/);}
 f.advance(2100);await f.functions.configure(f.ctx,{sectionId:a,epoch:`epoch:${a}`,count:1,targetSubjects:['session-0']});
 f.tables.presence.find(row=>row.subject==='session-0').expiresAt=0;assert.equal((await f.draw()).code,'TARGET_UNAVAILABLE');
 f.advance(2100);const stale=await f.functions.configure(f.ctx,{sectionId:a,epoch:`epoch:${a}`,count:1,targetSubjects:['session-0']});assert.match(stale.message,/online/);
 f.advance(2100);await f.functions.configure(f.ctx,{sectionId:a,epoch:`epoch:${a}`,count:2,targetSubjects:[]});const normal=await f.draw();assert.equal(normal.targets.length,2);assert.ok(normal.targets.every(t=>t.subject!=='session-0'));
});

test('assignment wheel honors the same target set and retains server-assigned practice parts',async()=>{
 const f=fixture(),id=practice.MIS301_SECTION_ID;await f.prepare(id,5);await f.functions.configure(f.ctx,{sectionId:id,epoch:`epoch:${id}`,count:1,targetSubjects:['session-1','session-4']});
 const result=await f.module.draw(f.ctx,{sectionId:id,requestId:crypto.randomUUID(),excluded:[]});assert.deepEqual(Array.from(result.subjects).sort(),['session-1','session-4']);assert.deepEqual(Array.from(result.parts),[1,2]);
});
