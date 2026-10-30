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
 const globals={window,document:window.document,Node:window.Node,parent,Event:window.Event,crypto:globalThis.crypto,console,TextEncoder,Blob:globalThis.Blob,Response:globalThis.Response,DecompressionStream:globalThis.DecompressionStream,Uint8Array,atob,btoa,URL:{createObjectURL:blob=>{const url=`blob:https://example.test/${urls.size}`;urls.set(url,blob);return url;},revokeObjectURL:url=>urls.delete(url)},setTimeout:Timeout,clearTimeout:token=>timers.delete(token),matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>1},Date};
 vm.runInNewContext(script,globals);
 return {window,messages,downloads,context,async ready(){await tick();await tick();},terminate(){window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-section-terminated',requestId:`${sectionId}:${page}`}}));},async close(){timers.clear();await window.happyDOM.close();}};
}
function code(cell,source,window){const input=cell.querySelector('textarea');input.value=source;input.dispatchEvent(new window.Event('input',{bubbles:true}));cell.querySelector('.run').click();}

test('Role-aware lesson counts remain 5 unselected / 6 selected / 7 teaching after cleanup',async()=>{
 for(const [teaching,allowed,count]of[[false,false,5],[false,true,6],[true,true,7]]){const f=lesson(null,teaching,allowed);assert.equal(f.messages.find(item=>item.type==='eiu-tsx-ready').slides,count);await f.close();}
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
 const before=f.messages.filter(item=>item.operation==='submit').length;f.terminate();form.dispatchEvent(new f.window.Event('submit',{cancelable:true}));await f.ready();
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
