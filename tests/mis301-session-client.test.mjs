import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import {loadTS,practice,sectionId,deferred,tick} from './helpers/mis301-fixture.mjs';
function clientFixture(file, initialEpoch='old', initialSubject) {
 const window=new Window(), states=[], messages=[],requests=[];let epoch=initialEpoch, effect, watch, signal, authRefreshes=0;
 const frame={current:{dataset:{requestId:`${sectionId}:6`},contentWindow:{postMessage:message=>messages.push(message)}}};
 const identity={teaching:false,practiceSession:epoch,learner:{subject:initialSubject,name:'An',email:'an@example.test'},assignment:null,items:[]};
 let request=async url=>({ok:true,json:async()=>url.includes('/control')?{success:true,terminationToken:epoch}:{...identity,practiceSession:epoch}});
 const clear=(id,nextEpoch)=>{window.sessionStorage.removeItem(`eiu:mis301:notebook:v2:${id}`);window.dispatchEvent(new window.CustomEvent('eiu-section-terminated',{detail:{sectionId:id,epoch:nextEpoch}}));};
 const client={refreshRealtimeAuthentication:()=>{authRefreshes++;},watchClassroom:(_,callback)=>{watch=callback;return()=>{};},listenInteractive:(_,__,callback)=>{signal=callback;return()=>{};},realtimeReady:()=>true,drawClassroom:async()=>({}),resetClassroomDraw:async()=>({}),configureClassroomQuestions:async()=>({})};
 const bridgeModule=loadTS(file,{'react':{useEffect:callback=>{effect=callback();},useLayoutEffect:callback=>{effect=callback();},useState:value=>[value,next=>states.push(next)]},'@/lib/mis301Practice':practice,'@/lib/realtime/client':client,'./useMis301NotebookBridge':{clearMis301Notebook:clear}},
 {window,document:window.document,localStorage:window.localStorage,sessionStorage:window.sessionStorage,CustomEvent:window.CustomEvent,fetch:(...args)=>{requests.push(args[0]);return request(...args);},setInterval:()=>1,clearInterval:()=>{}});
 if(file.includes('useLesson'))bridgeModule.useLessonPracticeBridge(sectionId,frame);else{frame.current.dataset.requestId=`${sectionId}:5`;bridgeModule.useMis301NotebookBridge(sectionId,frame);}
 const emit=data=>window.dispatchEvent(new window.MessageEvent('message',{source:frame.current.contentWindow,data:{requestId:frame.current.dataset.requestId,...data}}));
 return {window,states,messages,requests,frame,emit,clear,remount(){effect?.();bridgeModule.useMis301NotebookBridge(sectionId,frame);},get authRefreshes(){return authRefreshes;},watch:value=>watch(value),signal:()=>signal?.(),setEpoch:value=>{epoch=value;},setRequest:value=>{request=value;},close:async()=>{effect?.();await window.happyDOM.close();}};
}
const live=(epoch,assignment={question:3,part:3,drawId:'draw',createdAt:1})=>({ready:true,teaching:false,practiceSession:epoch,assignment,items:[],members:[],draw:null});

test('Notebook loads and focus need no control requests or persistent storage',async()=>{
 const f=clientFixture('components/deck/useMis301NotebookBridge.ts');try{
 await tick();for(let i=0;i<3;i++){f.emit({type:'eiu-notebook-runtime',operation:'load',token:`load-${i}`});await tick();await tick();}
 f.window.dispatchEvent(new f.window.Event('focus'));await tick();
 assert.equal(f.requests.length,0);assert.equal(f.messages.filter(message=>message.type==='eiu-notebook-state').length,3);
 assert.equal(f.window.sessionStorage.getItem(`eiu:mis301:notebook:v2:${sectionId}`),null);
 }finally{await f.close();}
});

test('An old login token cannot pair another learner name with its assigned part',async()=>{
 const f=clientFixture('components/deck/useLessonPracticeBridge.ts','old','new-learner');
 try {
 await tick();await tick();
 f.watch({...live('old',{subject:'previous-learner',question:1,part:1,drawId:'draw',createdAt:1}),viewerSubject:'previous-learner'});
 await tick();await tick();
 assert.ok(f.states.every(state=>!state?.assignment));assert.equal(f.authRefreshes,1);
 f.watch({...live('old',{subject:'new-learner',question:2,part:2,drawId:'draw',createdAt:1}),viewerSubject:'new-learner'});
 assert.equal(f.states.at(-1).assignment.part,2);
 } finally { await f.close(); }
});

test('A stale classroom update cannot grant practice access in a newer verified section epoch',async()=>{
 const f=clientFixture('components/deck/useLessonPracticeBridge.ts','new');await tick();f.watch(live('old'));await tick();
 assert.ok(f.states.every(state=>!state?.assignment));f.watch(live('new'));assert.equal(f.states.at(-1).assignment.part,3);await f.close();
});
test('Terminate revokes access immediately and late old-room updates cannot restore it',async()=>{
 const f=clientFixture('components/deck/useLessonPracticeBridge.ts');await tick();f.watch(live('old'));assert.ok(f.states.at(-1).assignment);
 f.setEpoch('new');f.clear(sectionId,'new');assert.equal(f.states.at(-1).assignment,null);
 f.watch(live('old'));await tick();assert.equal(f.states.at(-1).assignment,null);
 assert.ok(f.messages.some(message=>message.type==='eiu-section-terminated'));await f.close();
});
test('An in-flight save response from before Terminate cannot be acknowledged in the new session',async()=>{
 const f=clientFixture('components/deck/useLessonPracticeBridge.ts');await tick();f.watch(live('old'));
 const save=deferred();f.setRequest(async(url,options)=>options?.method==='POST'?save.promise:{ok:true,json:async()=>({teaching:false,practiceSession:'new',assignment:null,items:[]})});
 f.emit({type:'eiu-practice-request',token:'saving',operation:'submit',partId:'explore',practiceSession:'old',drawId:'draw',values:{rows:'2089'}});await tick();
 f.setEpoch('new');f.clear(sectionId,'new');save.resolve({ok:true,json:async()=>({success:true,submittedAt:'old-response'})});await tick();await tick();
 const reply=f.messages.find(message=>message.token==='saving');assert.equal(reply.response.success,false);assert.equal(f.states.at(-1).assignment,null);await f.close();
});

test('Notebook state survives iframe navigation but an old session key cannot write after Terminate',async()=>{
 const f=clientFixture('components/deck/useMis301NotebookBridge.ts');await tick();
 const load=async token=>{f.emit({type:'eiu-notebook-runtime',operation:'load',token});await tick();await tick();return f.messages.find(message=>message.token===token)?.state;};
 const old=await load('first');assert.ok(old.sessionKey);
 const state={aliases:['pd'],files:['student_data.csv'],frames:[],execution:3,pages:[{page:5,selected:0,cells:[{index:0,code:'import pandas as pd',status:'Executed',executed:true,output:[]}]}]};
 f.emit({type:'eiu-notebook-runtime',operation:'save',sessionKey:old.sessionKey,state});assert.equal((await load('navigate')).execution,3);
 f.setEpoch('new');f.clear(sectionId,'new');const fresh=await load('after-terminate');assert.ok(fresh);assert.notEqual(fresh.sessionKey,old.sessionKey);assert.equal(fresh.execution,0);
 f.emit({type:'eiu-notebook-runtime',operation:'save',sessionKey:old.sessionKey,state});assert.equal((await load('late-save')).execution,0);
 assert.equal(f.window.sessionStorage.getItem(`eiu:mis301:notebook:v2:${sectionId}`),null);await f.close();
});
test('Notebook resets on section exit and pagehide, ignores legacy storage and stale or foreign edits',async()=>{
 const f=clientFixture('components/deck/useMis301NotebookBridge.ts');try{
 const load=async token=>{f.emit({type:'eiu-notebook-runtime',operation:'load',token});await tick();return f.messages.find(message=>message.token===token).state;};
 const first=await load('first');
 const state={aliases:['pd'],files:['student_data.csv'],frames:[],execution:2,pages:[{page:5,selected:0,cells:[{index:0,code:'original',status:'Executed',executed:true,output:[]}]}]};
 f.emit({type:'eiu-notebook-runtime',operation:'save',sessionKey:first.sessionKey,state});
 f.emit({type:'eiu-notebook-runtime',operation:'edit',sessionKey:first.sessionKey,index:0,code:'edited'});
 assert.equal((await load('edited')).pages[0].cells[0].code,'edited');
 f.emit({type:'eiu-notebook-runtime',operation:'edit',sessionKey:'wrong',index:0,code:'bad'});
 f.window.dispatchEvent(new f.window.MessageEvent('message',{source:{},data:{type:'eiu-notebook-runtime',operation:'edit',requestId:`${sectionId}:5`,sessionKey:first.sessionKey,index:0,code:'foreign'}}));
 assert.equal((await load('protected')).pages[0].cells[0].code,'edited');
 f.window.sessionStorage.setItem(`eiu:mis301:notebook:v2:${sectionId}`,JSON.stringify({state}));
 f.remount();const fresh=await load('reenter');
 assert.equal(fresh.execution,0);assert.equal(fresh.pages.length,0);assert.notEqual(fresh.sessionKey,first.sessionKey);
 assert.equal(f.window.sessionStorage.getItem(`eiu:mis301:notebook:v2:${sectionId}`),null);
 f.emit({type:'eiu-notebook-runtime',operation:'save',sessionKey:first.sessionKey,state});
 assert.equal((await load('stale')).execution,0);
 f.emit({type:'eiu-notebook-runtime',operation:'save',sessionKey:fresh.sessionKey,state});
 f.window.dispatchEvent(new f.window.Event('pagehide'));
 assert.equal((await load('back-forward')).execution,0);
 let reloads=0;
 Object.defineProperty(f.frame.current,'srcdoc',{get:()=>'<html>demo</html>',set:value=>{assert.equal(value,'<html>demo</html>');reloads++;},configurable:true});
 const resumed=new f.window.Event('pageshow');Object.defineProperty(resumed,'persisted',{value:true});
 f.window.dispatchEvent(resumed);assert.equal(reloads,1,'a restored browser page also replaces its stale notebook DOM');
 assert.equal(f.requests.length,0);
 }finally{await f.close();}
});


test('Removing a classroom cannot leave its previous assignment visible',async()=>{
 const f=clientFixture('components/deck/useLessonPracticeBridge.ts');await tick();f.watch(live('old'));assert.ok(f.states.at(-1).assignment);
 f.watch({...live('old'),ready:false});assert.equal(f.states.at(-1).assignment,null);await f.close();
});
