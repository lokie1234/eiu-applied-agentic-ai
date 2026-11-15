import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';
const dom=loadTS('lib/livePresentationDom.ts'),protocol=loadTS('lib/livePresentationProtocol.ts');
test('the real MIS311 Value Stream Mapping illustration survives the passive Live mirror',()=>{
 const source=new Window(),follower=new Window(),lessonModule={exports:{}};vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lessonModule,document:source.document,window:source,parent:source});const root=lessonModule.exports.slides[3]();source.document.body.append(root);root.querySelector('[data-rca-open=definition]').click();const original=root.querySelector('image');assert.ok(original);
 Object.defineProperty(source.document.documentElement,'clientWidth',{value:960});Object.defineProperty(source.document.documentElement,'clientHeight',{value:540});let id=0;const state=dom.captureLiveDocument(source.document,4,new WeakMap(),()=>++id),encoded=protocol.applyLivePatch('',JSON.stringify({...state,reset:true,removed:[]}));dom.renderLiveDocument(follower.document,JSON.parse(encoded),new Map());const copied=follower.document.querySelector('image');assert.ok(copied);assert.equal(copied.getAttribute('href')||copied.getAttribute('xlink:href'),original.getAttribute('href')||original.getAttribute('xlink:href'));assert.equal(follower.document.querySelectorAll('script').length,0);source.happyDOM.abort();follower.happyDOM.abort();
});
