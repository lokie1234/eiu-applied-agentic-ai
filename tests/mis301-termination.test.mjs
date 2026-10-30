import test from 'node:test';
import assert from 'node:assert/strict';
import {classroomFixture,practice,sectionId,courseId,loadTS,deferred,tick} from './helpers/mis301-fixture.mjs';
const snapshot=(epoch,version,members=[],answers=[])=>({sectionId,epoch,version,members,answers});
const answer={recordId:'1',subject:'learner',username:'An',partId:'scores',assignmentPart:4,questionNumber:2,drawId:'old-draw',values:{mean:'5.47',code:'df.describe()'},submittedAt:new Date(150).toISOString()};

test('Terminate clears real/demo draws, assignments and answer projection while retaining the question bank',async()=>{
 const f=classroomFixture();const bank=JSON.parse(JSON.stringify(practice.MIS301_QUESTION_DEFAULTS));
 const room=await f.room({questionSetup:bank,draw:{requestId:'old-draw',names:['An'],subjects:['learner'],createdAt:110,assignmentVersion:2},demoDraw:{requestId:'demo',names:['Demo'],createdAt:110}});
 await f.db.insert('practiceAnswers',{sectionId,...answer});
 await f.module.replace(f.ctx,snapshot('new',200));
 assert.equal(room.epoch,'new');assert.equal(room.draw,undefined);assert.equal(room.demoDraw,undefined);
 assert.deepEqual(room.questionSetup,bank);assert.equal(f.tables.practiceAnswers.length,0);
 f.setIdentity({subject:'learner',role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
 const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment,null);assert.equal(view.items.length,0);
});

test('Delayed pre-Terminate snapshots and submitted-answer notifications cannot revive old state',async()=>{
 const f=classroomFixture();const room=await f.room();
 await f.module.replace(f.ctx,snapshot('new',200));
 await f.module.replace(f.ctx,snapshot('old',150,[{subject:'learner',username:'An'}],[answer]));
 await f.module.answer(f.ctx,{sectionId,epoch:'old',answer:{...answer,submittedAt:new Date(300).toISOString()}});
 assert.equal(room.epoch,'new');assert.equal(room.members.length,0);assert.equal(f.tables.practiceAnswers.length,0);
 await f.module.answer(f.ctx,{sectionId,epoch:'new',answer:{...answer,recordId:'2',submittedAt:new Date(190).toISOString()}});
 assert.equal(f.tables.practiceAnswers.length,0);
});

test('An empty roster update is not a draw reset within the same section session',async()=>{
 const f=classroomFixture();const draw={requestId:'draw',subjects:['learner'],names:['An'],createdAt:110,assignmentVersion:2};const room=await f.room({draw});
 await f.module.replace(f.ctx,snapshot('old',200));
 assert.deepEqual(room.draw,draw);
});

test('New rounds assign seven unequal notebook parts to signed subjects, never demo usernames',async()=>{
 const f=classroomFixture();await f.room({members:Array.from({length:8},(_,i)=>({subject:`student-${i}`,username:`Name ${i}`}))});
 const draw=await f.module.draw(f.ctx,{sectionId,count:8,excluded:[],requestId:crypto.randomUUID(),demo:false});
 assert.equal(draw.assignmentVersion,2);assert.equal(new Set(draw.subjects).size,8);
 for(let i=0;i<draw.subjects.length;i++){
  f.setIdentity({subject:draw.subjects[i],role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
  const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment.part,i%7+1);
  assert.equal(view.assignment.config.tasks.length,i%7===0?3:i%7===1?2:1);assert.equal(view.members.length,0);assert.equal(view.draw,null);
 }
 f.setIdentity({subject:'not-selected',role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
 assert.equal((await f.module.view(f.ctx,{sectionId})).assignment,null);
});

test('Legacy rounds preserve their original question assignments as Parts 3-7',async()=>{
 const f=classroomFixture('learner','learner');await f.room({draw:{requestId:'old-round',subjects:['learner'],names:['An'],createdAt:110}});
 const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment.part,3);assert.equal(view.assignment.config.title,'Question 1');
});

test('Question setup enforces teaching scope and original per-part task counts',async()=>{
 const f=classroomFixture('learner','learner');await f.room();const questions=JSON.parse(JSON.stringify(practice.MIS301_QUESTION_DEFAULTS));
 await assert.rejects(f.module.configureQuestions(f.ctx,{sectionId,questions}),/Teaching/);
 f.setIdentity({subject:'admin',role:'admin',sections:JSON.stringify([sectionId]),teaching:'[]'});
 questions[0].tasks.pop();await assert.rejects(f.module.configureQuestions(f.ctx,{sectionId,questions}),/original number/);
});

function controlFixture(sync, token = "initial") {
 const trace=[]; const access={isActive:true,isAdmin:true,email:'admin@example.test',sections:[{id:sectionId,courseId,terminationEnabled:true}],courses:[{id:courseId,slug:'mis301'}]};
 const route=loadTS('app/api/sections/[id]/control/route.ts',{
  'next/server':{NextResponse:{json:(value,options)=>Response.json(value,options)}},
  '@/lib/realtime/publish':{notifyRealtime:()=>trace.push('signal')},
  '@/lib/realtime/classroom':{publishClassroom:async()=>{trace.push('sync');await sync();},notifyClassroom:()=>trace.push('retry')},
  '@/lib/auth/currentUser':{currentUserAccess:async()=>access},'@/lib/auth/types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'},
  '@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>({insert:async value=>{trace.push(value.action);return {error:null};}})})},
  '@/lib/sectionTermination':{readSectionTermination:async()=>token === 'initial' ? null : {details:{token}}},'@/lib/mis301Practice':practice
 });
 return {route,trace,access,request:new Request('https://example.test/control',{method:'POST'}),context:{params:Promise.resolve({id:sectionId})}};
}
test('Terminate confirms only after attempting to synchronize the new classroom epoch',async()=>{
 const wait=deferred(),f=controlFixture(()=>wait.promise);let done=false;
 const response=f.route.POST(f.request,f.context).then(value=>{done=true;return value;});await tick();
 assert.equal(done,false);assert.deepEqual(f.trace.slice(0,2),['SECTION_TERMINATED','sync']);wait.resolve();
 const payload=await (await response).json();assert.equal(payload.success,true);assert.equal(payload.classroomSynced,true);
});
test('A realtime outage keeps durable termination successful and schedules reconciliation',async()=>{
 const f=controlFixture(async()=>{throw Error('offline');});const response=await f.route.POST(f.request,f.context);const payload=await response.json();
 assert.equal(response.status,200);assert.equal(payload.success,true);assert.equal(payload.classroomSynced,false);assert.equal(f.trace.filter(x=>x==='SECTION_TERMINATED').length,1);assert.ok(f.trace.includes('retry'));
});

test('A practice submission rechecks the durable termination token immediately before its write',async()=>{
 let epoch='old',writes=0;
 const identity={sessionId:'learner',name:'An',email:'an@example.test',information:{name:'An'}};
 const query={select(){return this;},eq(){return this;},contains(){return this;},gt(){return this;},limit(){return this;},async maybeSingle(){epoch='new';return {data:null,error:null};},insert(){writes++;return this;},async single(){return {data:{id:1,created_at:new Date().toISOString()},error:null};}};
 const route=loadTS('app/api/sections/[id]/practice/route.ts',{
 'next/server':{NextResponse:{json:(value,options)=>Response.json(value,options)}},
 '@/lib/auth/currentUser':{currentUserAccess:async()=>({isActive:true,isAdmin:false,learnerIdentity:identity,sections:[{id:sectionId,courseId,canFacilitate:false}],courses:[{id:courseId}]})},
 '@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>query})},'@/lib/sectionTermination':{readSectionTermination:async()=>({id:1,details:{token:epoch}})},
 '@/lib/realtime/publish':{notifyRealtime(){}},'@/lib/realtime/classroom':{notifyClassroom(){},notifyClassroomAnswer(){}},'@/lib/mis301Practice':practice,
 '@/lib/mis301Assignment':{readPracticeAssignment:async()=>({question:4,part:4,drawId:'draw',createdAt:1})}
 });
 const request=new Request('https://example.test/practice',{method:'POST',body:JSON.stringify({partId:'scores',submissionId:crypto.randomUUID(),practiceSession:'old',drawId:'draw',values:{mean:'5.47',code:'df.describe()'}})});
 const response=await route.POST(request,{params:Promise.resolve({id:sectionId})});assert.equal(response.status,409);assert.equal(writes,0);
});


test('Disabling the Terminate button does not rewind the MIS 301 session epoch',async()=>{
 const f=controlFixture(async()=>{},'retained-epoch');f.access.sections[0].terminationEnabled=false;
 const response=await f.route.GET(new Request('https://example.test/control'),f.context);
 const payload=await response.json();assert.equal(payload.enabled,false);assert.equal(payload.terminationToken,'retained-epoch');
 const denied=await f.route.POST(f.request,f.context);assert.equal(denied.status,403);assert.equal(f.trace.length,0);
});
