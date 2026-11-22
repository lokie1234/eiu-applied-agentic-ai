import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import {loadTS,tick,deferred} from './helpers/mis301-fixture.mjs';
const require=createRequire(import.meta.url),common=loadTS('lib/mis311Spotlight.ts'),sectionId=common.MIS311_SPOTLIGHT_SECTION_ID;
async function fixture(teaching=false,draws=[],options={}){
  let now=Date.now();const Clock=class extends Date{static now(){return now;}};let settingCount=options.count||1,targetSubjects=[];
  const window=new Window({url:'http://localhost/learn'});
  for(const name of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const {createRoot}=require('react-dom/client');
  const host=window.document.createElement('div'),frame=window.document.createElement('iframe');frame.dataset.requestId=`${sectionId}:7`;window.document.body.append(frame,host);
  const frameRef={current:frame},timers=new Map(),requests=[];let timerId=1000000,watch,ready,subscriptions=0,connected=true;
  const originalSet=window.setTimeout.bind(window),originalClear=window.clearTimeout.bind(window);
  window.setTimeout=(fn,delay,...args)=>{if(delay>=1000){const id=++timerId;timers.set(id,{fn,delay});return id;}return originalSet(()=>{now+=delay;fn(...args);},delay);};
  window.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else originalClear(id);};
  const snapshot={ready:true,teaching,epoch:'epoch',revision:10,viewerSubject:teaching?'teacher':'learner',members:teaching?[{id:'learner',username:'An'},{id:'other',username:'Binh'}]:[],draws};
  const fetch=async(url,options={})=>{
    requests.push({url,...options});
    if(options.method==='PUT'){settingCount=JSON.parse(options.body).count;targetSubjects=JSON.parse(options.body).targetSubjects||[];return Response.json({count:settingCount});}
    if(options.method==='POST'){
      const normal=()=>Response.json({draw:{requestId:JSON.parse(options.body).requestId,subject:'learner',username:'An',slide:JSON.parse(options.body).slide,createdAt:now,revealAt:now+1667},members:snapshot.members});
      return postHandler?postHandler(JSON.parse(options.body),normal):normal();
    }
    if(getHandler){const intercepted=getHandler(requests.filter(r=>r.method!=='POST').length);if(intercepted)return intercepted;}
    if(url.includes('settings=1'))return Response.json({epoch:'epoch',count:settingCount,targetSubjects,members:snapshot.members});
    return url.includes('context=1')?Response.json({epoch:'epoch',viewerSubject:snapshot.viewerSubject,teaching}):Response.json({epoch:'epoch',snapshot});
  };
  let postHandler=options.post,getHandler=options.get;
  const Component=loadTS('components/deck/SectionSpotlight.tsx',{
    '@/lib/realtime/client':{watchSpotlight:(_,cb)=>{subscriptions++;watch=cb;cb(snapshot);return()=>{};},watchRealtimeReady:cb=>{ready=cb;return()=>{};},realtimeReady:()=>connected},
    '@/lib/mis311Spotlight':common,'./SectionSpotlight.module.css':{__esModule:true,default:new Proxy({},{get:(_,name)=>String(name)})},
  },{window,document:window.document,sessionStorage:window.sessionStorage,fetch,Date:Clock,Error}).default;
  const root=createRoot(host);
  const flush=async()=>{await act(async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,15));});};
  await act(async()=>{const element=React.createElement(Component,{sectionId,frame:frameRef,controls:options.controls?{teaching}:undefined});root.render(options.strict?React.createElement(React.StrictMode,null,element):element);});await flush();
  return {window,root,frame,snapshot,requests,timers,flush,now,watch:value=>watch?.(value),subscriptions:()=>subscriptions,ready:value=>{connected=value;ready();},
    advance(ms){now+=ms;},
    async fire(delay){const item=[...timers].find(([,item])=>Math.abs(item.delay-delay)<100);assert.ok(item,`timer near ${delay}ms exists`);timers.delete(item[0]);now+=item[1].delay;await act(async()=>item[1].fn());await flush();},
    message(payload,source=frame.contentWindow){window.dispatchEvent(new window.MessageEvent('message',{source,data:payload}));},
    async close(){await act(async()=>root.unmount());window.happyDOM.abort();}
  };
}

test('toolbar controls choose the section-wide scope and settings allow counts above the former caps',async()=>{
  const f=await fixture(true,[],{controls:true,count:250});
  try{
    await act(async()=>f.window.document.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,0,'opening the wheel does not start a draw before settings can be changed');
    await act(async()=>f.window.document.querySelector('[aria-label="Class Spotlight settings"]').click());await f.flush();
    const settings=f.window.document.querySelector('[aria-labelledby=spotlight-settings-title]'),input=settings.querySelector('input[type=number]');assert.equal(settings.open,true);assert.equal(input.value,'250');assert.equal(input.getAttribute('max'),null);
    await act(async()=>settings.querySelector('.spin').click());await f.flush();assert.equal(settings.open,false);
    assert.equal(JSON.parse(f.requests.find(r=>r.method==='PUT').body).count,250);
    await act(async()=>f.window.document.querySelector('.hubTrigger').click());await f.flush();assert.equal(JSON.parse(f.requests.find(r=>r.method==='POST').body).slide,0);
    await act(async()=>f.window.document.querySelector('[aria-label="Close wheel"]').click());assert.equal(f.window.document.querySelector('[aria-labelledby=spotlight-title]').open,false);
  }finally{await f.close();}
});

test('Learning Access has no toolbar wheel or settings controls',async()=>{
  const f=await fixture(false,[],{controls:true});try{assert.equal(f.window.document.querySelector('[aria-label="Open Class Spotlight"]'),null);assert.equal(f.window.document.querySelector('[aria-label="Class Spotlight settings"]'),null);}finally{await f.close();}
});

test('settings remove demo and support enabling, saving, reopening and disabling multiple target names',async()=>{
 const f=await fixture(true,[],{controls:true});try{
  const doc=f.window.document;await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();const shell=doc.querySelector('.wheelWrap');const names=[...doc.querySelectorAll('.wheelSvg title')].map(n=>n.textContent);
  await act(async()=>doc.querySelector('[aria-label="Class Spotlight settings"]').click());await f.flush();const settings=doc.querySelector('[aria-labelledby=spotlight-settings-title]');assert.doesNotMatch(settings.textContent,/Demo|sample names/);
  await act(async()=>settings.querySelector('[aria-label="Target selection"]').click());const area=settings.querySelector('[aria-label="Target names"]');await act(async()=>area.querySelector('input').click());assert.equal(settings.querySelector('.spin').disabled,true);
  for(const input of area.querySelectorAll('.targetNames input'))await act(async()=>input.click());assert.equal(settings.querySelector('.spin').disabled,false);
  await act(async()=>settings.querySelector('.spin').click());await f.flush();const body=JSON.parse(f.requests.find(r=>r.method==='PUT').body);assert.deepEqual(body.targetSubjects,['learner','other']);assert.equal(body.count,2);
  await act(async()=>doc.querySelector('[aria-label="Class Spotlight settings"]').click());await f.flush();await act(async()=>settings.querySelector('[aria-label="Target selection"]').click());assert.equal(settings.querySelectorAll('.targetNames input:checked').length,2);
  await act(async()=>settings.querySelector('.targetSettings>label input').click());await act(async()=>settings.querySelector('.spin').click());await f.flush();assert.deepEqual(JSON.parse(f.requests.filter(r=>r.method==='PUT').at(-1).body).targetSubjects,[]);
  await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();assert.equal(doc.querySelector('.wheelWrap'),shell,'the wheel shell is not remounted when a server result arrives');assert.deepEqual([...doc.querySelectorAll('.wheelSvg title')].map(n=>n.textContent),names,'loaded names stay in the same sectors');
 }finally{await f.close();}
});

test('a delayed draw response shortens the admin animation to the shared learner deadline',async()=>{
  const pending=deferred();
  const f=await fixture(true,[],{controls:true,post:()=>pending.promise});
  try{
    const doc=f.window.document;
    await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
    await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();
    const body=JSON.parse(f.requests.find(r=>r.method==='POST').body);
    f.advance(600);
    await act(async()=>pending.resolve(Response.json({draw:{...body,subject:'learner',username:'An',createdAt:f.now,revealAt:f.now+1667},members:f.snapshot.members})));await f.flush();
    assert.equal(doc.querySelector('.wheel').style.animationDuration,'1067ms');
    await f.fire(1067);
    assert.equal(doc.querySelector('.nameText').textContent,'An');
  }finally{await f.close();}
});

test('an already revealed draw catches up immediately instead of adding another spin',async()=>{
  const f=await fixture(true,[],{controls:true,post:(body)=>Response.json({draw:{...body,subject:'learner',username:'An',createdAt:Date.now()-10000,revealAt:Date.now()-3000},members:[]})});
  try{
    const doc=f.window.document;
    await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
    await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();
    assert.equal(doc.querySelector('.nameText').textContent,'An');
    assert.equal([...f.timers.values()].some(t=>t.delay===1667),false);
  }finally{await f.close();}
});

test('a selected learner opens at their scheduled reveal without an extra five-second wait',async()=>{
  const f=await fixture();
  try{
    const selected={requestId:crypto.randomUUID(),slide:0,subject:'learner',username:'An',createdAt:f.now,revealAt:f.now+1667};
    await act(async()=>f.watch({...f.snapshot,draws:[selected]}));await f.flush();
    assert.equal(f.window.document.querySelector('.congrat').open,false);
    await f.fire(1667);
    assert.equal(f.window.document.querySelector('.congrat').open,true);
  }finally{await f.close();}
});
test('only the selected signed session sees congratulations, which closes after ten seconds without moving its slide',async()=>{
  const selection={requestId:crypto.randomUUID(),slide:5,subject:'learner',username:'An',createdAt:Date.now(),revealAt:Date.now()-1};
  const f=await fixture(false,[selection]);
  try{
    assert.equal(f.window.document.querySelector('.congrat').open,true);
    assert.equal(f.window.document.querySelector('#spotlight-congrat').textContent,'Congrat!!!!!');
    assert.match(f.window.document.querySelector('.congrat').textContent,/Please answer the question/);
    assert.equal(f.frame.dataset.requestId,`${sectionId}:7`,'selection on slide 5 never navigates the learner away from their current slide');
    let navigationKeys=0;const navigation=()=>{navigationKeys++;};f.window.addEventListener('keydown',navigation);
    f.window.document.querySelector('.congrat button').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    assert.equal(navigationKeys,0,'modal keys cannot navigate the slide behind the congratulation dialog');
    assert.equal([...f.timers.values()].filter(timer=>timer.delay===10000).length,1);
    await f.fire(10000);assert.equal(f.window.document.querySelector('.congrat').open,false);
    f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(navigationKeys,1,'keyboard navigation resumes after auto-close');f.window.removeEventListener('keydown',navigation);
    assert.equal(f.frame.dataset.requestId,`${sectionId}:7`);
    await act(async()=>f.watch({...f.snapshot}));await f.flush();assert.equal(f.window.document.querySelector('.congrat').open,false,'the same draw is not shown again');
  }finally{await f.close();}
});
test('wrong viewers, stale epochs and other learners never get a winner popup; termination cancels it',async()=>{
  const selection={requestId:crypto.randomUUID(),slide:7,subject:'other',username:'Same name',createdAt:Date.now(),revealAt:Date.now()-1};
  const f=await fixture(false,[selection]);
  try{
    assert.equal(f.window.document.querySelector('.congrat').open,false);
    for(const override of [{epoch:'old'},{viewerSubject:'other'},{teaching:true}]){await act(async()=>f.watch({...f.snapshot,...override,draws:[{...selection,subject:'learner'}]}));await f.flush();assert.equal(f.window.document.querySelector('.congrat').open,false);}
    await act(async()=>f.watch({...f.snapshot,draws:[{...selection,subject:'learner'}]}));await f.flush();assert.equal(f.window.document.querySelector('.congrat').open,true);
    await act(async()=>f.window.dispatchEvent(new f.window.CustomEvent('eiu-section-terminated',{detail:{sectionId}})));
    assert.equal(f.window.document.querySelector('.congrat').open,false);
    await act(async()=>f.watch({...f.snapshot,draws:[{...selection,requestId:crypto.randomUUID(),subject:'learner'}]}));await f.flush();assert.equal(f.window.document.querySelector('.congrat').open,false);
  }finally{await f.close();}
});
test('a new selection of the same learner restarts the ten-second display from the new result',async()=>{
  const selection={requestId:crypto.randomUUID(),slide:5,subject:'learner',username:'An',createdAt:Date.now(),revealAt:Date.now()-1};
  const f=await fixture(false,[selection]);
  try{
    const first=[...f.timers.keys()];
    await act(async()=>f.watch({...f.snapshot,draws:[{...selection,requestId:crypto.randomUUID(),createdAt:Date.now()+1}]}));await f.flush();
    assert.equal(f.window.document.querySelector('.congrat').open,true);
    assert.equal([...f.timers.values()].filter(timer=>timer.delay===10000).length,1);
    assert.ok(![...f.timers.keys()].some(id=>first.includes(id)),'the earlier auto-close timer was cancelled');
    await f.fire(10000);assert.equal(f.window.document.querySelector('.congrat').open,false);
  }finally{await f.close();}
});
test('wheel messages must match the current iframe and slide; teachers can reroll after a completed spin',async()=>{
  const f=await fixture(true);
  try{
    const message={type:'eiu-spotlight-open',requestId:`${sectionId}:5`,slide:5};
    for(const invalid of [{...message,requestId:`${sectionId}:7`},{...message,requestId:`${sectionId}:6`,slide:6}]){f.message(invalid);await f.flush();}
    f.message(message,f.window);await f.flush();assert.equal(f.requests.filter(r=>r.method==='POST').length,0);
    f.frame.dataset.requestId=`${sectionId}:5`;await act(async()=>f.message(message));await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.window.document.querySelector('.dialog').open,true);
    assert.equal(f.window.document.querySelector('.result').textContent,'Spinning…');assert.equal(f.window.document.querySelector('.hubTrigger').disabled,false,'STOP stays available while spinning');
    await f.fire(1667);assert.equal(f.window.document.querySelector('.nameText').textContent,'An');assert.equal(f.window.document.querySelector('.hubTrigger').disabled,false);
    await act(async()=>f.window.document.querySelector('.hubTrigger').click());await f.flush();assert.equal(f.requests.filter(r=>r.method==='POST').length,2);
    const ids=f.requests.filter(r=>r.method==='POST').map(r=>JSON.parse(r.body).requestId);assert.notEqual(ids[0],ids[1]);
    await act(async()=>f.window.document.querySelector('[aria-label="Close wheel"]').click());assert.equal(f.window.document.querySelector('.dialog').open,false);
  }finally{await f.close();}
});
test('slide 10 case-study requests use the same parent wheel and still reject learner attempts',async()=>{
  for(const teaching of [true,false]){
    const f=await fixture(teaching);
    try{
      f.frame.dataset.requestId=`${sectionId}:10`;
      await act(async()=>f.message({type:'eiu-spotlight-open',requestId:`${sectionId}:10`,slide:10}));await f.flush();
      const posts=f.requests.filter(r=>r.method==='POST');assert.equal(posts.length,teaching?1:0);
      if(teaching){assert.equal(JSON.parse(posts[0].body).slide,10);await f.fire(1667);assert.equal(f.window.document.querySelector('.nameText').textContent,'An');await act(async()=>f.window.document.querySelector('[aria-label="Close wheel"]').click());assert.equal(f.window.document.querySelector('.dialog').open,false);}
    }finally{await f.close();}
  }
});

test('rapid clicks and reopening an in-progress spin do not create overlapping requests or erase its result',async()=>{
  const pending=deferred();let finish;
  const f=await fixture(true,[],{post:(_,normal)=>{finish=()=>pending.resolve(normal());return pending.promise;}});
  try{
    f.frame.dataset.requestId=`${sectionId}:5`;const message={type:'eiu-spotlight-open',requestId:`${sectionId}:5`,slide:5};
    await act(async()=>{for(let i=0;i<30;i++)f.message(message);});await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.subscriptions(),0,'teacher UI does not subscribe to an unused live roster');
    await act(async()=>f.window.document.querySelector('[aria-label="Close wheel"]').click());
    await act(async()=>f.message(message));await f.flush();assert.equal(f.window.document.querySelector('.dialog').open,true);
    await act(async()=>finish());await f.flush();
    await act(async()=>{for(let i=0;i<30;i++)f.message(message);});await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.window.document.querySelector('.result').textContent,'Spinning…');
    await f.fire(1667);assert.equal(f.window.document.querySelector('.nameText').textContent,'An');
  }finally{pending.resolve(Response.json({}));await f.close();}
});
test('a network retry reuses the original draw ID; a deliberately new round gets a different ID',async()=>{
  let posts=0;const f=await fixture(true,[],{post:(_,normal)=>{if(++posts===1)throw Error('Network interrupted');return normal();}});
  try{
    const message={type:'eiu-spotlight-open',requestId:`${sectionId}:7`,slide:7};await act(async()=>f.message(message));await f.flush();
    assert.match(f.window.document.querySelector('.status').textContent,/Network interrupted/);
    await act(async()=>f.window.document.querySelector('.hubTrigger').click());await f.flush();
    const ids=()=>f.requests.filter(r=>r.method==='POST').map(r=>JSON.parse(r.body).requestId);
    assert.equal(ids().length,2);assert.equal(ids()[0],ids()[1]);
    await f.fire(1667);await act(async()=>f.window.document.querySelector('.hubTrigger').click());await f.flush();
    assert.notEqual(ids()[1],ids()[2]);
  }finally{await f.close();}
});
test('a click during initial authorization waits for the existing lookup and starts exactly one draw',async()=>{
  const access=deferred();const f=await fixture(true,[],{get:count=>count===1?access.promise:undefined});
  try{
    const message={type:'eiu-spotlight-open',requestId:`${sectionId}:7`,slide:7};await act(async()=>{for(let i=0;i<10;i++)f.message(message);});await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,0);assert.equal(f.requests.length,1);
    await act(async()=>access.resolve(Response.json({epoch:'epoch',viewerSubject:'teacher',teaching:true})));await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.window.document.querySelector('.result').textContent,'Spinning…');
  }finally{access.resolve(Response.json({}));await f.close();}
});
test('older snapshots cannot replace a newer winner and repeated focus updates are coalesced',async()=>{
  const f=await fixture(false);
  try{
    const selected={requestId:crypto.randomUUID(),subject:'learner',username:'Fresh',slide:7,createdAt:f.now,revealAt:f.now-1};
    await act(async()=>f.watch({...f.snapshot,revision:30,draws:[selected]}));await f.flush();
    await act(async()=>f.watch({...f.snapshot,revision:20,draws:[{...selected,requestId:crypto.randomUUID(),username:'Old'}]}));await f.flush();
    assert.equal(f.window.document.querySelector('.name').textContent,'Fresh');
    const reads=f.requests.length;await act(async()=>{for(let i=0;i<100;i++)f.window.dispatchEvent(new f.window.Event('focus'));});await f.flush();
    assert.equal(f.requests.length,reads+1);assert.equal(f.subscriptions(),1);assert.equal(f.window.document.querySelector('.name').textContent,'Fresh');
    assert.equal([...f.timers.values()].filter(timer=>timer.delay===10000).length,1);
  }finally{await f.close();}
});
test('a late unauthorized response from a disposed Strict Mode effect cannot clear the active session',async()=>{
  const old=deferred(),selection={requestId:crypto.randomUUID(),subject:'learner',username:'An',slide:7,createdAt:Date.now(),revealAt:Date.now()-1};
  const f=await fixture(false,[selection],{strict:true,get:count=>count===1?old.promise:undefined});
  try{
    assert.equal(f.window.document.querySelector('.congrat').open,true);
    await act(async()=>old.resolve(Response.json({message:'Old denial'},{status:403})));await f.flush();
    assert.equal(f.window.document.querySelector('.congrat').open,true);assert.equal(f.subscriptions(),1);
  }finally{old.resolve(Response.json({}));await f.close();}
});

test('the supplied SVG design uses the server winner, a stationary gold bezel and an accessible center trigger',async()=>{
  const f=await fixture(true,[],{controls:true});
  try{
    await act(async()=>f.window.document.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
    const svg=f.window.document.querySelector('.wheelSvg');
    assert.equal(svg.getAttribute('viewBox'),'0 0 500 500');
    assert.equal(svg.querySelector('linearGradient stop').getAttribute('stop-color'),'#F4DFB0');
    assert.equal(svg.querySelector('.wheel'),null,'opening displays an idle wheel');
    assert.deepEqual([...svg.querySelectorAll('title')].map(n=>n.textContent),['An','Binh'],'the idle wheel loads signed learner names on demand');
    assert.equal(f.window.document.querySelector('textarea'),null,'the lesson does not acquire a manual roster');
    await act(async()=>{const center=f.window.document.querySelector('[aria-label="Spin wheel"]');center.click();center.click();});await f.flush();
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
    const rotor=f.window.document.querySelector('.wheel');
    assert.equal(rotor.tagName.toLowerCase(),'g','only segments rotate, leaving the supplied bezel and hub stationary');
    assert.match(rotor.getAttribute('style'),/2430deg/,'the pointer lands at the middle of the server-selected An sector');
    assert.deepEqual([...rotor.querySelectorAll('title')].map(n=>n.textContent),['An','Binh']);
    await f.fire(1667);
    assert.equal(f.window.document.querySelector('.nameText').textContent,'An');
  }finally{await f.close();}
});

test('multi-spin sequentially selects one learner per spin with flexible adaptive layout tiers',async()=>{
 const f=await fixture(true,[],{controls:true,count:3,post:async(body,normal)=>Response.json({draw:{...(await normal().json()).draw,targets:[{subject:'learner',username:'An'},{subject:'other',username:'Binh'},{subject:'third',username:'Chi'}]},members:[{id:'learner',username:'An'},{id:'other',username:'Binh'},{id:'third',username:'Chi'}]})});
 try{
  const doc=f.window.document;
  await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
  await act(async()=>doc.querySelector('[aria-label="Class Spotlight settings"]').click());await f.flush();
  const settings=doc.querySelector('[aria-labelledby=spotlight-settings-title]');
  const input=settings.querySelector('input[type=number]');
  input.value='3';
  await act(async()=>input.dispatchEvent(new f.window.Event('change')));await f.flush();
  await act(async()=>settings.querySelector('.spin').click());await f.flush();
  // Click SPIN
  await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();
  assert.equal(doc.querySelectorAll('.targets li').length,0,'0 results before spin 1 finishes');
  // First spin ends
  await f.fire(1667);
  assert.equal(doc.querySelectorAll('.targets li').length,1,'1 result after spin 1');
  assert.equal(doc.querySelector('.targets').getAttribute('data-tier'),'few','three names use the larger independent-card tier');
  // Pause between spin 1 and spin 2
  await act(async()=>new Promise(resolve=>setTimeout(resolve,260)));await f.flush();
  // Second spin ends
  await f.fire(1667);
  assert.equal(doc.querySelectorAll('.targets li').length,2,'2 results after spin 2');
  // Pause between spin 2 and spin 3
  await act(async()=>new Promise(resolve=>setTimeout(resolve,260)));await f.flush();
  // Third spin ends
  await f.fire(1667);
  assert.equal(doc.querySelectorAll('.targets li').length,3,'all 3 results revealed sequentially');
  // Verify card structure and text fitting
  const items=doc.querySelectorAll('.targets li');
  assert.equal(items.length,3);
  for(let i=0;i<3;i++){
    const badge=items[i].querySelector('.nameBadge');
    assert.ok(items[i].classList.contains('nameCard'));
    assert.ok(items[i].classList.contains('nameReveal'));
    assert.equal(badge.textContent,String(i+1));
    const text=items[i].querySelector('.nameText');
    assert.ok(text.textContent.length>0);
    assert.equal(text.getAttribute('title'),text.textContent);
  }
  assert.equal(doc.querySelector('.hubTrigger').disabled,false,'spin again is enabled when done');
  const stationaryRotor=doc.querySelector('.wheelSvg .wheelStationary');
  assert.ok(stationaryRotor,'wheel rotor remains mounted with wheelStationary class after spin finishes');
  assert.equal(doc.querySelector('.wheelSvg .wheel'),null,'wheel rotor is no longer in spinning animation state');
  assert.equal(stationaryRotor.querySelectorAll('title').length,3,'all 40 names remain intact on the wheel after spinning completes');

  // Closing and reopening popup does NOT spin the wheel again
  await act(async()=>doc.querySelector('[aria-label="Close wheel"]').click());await f.flush();
  assert.equal(doc.querySelector('[aria-labelledby=spotlight-title]').open,false);
  await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
  assert.equal(doc.querySelector('[aria-labelledby=spotlight-title]').open,true);
  // Rotor does NOT have spinning animation class, is stationary at winner
  assert.equal(doc.querySelector('.wheelSvg .wheel'),null,'wheel is stationary on reopen without re-spinning');
  const reopenedRotor=doc.querySelector('.wheelSvg .wheelStationary');
  assert.ok(reopenedRotor,'wheel rotor remains mounted with wheelStationary on reopen');
  assert.equal(reopenedRotor.querySelectorAll('title').length,3,'names on wheel stay intact on reopen');
  assert.equal(doc.querySelectorAll('.targets li').length,3,'results remain fully displayed on reopen');
  assert.equal(doc.querySelector('.hubTrigger').getAttribute('aria-label'),'Spin wheel');
  assert.equal(doc.querySelector('.wheelLayout .spin'),null,'no separate Spin again button');
  assert.equal(doc.querySelector('.hubTrigger').disabled,false);
 }finally{await f.close();}
});

test('the center STOP freezes the wheel and cancels every remaining name reveal',async()=>{
 const f=await fixture(true,[],{controls:true,count:3,post:async(body,normal)=>Response.json({draw:{...(await normal().json()).draw,targets:[{subject:'learner',username:'An'},{subject:'other',username:'Binh'},{subject:'third',username:'Chi'}]},members:[{id:'learner',username:'An'},{id:'other',username:'Binh'},{id:'third',username:'Chi'}]})});
 try{
  const doc=f.window.document;
  await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
  await act(async()=>doc.querySelector('[aria-label="Class Spotlight settings"]').click());await f.flush();
  const settings=doc.querySelector('[aria-labelledby=spotlight-settings-title]');
  await act(async()=>settings.querySelector('.spin').click());await f.flush();
  await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();
  const before=[...doc.querySelectorAll('.wheelSvg title')].map(n=>n.textContent);
  assert.ok(doc.querySelector('[aria-label="Stop wheel"]'));assert.equal(doc.querySelector('.wheelLayout .spin'),null);
  await act(async()=>doc.querySelector('[aria-label="Stop wheel"]').click());await f.flush();
  assert.equal(doc.querySelector('.wheel'),null,'animation stops immediately');
  assert.equal(doc.querySelectorAll('.targets li').length,0,'STOP before the first reveal adds no names');
  assert.equal([...f.timers.values()].filter(t=>Math.abs(t.delay-1667)<10).length,0,'old spin timer was cancelled');
  await act(async()=>new Promise(r=>setTimeout(r,500)));await f.flush();
  assert.equal(doc.querySelectorAll('.targets li').length,0,'no delayed names appear after STOP');assert.equal(doc.querySelector('.hubTrigger').disabled,false);
  await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();
  await f.fire(1667);
  assert.equal(doc.querySelectorAll('.targets li').length,1);
  await act(async()=>new Promise(r=>setTimeout(r,260)));await f.flush();
  await act(async()=>doc.querySelector('[aria-label="Stop wheel"]').click());await f.flush();
  await act(async()=>new Promise(r=>setTimeout(r,500)));await f.flush();
  assert.equal(doc.querySelectorAll('.targets li').length,1,'STOP during a later spin preserves only previously revealed cards');
  assert.deepEqual([...doc.querySelectorAll('.wheelSvg title')].map(n=>n.textContent),before);
  assert.equal(f.requests.filter(r=>r.method==='POST').length,2);
 }finally{await f.close();}
});
test('STOP during an in-flight draw waits for the same server result and never cancels or repeats the mutation',async()=>{
 const pending=deferred();let finish;
 const f=await fixture(true,[],{controls:true,post:(_,normal)=>{finish=()=>pending.resolve(normal());return pending.promise;}});
 try{
  const doc=f.window.document;
  await act(async()=>doc.querySelector('[aria-label="Open Class Spotlight"]').click());await f.flush();
  await act(async()=>doc.querySelector('[aria-label="Spin wheel"]').click());await f.flush();
  await act(async()=>doc.querySelector('[aria-label="Stop wheel"]').click());await f.flush();
  assert.equal(doc.querySelector('.hubTrigger').disabled,true);
  assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  await act(async()=>finish());await f.flush();
  assert.equal(doc.querySelector('.nameText'),null,'a late server response cannot reveal a name after STOP');assert.equal(doc.querySelector('.wheel'),null);
  assert.equal(doc.querySelector('.hubTrigger').disabled,false);
  assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
 }finally{pending.resolve(Response.json({}));await f.close();}
});
