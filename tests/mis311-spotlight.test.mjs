import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { loadTS, classroomFixture } from './helpers/mis301-fixture.mjs';
const common=loadTS('lib/mis311Spotlight.ts');
const sectionId=common.MIS311_SPOTLIGHT_SECTION_ID;
function fixture(){
  const f=classroomFixture();f.tables.spotlight=[];f.tables.spotlightRequests=[];f.tables.presence=[];f.tables.counts=[];
  const reads=[],query=f.db.query;f.db.query=table=>{reads.push(table);return query(table);};
  let now=Date.now();const Clock=class extends Date{static now(){return now;}};
  const jobs=[];f.db.get=async id=>Object.values(f.tables).flat().find(row=>row._id===id)||null;
  f.ctx.scheduler={runAfter:async(delay,reference,args)=>{jobs.push({due:now+delay,reference,args});}};
  const validators=new Proxy({},{get:()=>()=>({})});
  const functions=loadTS('convex/spotlight.ts',{'convex/server':{queryGeneric:s=>s.handler,mutationGeneric:s=>s.handler,internalMutationGeneric:s=>s.handler,makeFunctionReference:name=>name},'convex/values':{v:validators,ConvexError:Error},'./schema':{},'../lib/mis311Spotlight':common},{Date:Clock});
  const identity=(subject='teacher',role='admin')=>f.setIdentity({subject,role,sections:JSON.stringify([sectionId]),wheelSections:JSON.stringify([sectionId]),teaching:JSON.stringify(role==='admin'?[sectionId]:[])});
  identity();
  return {...f,functions,identity,reads,jobs,advance:ms=>{now+=ms;},async prepare(){
    const room=await f.room({sectionId,epoch:'epoch',members:[{subject:'one',username:'Same name'},{subject:'two',username:'Same name'},{subject:'gone',username:'Offline'}]});
    for(const subject of ['one','two'])await f.db.insert('presence',{sectionId,subject,clientId:subject,expiresAt:now+600_000});
    await f.db.insert('counts',{sectionId,online:2,subjects:['one','two']});
    return room;
  }};
}
test('spotlight authorizes its actual section and selects only active signed sessions',async()=>{
  const f=fixture();await f.prepare();
  await assert.rejects(f.functions.view(f.ctx,{sectionId:'other'}),/access denied/);
  const initial=await f.functions.view(f.ctx,{sectionId});assert.equal(initial.members.length,2);assert.equal(initial.members[0].username,'Same name');
  f.identity('one','learner');f.reads.length=0;const learner=await f.functions.view(f.ctx,{sectionId});assert.equal(learner.members.length,0);
  assert.ok(!f.reads.includes('presence')&&!f.reads.includes('counts'),'learner subscriptions never read heartbeat-dependent tables');
  await assert.rejects(f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()}),/Teaching/);
  f.identity();for(const slide of [4,6,9,5.5])await assert.rejects(f.functions.draw(f.ctx,{sectionId,slide,epoch:'epoch',requestId:crypto.randomUUID()}),/Invalid/);
  assert.equal((await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'old',requestId:crypto.randomUUID()})).code,'STALE_CLASSROOM');
  const draw=await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()});
  assert.ok(['one','two'].includes(draw.subject));assert.equal(draw.username,'Same name');assert.equal(draw.revealAt-draw.createdAt,5000);
  f.identity(draw.subject,'learner');assert.equal((await f.functions.view(f.ctx,{sectionId})).draws.length,1);
  f.identity(draw.subject==='one'?'two':'one','learner');assert.equal((await f.functions.view(f.ctx,{sectionId})).draws.length,0,'matching names never receive another session’s selection');
});
test('draws are idempotent, serialize teaching tabs, allow rerolls and reject stale epochs',async()=>{
  const f=fixture(),room=await f.prepare();const args={sectionId,slide:7,epoch:'epoch',requestId:crypto.randomUUID()};
  const first=await f.functions.draw(f.ctx,args),retry=await f.functions.draw(f.ctx,args);assert.equal(first.requestId,retry.requestId);assert.equal(f.tables.spotlight.length,1);
  f.identity('other-teacher');assert.equal((await f.functions.draw(f.ctx,{...args,slide:8,requestId:crypto.randomUUID()})).code,'DRAW_BUSY');
  f.advance(5001);const second=await f.functions.draw(f.ctx,{...args,requestId:crypto.randomUUID()});assert.notEqual(first.requestId,second.requestId);assert.equal(f.tables.spotlight.length,1);
  const replay=await f.functions.draw(f.ctx,args);assert.equal(replay.requestId,first.requestId);assert.equal(replay.subject,first.subject);assert.equal(f.tables.spotlight[0].requestId,second.requestId,'a delayed retry never replaces the later round');
  room.epoch='terminated';assert.equal((await f.functions.view(f.ctx,{sectionId})).draws.length,0);
  assert.equal((await f.functions.draw(f.ctx,{...args,requestId:crypto.randomUUID()})).code,'STALE_CLASSROOM');
  room.epoch='epoch';room.members=[];assert.equal((await f.functions.view(f.ctx,{sectionId})).draws.length,0,'reset removes the old winner even without an epoch change');
});
test('empty and stale rosters cannot produce a fake winner; rapid public draws are limited',async()=>{
  const f=fixture(),room=await f.prepare();room.members=[];
  assert.equal((await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()})).code,'NO_LEARNERS');
  room.members=[{subject:'one',username:'An'}];
  // Start a fresh actor’s ten permitted rounds, advancing just beyond each spin.
  f.identity('rate-test');
  for(let i=0;i<10;i++){assert.ok((await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()})).subject);f.advance(5001);}
  assert.ok((await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()})).retryAfter>0);
});
test('retry records expire without enlarging live learner rows or replacing a newer draw',async()=>{
  const f=fixture();await f.prepare();
  const first=await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()});
  assert.equal(f.tables.spotlightRequests.length,1);assert.equal(f.jobs.length,1);
  const job=f.jobs[0];assert.equal(job.reference,'spotlight:expireRequest');
  await f.functions.expireRequest(f.ctx,job.args);assert.equal(f.tables.spotlightRequests.length,1,'early cleanup cannot shorten retry safety');
  f.advance(5001);const second=await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()});
  assert.equal(f.tables.spotlight.length,1);assert.ok(!('recent' in f.tables.spotlight[0]));
  f.advance(115000);await f.functions.expireRequest(f.ctx,job.args);
  assert.equal(f.tables.spotlightRequests.length,1);assert.equal(f.tables.spotlight[0].requestId,second.requestId);
  assert.notEqual(first.requestId,second.requestId);
  f.advance(5001);await f.functions.expireRequest(f.ctx,f.jobs[1].args);assert.equal(f.tables.spotlightRequests.length,0);
  await f.functions.expireRequest(f.ctx,job.args);
});

test('the slide 10 case study shares the authoritative draw, global spin lock and private learner result',async()=>{
  const f=fixture();await f.prepare();
  const selected=await f.functions.draw(f.ctx,{sectionId,slide:10,epoch:'epoch',requestId:crypto.randomUUID()});
  assert.equal(selected.slide,10);assert.ok(selected.subject);
  assert.equal((await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()})).code,'DRAW_BUSY');
  f.identity(selected.subject,'learner');assert.equal((await f.functions.view(f.ctx,{sectionId})).draws[0].slide,10);
  assert.equal((await f.functions.view(f.ctx,{sectionId})).members.length,0);
});

test('busy and empty requests consume the server limiter; large classes return at most twelve animation labels',async()=>{
  for(const busy of [false,true]){
    const f=fixture(),room=await f.prepare();
    if(busy)await f.functions.draw(f.ctx,{sectionId,slide:5,epoch:'epoch',requestId:crypto.randomUUID()});else room.members=[];
    f.identity('rapid-teacher');
    for(let i=0;i<10;i++)assert.equal((await f.functions.draw(f.ctx,{sectionId,slide:7,epoch:'epoch',requestId:crypto.randomUUID()})).code,busy?'DRAW_BUSY':'NO_LEARNERS');
    assert.equal((await f.functions.draw(f.ctx,{sectionId,slide:7,epoch:'epoch',requestId:crypto.randomUUID()})).retryAfter,60);
  }
  const f=fixture(),room=await f.prepare();room.members=[];
  for(let i=0;i<300;i++){const subject=`learner-${i}`;room.members.push({subject,username:`Learner ${i}`});await f.db.insert('presence',{sectionId,subject,expiresAt:Date.now()+600000});}
  const selected=await f.functions.draw(f.ctx,{sectionId,slide:8,epoch:'epoch',requestId:crypto.randomUUID()});
  assert.ok(selected.members.length<=12);assert.ok(selected.members.some(member=>member.id===selected.subject));
});

test('migrated MIS 311 slides contain no embedded wheel buttons in either access mode',()=>{
  const code=fs.readFileSync('course-content/mis311/Week7Session2.js','utf8');
  for(const teaching of [false,true]){
    const window=new Window();window.eiuLessonTeaching=teaching;const lesson={exports:{}};vm.runInNewContext(code,{module:lesson,document:window.document});
    for(const render of lesson.exports.slides){const slide=render();window.document.body.replaceChildren(slide);assert.equal(slide.querySelector('[data-spotlight-slide]'),null);const trigger=slide.querySelector('[data-persuasion-open=case]');if(trigger){trigger.click();assert.equal(slide.querySelector('[data-spotlight-slide]'),null);}}
    window.happyDOM.abort();
  }
});
