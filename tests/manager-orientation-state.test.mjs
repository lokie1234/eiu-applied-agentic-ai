import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';
function fixture(){
 const window=new Window({url:'https://lesson.test'});
 const store=loadTS('lib/lessonRevealState.ts',{}, {window,sessionStorage:window.sessionStorage,CustomEvent:window.CustomEvent});
 let cleanup,fetches=0;
 const hook=loadTS('components/deck/useLessonRevealBridge.ts',{react:{useLayoutEffect:effect=>{cleanup=effect();}},'@/lib/lessonRevealState':store},{window,fetch:()=>{fetches++;throw Error('No server call for visual animation state');}});
 const id=store.MANAGER_SECTION_ID,messages=[];
 const frame={current:{dataset:{requestId:`${id}:3`},contentWindow:{postMessage:message=>messages.push(structuredClone(message))}}};
 const emit=(data,source=frame.current.contentWindow)=>window.dispatchEvent(new window.MessageEvent('message',{source,data}));
 const mount=()=>hook.useLessonRevealBridge(id,frame);mount();
 return{store,window,id,frame,messages,emit,load(){emit({type:'eiu-orientation-load',requestId:`${id}:3`});},remount(){cleanup();mount();},fetches:()=>fetches,close(){cleanup();window.happyDOM.abort();}};
}
test('Manager orientation is claimed once, survives recreated slide frames and resets only for a new visit',()=>{
 const f=fixture();try{
  f.load();assert.equal(f.messages.at(-1).play,true);
  f.frame.current.contentWindow={postMessage:message=>f.messages.push(structuredClone(message))};
  f.load();assert.equal(f.messages.at(-1).play,false);
  const saved=f.store.getRevealSession(f.id);assert.equal(saved.state.orientationPlayed,true);
  f.store.saveRevealState(f.id,saved.epoch,{...f.store.emptyRevealState(),orientationPlayed:false});assert.equal(f.store.getRevealSession(f.id).state.orientationPlayed,true);
  f.store.resetLessonRevealState(f.id);f.load();assert.equal(f.messages.at(-1).play,true);
  f.remount();f.load();assert.equal(f.messages.at(-1).play,true);assert.equal(f.fetches(),0);
 }finally{f.close();}
});
test('Manager animation bridge rejects foreign sources, stale requests, different pages and terminated visits',()=>{
 const f=fixture();try{
  const load={type:'eiu-orientation-load',requestId:`${f.id}:3`};
  f.emit(load,{});f.emit({...load,requestId:`${f.id}:4`});f.emit({...load,requestId:'different:3'});assert.equal(f.messages.length,0);
  f.frame.current.dataset.requestId=`${f.id}:4`;f.emit(load);assert.equal(f.messages.length,0);
  f.frame.current.dataset.requestId=`${f.id}:3`;f.load();assert.equal(f.messages.at(-1).play,true);
  f.store.clearLessonRevealState(f.id);assert.equal(f.messages.at(-1).type,'eiu-section-terminated');
  const length=f.messages.length;f.load();assert.equal(f.messages.length,length);
  f.remount();f.load();assert.equal(f.messages.at(-1).play,true);
  assert.equal(f.store.validRevealState({...f.store.emptyRevealState(),orientationPlayed:'true'}),false);
 }finally{f.close();}
});
