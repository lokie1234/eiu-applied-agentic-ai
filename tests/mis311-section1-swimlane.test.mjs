import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';
const file='course-content/imported/86cae0a3-9ada-4e31-b4d4-c83f50cafaf6/b7bd6b13-c654-412b-badb-12853350e148/1066dca1-c75c-477b-bd53-5dec37fc7d5a.js';
const expected=['Customer Arrived','Seating','Present Menu','Customer Places Order','Order is Prepared','Order Ready for Serving','Food is Served','Payment','Customer Departure'];
function fixture(){const window=new Window(),store=loadTS('lib/mis311Presentation.ts',{}, {window}),id=store.MIS311_MODELLING_SECTION_ID,lessonModule={exports:{}};const parent={postMessage(m){store.saveMis311PresentationState(id,6,m.page,m.state);}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:lessonModule,document:window.document,window,parent});const open=()=>{window.document.body.replaceChildren();window.eiuPresentationState={states:store.readMis311Presentation(id)};const root=lessonModule.exports.slides[5]();window.document.body.append(root);return root;};return {window,store,id,open};}

test('slide 7 transforms its nine original steps into the reference four-lane restaurant model',()=>{
 const {window,open}=fixture(),root=open();assert.deepEqual([...root.querySelectorAll('.rs-step-text')].map(n=>n.textContent),expected);assert.equal(root.querySelector('.rs-steps').hidden,false);assert.equal(root.querySelector('.rs-viewport').hidden,true);
 const button=root.querySelector('.rs-build');assert.equal(button.tagName,'BUTTON');assert.equal(button.textContent,'https://www.lucidchart.com/');assert.equal(root.querySelectorAll('a').length,0);button.click();
 assert.equal(root.querySelector('.rs-steps').hidden,true);assert.equal(root.querySelector('.rs-viewport').hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(button.getAttribute('aria-disabled'),'true');assert.equal(root.querySelectorAll('[data-restaurant-node]').length,9);assert.equal(root.querySelectorAll('[data-restaurant-flow]').length,8);assert.deepEqual([...root.querySelectorAll('[data-restaurant-node]')].map(n=>n.dataset.restaurantStep),expected);
 assert.deepEqual([...root.querySelectorAll('[data-restaurant-lane]')].map(n=>n.dataset.restaurantLane),['CUSTOMER','FRONT OF HOUSE','KITCHEN','CASHIER']);
 const rows=[...root.querySelectorAll('[data-restaurant-node]')].map(n=>Math.floor((Number(n.querySelector('rect')?.getAttribute('y')??n.querySelector('circle').getAttribute('cy'))-5)/100));assert.deepEqual(rows,[0,1,1,0,2,2,1,3,0]);
 const ids=[...root.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);assert.ok(root.querySelector('#restaurant-flow-arrow'));button.click();assert.equal(root.querySelectorAll('[data-restaurant-node]').length,9);window.happyDOM.abort();
});
test('the built swimlane persists on revisits and remains monotonic until explicit logout clears storage',()=>{
 const {window,open,store,id}=fixture();let root=open();root.querySelector('.rs-build').click();assert.equal(store.readMis311Presentation(id)[7].built,true);root=open();assert.equal(root.querySelector('[data-mis311-swimlane]').dataset.restored,'true');assert.equal(root.querySelector('.rs-viewport').hidden,false);
 assert.equal(store.saveMis311PresentationState(id,2,7,{built:false}),false);assert.equal(store.saveMis311PresentationState(id,6,7,{built:false}),true);assert.equal(store.readMis311Presentation(id)[7].built,true);
 window.localStorage.clear();root=open();assert.equal(root.querySelector('.rs-viewport').hidden,true);window.eiuSectionEnded=true;root.querySelector('.rs-build').click();assert.equal(root.querySelector('.rs-viewport').hidden,true);window.happyDOM.abort();
});
