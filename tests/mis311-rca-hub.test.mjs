import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { loadTS } from './helpers/mis301-fixture.mjs';

function lesson(window){const lessonModule={exports:{}};vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lessonModule,document:window.document});const root=lessonModule.exports.slides[1]();window.document.body.append(root);return root;}

test('the floating hub caches each original view and closes nested tool dialogs before returning home',()=>{
  const window=new Window(),root=lesson(window),dialog=root.querySelector('.mis311-rca-hub-dialog');
  assert.ok(root.querySelector('#rca-topic-halo'));assert.ok(root.querySelector('.mis311-rca-hub-art circle[cx="1030"][cy="430"]'));
  const open=key=>{root.querySelector(`[data-rca-open=${key}]`).click();return root.querySelector(`[data-rca-hub-pane=${key}]`);};
  const home=()=>root.querySelector('.mis311-rca-hub-close').click();
  const comparison=open('comparison');comparison.querySelectorAll('.mis311-rca-question')[2].click();comparison.querySelector('[data-reveal-kind=symptom]').click();home();
  const process=open('process'),content=process.querySelector('[data-mis311-process]');content.click();content.click();assert.equal(content.dataset.processStep,'2');home();
  assert.equal(open('comparison'),comparison);assert.equal(comparison.querySelectorAll('.mis311-rca-question')[2].getAttribute('aria-pressed'),'true');assert.equal(comparison.querySelector('[data-reveal-kind=symptom]').getAttribute('aria-expanded'),'true');home();
  assert.equal(open('process'),process);assert.equal(content.dataset.processStep,'2');content.click();assert.equal(content.dataset.processStep,'3');home();
  const tools=open('tools');tools.querySelector('[data-tool-key=charts]').click();const nested=tools.querySelector('dialog');assert.equal(nested.open,true);assert.equal(dialog.open,true);nested.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(nested.open,false);assert.equal(dialog.open,true);
  tools.querySelector('[data-tool-key=pareto]').click();home();assert.equal(nested.open,false);assert.equal(dialog.open,false);assert.equal(window.document.activeElement,root.querySelector('[data-rca-open=tools]'));
  const mapping=open('mapping');for(const help of mapping.querySelectorAll('[data-example-kind]')){help.click();assert.equal(mapping.querySelector('dialog').open,true);mapping.querySelector('dialog').close();assert.equal(dialog.open,true);}home();
  assert.equal(root.querySelectorAll('[data-rca-hub-pane]').length,4);window.happyDOM.abort();
});

test('comparison and process refresh the shared epoch before reuse, retain all progress and reset on course return',()=>{
  const window=new Window();const store=loadTS('lib/lessonRevealState.ts',{}, {window,sessionStorage:window.sessionStorage,CustomEvent:window.CustomEvent});const id=store.MIS311_RCA_SECTION_ID;
  const parent={postMessage(message){if(message.type==='eiu-reveal-save')store.saveRevealState(id,message.epoch,message.state);else if(message.type==='eiu-reveal-load'){const saved=store.getRevealSession(id);window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:message.requestId,epoch:saved.epoch,state:structuredClone(saved.state)}}));}}};
  Object.defineProperty(window,'parent',{value:parent});window.eiuLessonRequestId=`${id}:2`;
  let root=lesson(window);const open=key=>{root.querySelector(`[data-rca-open=${key}]`).click();return root.querySelector(`[data-rca-hub-pane=${key}]`);};const close=()=>root.querySelector('.mis311-rca-hub-dialog').close();
  let comparison=open('comparison');comparison.querySelectorAll('.mis311-rca-question')[2].click();comparison.querySelector('[data-reveal-kind=rootCause]').click();close();
  let process=open('process');process.querySelector('[data-mis311-process]').click();close();
  comparison=open('comparison');comparison.querySelectorAll('.mis311-rca-question')[1].click();close();process=open('process');process.querySelector('[data-mis311-process]').click();close();
  assert.equal(store.getRevealSession(id).state.selected,1,'a cached process must not save a stale selected question');assert.equal(store.getRevealSession(id).state.processStep,2);
  window.dispatchEvent(new window.Event('pagehide'));root.remove();root=lesson(window);comparison=open('comparison');assert.equal(comparison.querySelectorAll('.mis311-rca-question')[1].getAttribute('aria-pressed'),'true');comparison.querySelectorAll('.mis311-rca-question')[2].click();assert.equal(comparison.querySelector('[data-reveal-kind=rootCause]').getAttribute('aria-expanded'),'true');close();process=open('process');assert.equal(process.querySelector('[data-mis311-process]').dataset.processStep,'2');close();
  store.resetLessonRevealState(id);window.dispatchEvent(new window.Event('pagehide'));root.remove();root=lesson(window);comparison=open('comparison');assert.equal(comparison.querySelector('[data-reveal-kind=rootCause]').getAttribute('aria-expanded'),'false');close();process=open('process');assert.equal(process.querySelector('[data-mis311-process]').dataset.processStep,'0');
  window.eiuSectionEnded=true;window.dispatchEvent(new window.Event('pagehide'));assert.equal(root.querySelector('.mis311-rca-hub-dialog').open,false);process.querySelector('[data-mis311-process]').click();assert.equal(process.querySelector('[data-mis311-process]').dataset.processStep,'0');window.happyDOM.abort();
});

test('the tree icon and Exercise share the RCA scope without losing stages, groups or question selection',()=>{
  const window=new Window();const store=loadTS('lib/lessonRevealState.ts',{}, {window,sessionStorage:window.sessionStorage,CustomEvent:window.CustomEvent});const id=store.MIS311_RCA_SECTION_ID;
  const parent={postMessage(message){if(message.type==='eiu-reveal-save')store.saveRevealState(id,message.epoch,message.state);else if(message.type==='eiu-reveal-load'){const saved=store.getRevealSession(id);window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:message.requestId,epoch:saved.epoch,state:structuredClone(saved.state)}}));}}};
  Object.defineProperty(window,'parent',{value:parent});window.eiuLessonRequestId=`${id}:2`;let root=lesson(window);
  const open=key=>{root.querySelector(`[data-rca-open=${key}]`).click();return root.querySelector(`[data-rca-hub-pane=${key}]`);};const home=()=>root.querySelector('.mis311-rca-hub-dialog').close();
  assert.equal(root.querySelectorAll('[data-rca-open]').length,5);assert.equal(root.querySelectorAll('button button').length,0);
  root.querySelector('.mis311-rca-hub-button [data-open-tree]').click();const tree=root.querySelector('[data-mis311-tree]'),treeDialog=root.querySelector('#mis311-problem-tree-details');
  assert.equal(treeDialog.open,true);const trigger=tree.querySelector('[data-tree-trigger]');trigger.dispatchEvent(new window.Event('click'));assert.equal(tree.dataset.step,'1');trigger.dispatchEvent(new window.Event('click'));assert.equal(tree.dataset.step,'2');
  treeDialog.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(treeDialog.open,false);assert.equal(root.querySelector('.mis311-rca-hub-dialog').open,true);home();
  let exercise=open('exercise'),content=exercise.querySelector('[data-mis311-exercise]');for(let click=0;click<5;click++)content.click();exercise.querySelectorAll('button[data-defect-group]')[0].click();home();
  const comparison=open('comparison');comparison.querySelectorAll('.mis311-rca-question')[1].click();comparison.querySelector('[data-reveal-kind=rootCause]').click();comparison.querySelector('[data-open-tree]').click();assert.equal(root.querySelector('[data-mis311-tree]'),tree);assert.equal(tree.dataset.step,'2');treeDialog.close();home();
  exercise=open('exercise');assert.equal(exercise.querySelector('[data-mis311-exercise]').dataset.exerciseStage,'5');assert.equal(exercise.querySelectorAll('button[data-defect-group]')[0].getAttribute('aria-expanded'),'true');exercise.querySelectorAll('button[data-defect-group]')[3].click();
  const saved=store.getRevealSession(id).state;assert.equal(saved.selected,1);assert.equal(saved.treeStage,2);assert.equal(saved.rootCause[1],true);assert.deepEqual(Array.from(saved.exerciseGroups),[true,false,false,true,false,false]);home();
  store.resetLessonRevealState(id);window.dispatchEvent(new window.Event('pagehide'));root.remove();root=lesson(window);const fresh=open('exercise');assert.equal(fresh.querySelector('[data-mis311-exercise]').dataset.exerciseStage,'0');home();root.querySelector('.mis311-rca-hub-button [data-open-tree]').click();assert.equal(root.querySelector('[data-mis311-tree]').dataset.step,'0');
  window.eiuSectionEnded=true;window.dispatchEvent(new window.Event('pagehide'));assert.equal(root.querySelectorAll('dialog[open]').length,0);window.happyDOM.abort();
});
