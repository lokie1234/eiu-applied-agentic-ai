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
 const draw=await f.module.draw(f.ctx,{sectionId,excluded:[],requestId:crypto.randomUUID(),demo:false});
 assert.equal(draw.assignmentVersion,3);assert.equal(new Set(draw.subjects).size,7);
 const assignedParts=[];
 for(let i=0;i<draw.subjects.length;i++){
  f.setIdentity({subject:draw.subjects[i],role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
  const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment.part,i+1);assignedParts.push(view.assignment.part);
  assert.equal(view.assignment.config.tasks.length,i%7===0?3:i%7===1?2:1);assert.equal(view.members.length,0);assert.equal(view.draw,null);
 }
 assert.equal(new Set(assignedParts).size,7);
 f.setIdentity({subject:'not-selected',role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
 assert.equal((await f.module.view(f.ctx,{sectionId})).assignment,null);
});

test('A new draw cannot repeat assignment parts by selecting more than seven learners',async()=>{
 const f=classroomFixture();const room=await f.room({members:Array.from({length:50},(_,i)=>({subject:`student-${i}`,username:`Name ${i}`}))});
 for(const count of [8,50,0,-1,1.5])await assert.rejects(f.module.draw(f.ctx,{sectionId,count,excluded:[],requestId:crypto.randomUUID()}),/at most seven/);
 assert.equal(room.draw,undefined);assert.equal(f.tables.limits.length,0);
});

test('Automatic draws use available names and persist the exact part assigned to each subject',async()=>{
 for(const size of [1,3,7,12]){
 const f=classroomFixture();const members=Array.from({length:size},(_,i)=>({subject:`student-${i}`,username:`Student ${i}`}));
 const room=await f.room({members:[...members,members[0]]});const requestId=crypto.randomUUID();
 const result=await f.module.draw(f.ctx,{sectionId,excluded:[],requestId});
 assert.equal(result.names.length,Math.min(size,7));assert.equal(new Set(result.parts).size,result.names.length);
 assert.equal(new Set(result.subjects).size,result.names.length);
 assert.deepEqual(JSON.parse(JSON.stringify(await f.module.draw(f.ctx,{sectionId,excluded:[],requestId}))),JSON.parse(JSON.stringify(result)));
 for(let i=0;i<result.subjects.length;i++){
 f.setIdentity({subject:result.subjects[i],role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
 const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment.subject,result.subjects[i]);assert.equal(view.assignment.username,result.names[i]);assert.equal(view.assignment.part,room.draw.parts[i]);
 }
 }
});

test('Explicit part mappings are used instead of inferring a question from learner order',async()=>{
 const f=classroomFixture('learner','learner');await f.room({draw:{requestId:'explicit',names:['An','Binh'],subjects:['other','learner'],parts:[6,4],createdAt:110,assignmentVersion:3}});
 const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment.part,4);assert.equal(view.assignment.username,'Binh');
});

test('Existing larger version-2 draws retain their original assignments and saved history',async()=>{
 const f=classroomFixture('learner','student-7');
 const subjects=Array.from({length:8},(_,i)=>`student-${i}`);
 await f.room({draw:{requestId:'legacy-large-round',subjects,names:subjects,createdAt:110,assignmentVersion:2}});
 await f.db.insert('practiceAnswers',{sectionId,...answer});
 const view=await f.module.view(f.ctx,{sectionId});
 assert.equal(view.assignment.part,1);assert.equal(view.assignment.drawId,'legacy-large-round');
 assert.equal(f.tables.practiceAnswers.length,1);
});

test('Legacy rounds preserve their original question assignments as Parts 3-7',async()=>{
 const f=classroomFixture('learner','learner');await f.room({draw:{requestId:'old-round',subjects:['learner'],names:['An'],createdAt:110}});
 const view=await f.module.view(f.ctx,{sectionId});assert.equal(view.assignment.part,3);assert.equal(view.assignment.config.title,'Question 1');
});

test('Demo requests cannot draw or reset the real classroom',async()=>{
 const f=classroomFixture();const draw={requestId:'real-round',subjects:['learner'],names:['An'],createdAt:110,assignmentVersion:2};
 const room=await f.room({draw});
 await assert.rejects(f.module.draw(f.ctx,{sectionId,count:1,excluded:[],requestId:crypto.randomUUID(),demo:true}),/Demo mode has been removed/);
 await assert.rejects(f.module.resetDraw(f.ctx,{sectionId,demo:true}),/Demo mode has been removed/);
 assert.deepEqual(room.draw,draw);
 assert.equal('demoDraw' in await f.module.view(f.ctx,{sectionId}),false);
});

test('Saving next-round setup preserves frozen current assignments and submissions',async()=>{
 const f=classroomFixture();const bank=JSON.parse(JSON.stringify(practice.MIS301_QUESTION_DEFAULTS));
 const draw={requestId:'real-round',subjects:['learner'],names:['An'],createdAt:110,assignmentVersion:2,questions:bank};
 const room=await f.room({draw});await f.db.insert('practiceAnswers',{sectionId,...answer});
 const questions=structuredClone(bank);questions[0].prompt='Instructions for the next round';
 await f.module.configureQuestions(f.ctx,{sectionId,questions});
 assert.equal(room.questionSetup[0].prompt,'Instructions for the next round');
 assert.deepEqual(room.draw,draw);assert.equal(f.tables.practiceAnswers.length,1);
 f.setIdentity({subject:'learner',role:'learner',sections:JSON.stringify([sectionId]),teaching:'[]'});
 assert.equal((await f.module.view(f.ctx,{sectionId})).assignment.config.prompt,bank[0].prompt);
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

test('All seven submissions save to Supabase before notifying Convex; failed writes never report success',async()=>{
 for(const fail of [false,true])for(let part=1;part<=7;part++){
 const trace=[],identity={sessionId:'learner',name:'An',email:'an@example.test',information:{name:'An'}};
 let inserted,notification;
 const query={select(){return this;},eq(){return this;},contains(){return this;},gt(){return this;},limit(){return this;},async maybeSingle(){return {data:null,error:null};},insert(row){inserted=row;trace.push('supabase-insert');return this;},async single(){trace.push('supabase-result');return fail?{data:null,error:{code:'write-failed'}}:{data:{id:123,created_at:new Date().toISOString()},error:null};}};
 const route=loadTS('app/api/sections/[id]/practice/route.ts',{
 'next/server':{NextResponse:{json:(value,options)=>Response.json(value,options)}},
 '@/lib/auth/currentUser':{currentUserAccess:async()=>({isActive:true,isAdmin:false,learnerIdentity:identity,sections:[{id:sectionId,courseId,canFacilitate:false}],courses:[{id:courseId}]})},
 '@/lib/supabase/server':{getSupabaseAdmin:()=>({from(table){assert.equal(table,'access_audit_logs');return query;}})},
 '@/lib/sectionTermination':{readSectionTermination:async()=>null},'@/lib/mis301Practice':practice,
 '@/lib/mis301Assignment':{readPracticeAssignment:async()=>({question:part,part,drawId:'round',createdAt:1})},
 '@/lib/realtime/publish':{notifyRealtime(){trace.push('revision');}},
 '@/lib/realtime/classroom':{notifyClassroom(){},notifyClassroomAnswer(payload){trace.push('convex-notification');notification=payload;}}
 });
 const spec=practice.MIS301_QUESTION_FIELDS[part],values=Object.fromEntries(spec.fields.map(field=>[field,spec.codeFields.includes(field)?'df':'6']));
 const response=await route.POST(new Request('https://example.test/practice',{method:'POST',body:JSON.stringify({partId:spec.partId,values,submissionId:crypto.randomUUID(),practiceSession:'initial',drawId:'round'})}),{params:Promise.resolve({id:sectionId})});
 assert.equal(response.status,fail?500:200,`Part ${part}`);
 assert.equal(inserted.details.assignmentPart,part);assert.equal(inserted.action,'ACTIVITY_SUBMITTED');
 assert.deepEqual(trace,fail?['supabase-insert','supabase-result']:['supabase-insert','supabase-result','revision','convex-notification']);
 if(!fail){assert.equal(notification.answer.recordId,'123');assert.equal(notification.answer.subject,identity.sessionId);assert.equal(notification.answer.drawId,'round');assert.equal(notification.answer.assignmentPart,part);}
 }
});
