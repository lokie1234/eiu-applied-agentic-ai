import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';

test('the VSM hub retains the definition, car annotations, symbols, example and all benefits across reopening',()=>{
  const window=new Window();window.happyDOM.setWindowSize({width:1280,height:720});const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const root=lesson.exports.slides[3]();window.document.body.appendChild(root);const dialog=root.querySelector('dialog');
  assert.equal(root.querySelector('h1').textContent,'Value Stream Mapping');
  assert.deepEqual([...root.querySelectorAll('[data-rca-open]')].map(node=>node.textContent),['What is it ?','Parts of a Value Stream Map','Importance of a VSM']);
  const open=key=>{root.querySelector(`[data-rca-open=${key}]`).click();return root.querySelector(`[data-rca-hub-pane=${key}]`);};const close=()=>root.querySelector('[aria-label="Return to Value Stream Mapping"]').click();
  const definition=open('definition');assert.equal(dialog.getAttribute('aria-describedby'),'mis311-vsm-definition');definition.querySelector('.mis311-vsm-example').click();close();
  const parts=open('parts');assert.equal(dialog.hasAttribute('aria-describedby'),false);parts.querySelector('[data-symbol-page-button="9"]').click();close();
  const importance=open('importance');assert.equal(importance.querySelectorAll('.mis311-vsf-benefit').length,4);close();
  assert.equal(open('definition'),definition);assert.ok([...definition.querySelectorAll('[data-vsm-car-ring]')].every(node=>!node.hasAttribute('hidden')));close();
  assert.equal(open('parts'),parts);assert.equal(parts.querySelector('[data-symbol-page]').dataset.symbolPage,'9');parts.querySelector('[data-vsm-details=example]').click();parts.querySelector('[data-example-view-button="2"]').click();close();
  open('importance');close();open('parts');assert.equal(parts.querySelector('.mis311-vsp-panel').dataset.kind,'example');assert.equal(parts.querySelector('figure').dataset.exampleView,'2');close();
  assert.equal(window.document.activeElement,root.querySelector('[data-rca-open=parts]'));assert.equal(root.querySelectorAll('[data-rca-hub-pane]').length,3);window.happyDOM.abort();
});
