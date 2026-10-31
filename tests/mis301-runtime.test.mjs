import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {Window} from 'happy-dom';
import {loadTS,practice,sectionId,tick} from './helpers/mis301-fixture.mjs';
const documents=loadTS('lib/tsxDocument.ts');
const compiled=fs.readFileSync('course-content/mis301/PandasPracticePart2.js','utf8');
function lesson(page,teaching=false,allowed=true,part=3) {
 const window=new Window({url:'https://example.test'}), messages=[],downloads=[],urls=new Map(),timers=new Map();let id=0;
 window.document.body.innerHTML='<div id="root"></div>';
 window.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,blob:urls.get(this.href)});};
 const context={success:true,teaching,ready:true,practiceSession:'current',learner:{name:'An',email:'an@example.test'},members:[],items:[],draw:null,questionSetup:JSON.parse(JSON.stringify(practice.MIS301_QUESTION_DEFAULTS)),assignment:teaching?null:{part,question:part,drawId:'round',createdAt:0,config:practice.MIS301_QUESTION_DEFAULTS[part-1]}};
 const parent={postMessage(message){
  messages.push(message);
  if(message.type==='eiu-practice-request')queueMicrotask(()=>window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-practice-response',requestId:message.requestId,token:message.token,response:context}})));
  if(message.type==='eiu-notebook-runtime'&&message.operation==='load')queueMicrotask(()=>window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-notebook-state',requestId:message.requestId,token:message.token,state:{aliases:[],files:[],frames:[],execution:0,pages:[],sessionKey:'test'}}})));
 }};
 const Timeout=(callback,delay=0)=>{const token=++id;timers.set(token,true);if(delay<=2000)queueMicrotask(()=>{if(timers.get(token)){timers.delete(token);callback();}});return token;};
 const script=documents.createTsxDocument(compiled,page,'','',`${sectionId}:${page}`,teaching,allowed,context.assignment?.drawId||'').match(/<script>([\s\S]*?)<\/script>/)[1];
 const globals={window,document:window.document,Node:window.Node,parent,Event:window.Event,crypto:globalThis.crypto,console,TextEncoder,Blob:globalThis.Blob,Response:globalThis.Response,DecompressionStream:globalThis.DecompressionStream,Uint8Array,atob,btoa,URL:{createObjectURL:blob=>{const url=`blob:https://example.test/${urls.size}`;urls.set(url,blob);return url;},revokeObjectURL:url=>urls.delete(url)},setTimeout:Timeout,clearTimeout:token=>timers.delete(token),matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>1},getComputedStyle:node=>window.getComputedStyle(node),Date};
 vm.runInNewContext(script,globals);
 return {window,messages,downloads,context,publish(snapshot){window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-classroom-state',requestId:`${sectionId}:${page}`,snapshot}}));},async ready(){await tick();await tick();},terminate(){window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-section-terminated',requestId:`${sectionId}:${page}`}}));},async close(){timers.clear();await window.happyDOM.close();}};
}
function code(cell,source,window){const input=cell.querySelector('textarea');input.value=source;input.dispatchEvent(new window.Event('input',{bubbles:true}));cell.querySelector('.run').click();}

test('Slide 6 uses real learners only and automatically matches questions and closes setup with CSS hiding intact',async()=>{
 const f=lesson(6,true);try {
 await f.ready();const doc=f.window.document;
 assert.equal(doc.querySelector('#error'),null);
 assert.doesNotMatch(doc.querySelector('.wheel-arena').textContent,/Demo|DEMO/);
 assert.match(doc.querySelector('.wheel-toolbar small').textContent,/0 signed-in learners/);
 assert.equal(doc.querySelector('.wheel-hub').disabled,true);
 const dialog=doc.querySelector('.question-dialog');
 assert.equal(doc.querySelector('.wheel-setting'),null);
 assert.equal(doc.querySelector('.wheel-toolbar input'),null);
 assert.equal(f.window.getComputedStyle(dialog).display,'none');
 f.context.members=[{id:'real-session',username:'Real learner'}];f.publish(f.context);
 assert.match(doc.querySelector('.wheel-disc').textContent,/Real learner/);
 assert.equal(doc.querySelector('.wheel-hub').disabled,false);
 f.context.members=Array.from({length:20},(_,index)=>({id:`learner-${index}`,username:`Learner ${index}`}));f.publish(f.context);
 const setup=[...doc.querySelectorAll('.wheel-actions button')].find(button=>button.textContent==='7-part setup');
 setup.click();await f.ready();assert.notEqual(f.window.getComputedStyle(dialog).display,'none');
 dialog.querySelector('.question-close').click();assert.equal(f.window.getComputedStyle(dialog).display,'none');
 setup.click();await f.ready();dialog.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(f.window.getComputedStyle(dialog).display,'none');
 }finally{await f.close();}
});

test('Role-aware lesson counts remain 5 unselected / 6 selected / 7 teaching after cleanup',async()=>{
 for(const [teaching,allowed,count]of[[false,false,5],[false,true,6],[true,true,7]]){const f=lesson(null,teaching,allowed);assert.equal(f.messages.find(item=>item.type==='eiu-tsx-ready').slides,count);await f.close();}
});

test('Wheel and admin use the persisted part map, including when a draw is restored',async()=>{
 for(const page of [6,7]){
 const f=lesson(page,true);try{await f.ready();
 const draw={requestId:'explicit-round',assignmentVersion:3,names:['An','Binh'],subjects:['a','b'],parts:[6,4],createdAt:1,questions:f.context.questionSetup};
 f.publish({...f.context,members:[{id:'a',username:'An'},{id:'b',username:'Binh'}],draw});await f.ready();
 const doc=f.window.document;
 if(page===6){assert.deepEqual([...doc.querySelectorAll('.question-number')].map(node=>node.textContent),['Part 6','Part 4']);assert.equal(doc.querySelector('.wheel-hub').disabled,true);}
 else{const cards=doc.querySelectorAll('.question-monitor-card');assert.equal(cards[5].querySelector('.question-assigned-names').textContent,'An');assert.equal(cards[3].querySelector('.question-assigned-names').textContent,'Binh');}
 }finally{await f.close();}}
});

test('Every assigned part can submit, with clear validation instead of an unclickable button',async()=>{
 for(let part=1;part<=7;part++){
 const f=lesson(6,false,true,part);try{await f.ready();const doc=f.window.document,form=doc.querySelector('.question-answer-form'),send=form.querySelector('.question-send');
 assert.equal(send.type,'button');assert.equal(form.tagName,'DIV');assert.equal(send.disabled,false);send.click();await f.ready();
 assert.match(doc.querySelector('.question-save-status[data-error="true"]').textContent,/Enter your code/);
 assert.equal(f.messages.filter(message=>message.operation==='submit').length,0);
 doc.querySelectorAll('.stacked-code-cell textarea').forEach((input,index)=>{input.value=part===1?['import pandas as pd','data = pd.read_csv("happiness_survey_data.csv")','df = data'][index]:'df';input.dispatchEvent(new f.window.Event('input'));});
 for(const input of form.querySelectorAll('input')){input.value='6';input.dispatchEvent(new f.window.Event('input'));}
 assert.equal(send.disabled,false);send.click();await f.ready();
 const sent=f.messages.find(message=>message.operation==='submit');assert.ok(sent,`Part ${part} submits`);
 assert.equal(sent.drawId,'round');assert.equal(sent.practiceSession,'current');
 assert.deepEqual(Object.keys(sent.values).sort(),[...practice.MIS301_QUESTION_FIELDS[part].fields].sort());
 }finally{await f.close();}}
});

test('Admin receives the submitted answer for the signed subject, assignment part and draw',async()=>{
 const f=lesson(7,true);try{await f.ready();
 const draw={requestId:'real-round',assignmentVersion:2,subjects:['learner'],names:['An'],createdAt:1,questions:f.context.questionSetup};
 f.publish({...f.context,draw});
 f.window.document.querySelector('.question-monitor-card').click();await f.ready();
 const values={code:'import pandas as pd',readCode:'data = pd.read_csv("happiness_survey_data.csv")',storeCode:'df = data'};
 f.publish({...f.context,draw,items:[{id:'answer-1',subject:'learner',assignmentPart:1,drawId:draw.requestId,partId:'import',values,submittedAt:new Date().toISOString()}]});
 const doc=f.window.document,popup=doc.querySelector('.question-dialog:not([hidden])');
 assert.match(doc.querySelector('.question-response-count').textContent,/1 \/ 1 submitted/);
 assert.match(popup.querySelector('.question-save-status').textContent,/Live answer/);
 assert.deepEqual([...popup.querySelectorAll('.stacked-code-cell textarea')].map(input=>input.value),Object.values(values));
 }finally{await f.close();}
});
test('Every part opens all of its code cells together; no legacy import dashboard or answer key is rendered',async()=>{
 const f=lesson(7,true);await f.ready();assert.equal(f.window.document.querySelectorAll('.question-monitor-card').length,7);
 for(let index=0;index<7;index++){
  f.window.document.querySelectorAll('.question-monitor-card')[index].click();await f.ready();
  const popup=f.window.document.querySelector('.question-dialog:not([hidden])');assert.ok(popup);
  assert.equal(popup.querySelectorAll('.stacked-code-cell').length,index===0?3:index===1?2:1);popup.querySelector('.question-close').click();
 }
 assert.equal(f.window.document.querySelector('.practice-part-status'),null);assert.equal(f.window.document.querySelector('details'),null);await f.close();
});
test('CSV import cells share Python bindings and use the bundled happiness data',async()=>{
 const f=lesson(6,false,true,1);await f.ready();const cells=f.window.document.querySelectorAll('.stacked-code-cell');assert.equal(cells.length,3);
 code(cells[0],'import pandas as pd',f.window);await f.ready();code(cells[1],'data = pd.read_csv("happiness_survey_data.csv")',f.window);await f.ready();code(cells[2],'df = data\ndf',f.window);await f.ready();
 assert.match(cells[2].textContent,/2089 rows/);assert.match(cells[2].textContent,/6 columns/);assert.equal(cells[2].querySelectorAll('tbody tr').length,10);await f.close();
});
test('The exploration part shows first 10 and last 5 rows without losing shared df',async()=>{
 const f=lesson(6,false,true,2);await f.ready();const cells=f.window.document.querySelectorAll('.stacked-code-cell');assert.equal(cells.length,2);
 code(cells[0],'df.head(10)',f.window);await f.ready();code(cells[1],'df.tail(5)',f.window);await f.ready();
 assert.equal(cells[0].querySelectorAll('tbody tr').length,10);assert.equal(cells[1].querySelectorAll('tbody tr').length,5);assert.equal(cells[1].querySelector('tbody tr :first-child').textContent,'2084');await f.close();
});
test('Terminate removes the active assignment and prevents cached detached forms from submitting',async()=>{
 const f=lesson(6,false,true,3);await f.ready();const cell=f.window.document.querySelector('.stacked-code-cell');code(cell,'df.shape',f.window);await f.ready();assert.match(cell.textContent,/2089, 6/);
 const form=f.window.document.querySelector('.question-answer-form');for(const input of form.querySelectorAll('input')){input.value='6';input.dispatchEvent(new f.window.Event('input'));}
 const before=f.messages.filter(item=>item.operation==='submit').length;f.terminate();form.querySelector('.question-send').click();await f.ready();
 assert.equal(f.window.document.querySelector('.question-dialog'),null);assert.match(f.window.document.body.textContent,/session has ended/);assert.equal(f.messages.filter(item=>item.operation==='submit').length,before);await f.close();
});
test('All five downloads still match their original bytes after compression and CSV deduplication',async()=>{
 const f=lesson(1,true);await f.ready();const buttons=f.window.document.querySelectorAll('.download-items button');assert.equal(buttons.length,5);for(const button of buttons)button.click();
 for(let attempt=0;attempt<100&&f.downloads.length<5;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(f.downloads.length,5);
 for(const download of f.downloads){const actual=Buffer.from(await download.blob.arrayBuffer()),expected=fs.readFileSync(`course-content/mis301/${download.name}`);assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(expected).digest('hex'),download.name);}
 await f.close();
});
test('The self-contained section stays below the original payload budget',()=>assert.ok(Buffer.byteLength(compiled)<1_200_000));
