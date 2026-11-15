import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';
const file='course-content/imported/86cae0a3-9ada-4e31-b4d4-c83f50cafaf6/b7bd6b13-c654-412b-badb-12853350e148/1066dca1-c75c-477b-bd53-5dec37fc7d5a.js';
function fixture(){const window=new Window(),store=loadTS('lib/mis311Presentation.ts',{}, {window}),id=store.MIS311_MODELLING_SECTION_ID,lessonModule={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:lessonModule,document:window.document,window,parent:window});const open=page=>{window.document.body.replaceChildren();window.eiuPresentationState={states:store.readMis311Presentation(id)};const root=lessonModule.exports.slides[page-1]();window.document.body.append(root);return root;};return {window,store,id,open};}
for(const exit of ['reset','unmount','terminate'])test(`course ${exit} clears all presentation state and prevents old-frame saves`,()=>{
 const {window,store,id,open}=fixture();for(const [active,page,state] of [[2,2,{treeOpen:true,scenarioOpen:true,processOpen:true,activeRole:2}],[2,3,{revealed:true,definitionOpen:true}],[3,4,{technique:3,view:1}],[5,6,{stage:4}],[6,7,{built:true}]])store.saveMis311PresentationState(id,active,page,state);
 let setup;const messages=[],frame={current:{dataset:{requestId:id+':6'},contentWindow:{postMessage:m=>messages.push(m)}}};
 const hook=loadTS('components/deck/useMis311PresentationBridge.ts',{'react':{useEffect:fn=>{setup=fn;}},'@/lib/mis311Presentation':store},{window});hook.useMis311PresentationBridge(id,frame);const cleanup=setup();
 if(exit==='reset')store.resetMis311Presentation();else if(exit==='unmount')cleanup();else window.dispatchEvent(new window.CustomEvent('eiu-section-terminated',{detail:{sectionId:id}}));
 window.dispatchEvent(new window.MessageEvent('message',{source:frame.current.contentWindow,data:{type:'eiu-presentation-state',requestId:id+':6',page:7,state:{built:true}}}));assert.equal(Object.keys(store.readMis311Presentation(id)).length,0);
 if(exit!=='unmount')assert.equal(messages.at(-1).type,'eiu-section-terminated');
 let root=open(2);assert.equal(root.querySelector('.mis311-org-toggle').getAttribute('aria-expanded'),'false');assert.equal(root.querySelector('.mis311-org-root').getAttribute('aria-expanded'),'false');assert.equal(root.querySelector('[data-mis311-process-model]'),null);
 root=open(3);assert.equal(root.querySelector('[role=tab][aria-selected=true]').textContent,'BPMN');assert.equal(root.querySelector('.mt-panel').dataset.view,'Example');root=open(4);assert.equal(root.querySelector('.bp-dialog').open,false);root=open(5);assert.equal(root.querySelector('[data-mis311-restaurant]').dataset.restaurantStage,'0');root=open(6);assert.equal(root.querySelector('.rs-viewport').hidden,true);assert.equal(root.querySelector('.rs-best-trigger').hidden,true);assert.equal(root.querySelectorAll('.rs-viewport svg').length,0);assert.equal(root.querySelectorAll('.rs-step-text').length,9);
 cleanup();window.happyDOM.abort();
});
test('technique views reuse native nodes and the swimlane is only constructed when requested',()=>{
 const {window,open}=fixture();let root=open(3);const example=root.querySelector('.mt-panel svg');root.querySelectorAll('.mt-view')[1].click();const notation=root.querySelector('.mt-notation');root.querySelector('#mis311-technique-uml').click();root.querySelector('#mis311-technique-bpmn').click();assert.equal(root.querySelector('.mt-panel svg'),example);root.querySelectorAll('.mt-view')[1].click();assert.equal(root.querySelector('.mt-notation'),notation);
 root=open(6);assert.equal(root.querySelectorAll('[data-restaurant-node]').length,0);root.querySelector('.rs-build').click();assert.equal(root.querySelectorAll('[data-restaurant-node]').length,9);const svg=root.querySelector('.rs-viewport svg');root.querySelector('.rs-build').click();assert.equal(root.querySelector('.rs-viewport svg'),svg);window.happyDOM.abort();
});
test('identical presentation updates avoid duplicate storage writes',()=>{
 const values=new Map();let writes=0;const window={localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes++;values.set(key,value);}}};const store=loadTS('lib/mis311Presentation.ts',{}, {window}),id=store.MIS311_MODELLING_SECTION_ID;store.saveMis311PresentationState(id,5,6,{stage:4});store.saveMis311PresentationState(id,5,6,{stage:4});store.saveMis311PresentationState(id,5,6,{stage:0});assert.equal(writes,1);
});


test('the self-contained Section 1 stays below its native-vector budget without timers or network loops',()=>{
 const code=fs.readFileSync(file,'utf8');assert.ok(Buffer.byteLength(code)<180000);assert.doesNotMatch(code,/\b(?:fetch|setTimeout|setInterval|requestAnimationFrame)\s*\(/);
});
