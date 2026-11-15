import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';

const path='course-content/imported/86cae0a3-9ada-4e31-b4d4-c83f50cafaf6/b7bd6b13-c654-412b-badb-12853350e148/1066dca1-c75c-477b-bd53-5dec37fc7d5a.js';
function fixture(){const window=new Window(),lessonModule={exports:{}};vm.runInNewContext(fs.readFileSync(path,'utf8'),{module:lessonModule,document:window.document,window,parent:window});const root=lessonModule.exports.slides[1]();window.document.body.append(root);return {window,root,slides:lessonModule.exports.slides};}
function answer(root){root.querySelector('.mis311-org-toggle').click();root.querySelector('.mis311-org-scenario').click();root.querySelector('.mis311-org-question-trigger').click();root.querySelector('.mis311-org-question-answer').click();}
test('active Section 1 merges Process Modelling into the answer without changing the process renderer',()=>{
 const {window,root,slides}=fixture();assert.equal(slides.length,8);assert.equal(root.querySelector('[data-mis311-process-model]'),null);
 answer(root);const trigger=root.querySelector('.mis311-process-resource-trigger');assert.equal(trigger.textContent,'Process Modelling');assert.equal(root.querySelector('.mis311-org-question-list').children.length,3);
 trigger.click();const modal=root.querySelector('#mis311-process-resource'),content=modal.querySelector('[data-mis311-process-model]');assert.ok(modal.open);assert.equal(modal.getAttribute('role'),'dialog');assert.ok(content.querySelector('.mis311-process-diagram').hidden);
 content.querySelector('.mis311-process-title').click();assert.equal(content.dataset.started,'true');assert.equal(content.querySelector('.mis311-process-diagram').hidden,false);assert.equal(content.querySelectorAll('[data-process-stage]').length,15);
 content.querySelector('.mis311-process-help').click();assert.equal(content.querySelector('.mis311-process-definition').hidden,false);assert.ok(content.querySelector('.mis311-process-definition').textContent.includes('Process Modeling includes'));
 root.querySelector('.mis311-process-resource-close').click();assert.equal(modal.open,false);assert.equal(root.querySelector('.mis311-org-question-dialog').open,true);assert.equal(window.document.activeElement,trigger);
 trigger.click();assert.equal(modal.querySelector('[data-mis311-process-model]'),content);assert.equal(content.dataset.started,'true');assert.equal(content.querySelector('.mis311-process-definition').hidden,false);
 modal.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(modal.open,false);assert.equal(root.querySelector('.mis311-org-question-dialog').open,true);assert.equal(root.querySelector('#mis311-question-heading').textContent,'Suggested answer');
 trigger.click();window.dispatchEvent(new window.Event('pagehide'));assert.equal(root.querySelectorAll('dialog[open]').length,0);window.happyDOM.abort();
});
test('Question/Answer toggles keep a single lazy model dialog and all current pages render',()=>{
 const {window,root,slides}=fixture();answer(root);const toggle=root.querySelector('.mis311-org-question-answer');for(let i=0;i<3;i++){toggle.click();assert.equal(root.querySelector('.mis311-process-resource-trigger'),null);toggle.click();assert.equal(root.querySelectorAll('.mis311-process-resource-trigger').length,1);}
 root.querySelector('.mis311-process-resource-trigger').click();root.querySelector('.mis311-process-resource-close').click();assert.equal(root.querySelectorAll('#mis311-process-resource').length,1);
 for(let i=0;i<slides.length;i++){const page=slides[i]();assert.equal(page.querySelector('[data-mis311-page]').textContent,String(i+1));if(i!==1)assert.equal(page.querySelector('[data-mis311-process-model]'),null);}
 window.happyDOM.abort();
});
