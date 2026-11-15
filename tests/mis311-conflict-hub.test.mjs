import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';

test('the conflict hub exposes exactly three floating resources and keeps their selected pages cached',()=>{
  const window=new Window();const lesson={exports:{}};vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const root=lesson.exports.slides[5]();window.document.body.append(root);const dialog=root.querySelector('dialog');
  assert.equal(root.querySelector('h1').textContent,'Conflict Resolution');assert.ok(root.querySelector('#conflict-halo'));
  assert.deepEqual([...root.querySelectorAll('[data-rca-open]')].map(node=>node.textContent),['Thomas-Kilmann Conflict Management Model','How to use TKM','Example']);
  const open=key=>{root.querySelector(`[data-rca-open=${key}]`).click();return root.querySelector(`[data-rca-hub-pane=${key}]`);};const close=()=>root.querySelector('[aria-label="Return to Conflict Resolution"]').click();
  const model=open('model');assert.equal(model.querySelectorAll('[data-tki-mode]').length,5);assert.equal(model.querySelectorAll('dialog,[data-tki-open]').length,0);close();
  const how=open('how');how.querySelector('[data-tki-page-button="2"]').click();assert.equal(how.querySelectorAll('.mis311-tki-choices li').length,5);close();
  const example=open('example');example.querySelector('[data-tki-page-button="3"]').click();close();
  assert.equal(open('model'),model);close();assert.equal(open('how'),how);assert.equal(how.querySelector('[data-tki-page-button="2"]').getAttribute('aria-current'),'step');close();
  assert.equal(open('example'),example);assert.equal(example.querySelector('[data-tki-page-button="3"]').getAttribute('aria-current'),'step');close();
  assert.equal(root.querySelectorAll('dialog').length,1);assert.equal(dialog.open,false);assert.equal(window.document.activeElement,root.querySelector('[data-rca-open=example]'));window.happyDOM.abort();
});
