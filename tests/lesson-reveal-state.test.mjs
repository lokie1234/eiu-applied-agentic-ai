import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { formerSection2Slide } from './helpers/mis311-fixture.mjs';
import { loadTS, tick } from './helpers/mis301-fixture.mjs';

function fixture() {
  const window = new Window({ url: 'https://lesson.test' });
  const store = loadTS('lib/lessonRevealState.ts', {}, { window, sessionStorage: window.sessionStorage, CustomEvent: window.CustomEvent });
  let cleanup;
  const bridge = loadTS('components/deck/useLessonRevealBridge.ts', {
    react: { useLayoutEffect: effect => { cleanup = effect(); } }, '@/lib/lessonRevealState': store,
  }, { window, fetch: async () => ({ ok: true, json: async () => ({ success: true, terminationToken: 'token1' }) }) });
  const sectionId = store.MIS311_RCA_SECTION_ID;
  const messages = [];
  const frame = { current: { dataset: { requestId: `${sectionId}:2` }, contentWindow: { postMessage: message => messages.push(structuredClone(message)) } } };
  const emit = (data, source = frame.current.contentWindow) => window.dispatchEvent(new window.MessageEvent('message', { source, data: structuredClone(data) }));
  const mount = () => bridge.useLessonRevealBridge(sectionId, frame);
  mount();
  return { window, store, frame, sectionId, messages, emit, remount() { cleanup(); mount(); }, close() { cleanup(); window.happyDOM.abort(); } };
}

test('reveal bridge restores navigation progress and rejects foreign frames, wrong scopes and invalid data', async () => {
  const f = fixture();
  try {
    const requestId = `${f.sectionId}:2`;
    const load = { type: 'eiu-reveal-load', requestId };
    f.emit(load, {}); assert.equal(f.messages.length, 0);
    f.emit({ ...load, requestId: `${f.sectionId}:6` }); assert.equal(f.messages.length, 0);
    for(const obsolete of [3,5]){f.frame.current.dataset.requestId=`${f.sectionId}:${obsolete}`;f.emit({...load,requestId:f.frame.current.dataset.requestId});assert.equal(f.messages.length,0);}
    f.frame.current.dataset.requestId=requestId;
    f.emit(load); await tick();
    const session = f.messages.at(-1);
    const state = { selected: 2, symptom: [true, false, true], rootCause: [false, true, true] };
    f.emit({ type: 'eiu-reveal-save', requestId, epoch: session.epoch, state });
    f.remount(); f.emit(load); await tick();
    assert.deepEqual(f.messages.at(-1).state, state);
    f.emit({ type: 'eiu-reveal-save', requestId, epoch: session.epoch, state: { ...state, selected: 20 } });
    f.emit(load); await tick(); assert.deepEqual(f.messages.at(-1).state, state);
    // Stale snapshots cannot hide an already revealed perspective.
    f.emit({ type: 'eiu-reveal-save', requestId, epoch: session.epoch, state: f.store.emptyRevealState() });
    f.emit(load); await tick(); assert.deepEqual(f.messages.at(-1).state.symptom, state.symptom);
    assert.ok(f.window.sessionStorage.length > 0);
  } finally { f.close(); }
});

test('termination clears persisted reveals and rejects messages from the ended session', () => {
  const f = fixture();
  try {
    const old = f.store.getRevealSession(f.sectionId);
    const state = { selected: 1, symptom: [true, true, true], rootCause: [true, true, true] };
    f.store.saveRevealState(f.sectionId, old.epoch, state);
    f.store.clearLessonRevealState(f.sectionId);
    assert.equal(f.window.sessionStorage.length, 0);
    assert.equal(f.messages.at(-1).type, 'eiu-section-terminated');
    const count = f.messages.length;
    f.emit({ type: 'eiu-reveal-load', requestId: `${f.sectionId}:2` });
    assert.equal(f.messages.length, count);
    f.remount();
    f.emit({ type: 'eiu-reveal-save', requestId: `${f.sectionId}:2`, epoch: old.epoch, state });
    const fresh = f.store.getRevealSession(f.sectionId);
    assert.notEqual(fresh.epoch, old.epoch);
    assert.deepEqual(JSON.parse(JSON.stringify(fresh.state)), JSON.parse(JSON.stringify(f.store.emptyRevealState())));
  } finally { f.close(); }
});

test('compiled RCA reloads the saved selected question and six reveals through the sandbox bridge', () => {
  const parent = {};
  const state = { selected: 2, symptom: [true, false, true], rootCause: [true, true, true] };
  const renders = [];
  for (let visit = 0; visit < 2; visit++) {
    const window = new Window();
    Object.defineProperty(window, 'parent', { value: parent });
    window.eiuLessonRequestId = 'section:2';
    const messages = [];
    parent.postMessage = message => messages.push(structuredClone(message));
    const lesson = { exports: {} };
    vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js', 'utf8'), { module: lesson, document: window.document });
    const slide = formerSection2Slide(lesson.exports.slides,2);
    assert.equal(messages[0].type, 'eiu-reveal-load');
    window.dispatchEvent(new window.MessageEvent('message', { source: parent, data: { type: 'eiu-reveal-state', requestId: 'section:2', epoch: 'epoch', state: structuredClone(state) } }));
    assert.equal(slide.querySelectorAll('.mis311-rca-question')[2].getAttribute('aria-pressed'), 'true');
    assert.ok([...slide.querySelectorAll('.mis311-rca-answer')].every(node => !node.hidden));
    slide.querySelectorAll('.mis311-rca-question')[1].click();
    assert.equal(slide.querySelectorAll('.mis311-rca-answer')[0].hidden, !state.symptom[1]);
    slide.querySelector('[data-reveal-kind=symptom]').click();
    const saved = messages.at(-1);
    assert.equal(saved.type, 'eiu-reveal-save');
    Object.assign(state, saved.state);
    slide.querySelectorAll('.mis311-rca-question')[2].click();
    Object.assign(state, messages.at(-1).state);
    renders.push(window);
  }
  renders.forEach(window => window.happyDOM.abort());
});


test('a termination while away invalidates persisted progress on the next section entry', () => {
  const f = fixture();
  try {
    f.store.syncRevealTermination(f.sectionId, 'before');
    const old = f.store.getRevealSession(f.sectionId);
    f.store.saveRevealState(f.sectionId, old.epoch, { selected: 2, symptom: [true,true,true], rootCause: [true,true,true] });
    f.store.syncRevealTermination(f.sectionId, 'before');
    assert.equal(f.store.getRevealSession(f.sectionId).state.selected, 2);
    f.store.syncRevealTermination(f.sectionId, 'after');
    const fresh = f.store.getRevealSession(f.sectionId);
    assert.notEqual(fresh.epoch, old.epoch);
    assert.ok(fresh.state.symptom.every(value => !value));
    assert.ok(fresh.state.rootCause.every(value => !value));
  } finally { f.close(); }
});


test('Back to course clears both comparison and tree progress without terminating the section', () => {
  const f = fixture();
  try {
    const old = f.store.getRevealSession(f.sectionId);
    f.store.saveRevealState(f.sectionId, old.epoch, { selected: 2, symptom: [true,true,true], rootCause: [true,true,true], treeRevealed: true });
    const source = fs.readFileSync('components/LessonPortal.tsx','utf8');
    const body = source.match(/onChooseSection=\{\(\) => \{([\s\S]+?)\n        \}\}/)[1];
    let returned = false;
    vm.runInNewContext(`(()=>{${body}})()`, { setLiveSelection(){}, activeSectionId: f.sectionId, MIS311_MODELLING_SECTION_ID:'b7bd6b13-c654-412b-badb-12853350e148', resetMis311Presentation(){throw Error('Section 2 must not reset Section 1');}, resetLessonRevealState: f.store.resetLessonRevealState,
      cancelSectionOpening() {}, launchingSection: null, iconTilt: {onPointerLeave(){}}, selectedCourse:{id:'course',slug:'course'}, rememberDeckSelection(){}, setAdminSection(){}, setActiveUploadedSection(){returned=true;} });
    assert.equal(returned,true);
    const fresh = f.store.getRevealSession(f.sectionId);
    assert.notEqual(fresh.epoch,old.epoch);
    assert.ok(fresh.state.symptom.every(value=>!value));
    assert.ok(fresh.state.rootCause.every(value=>!value));
    assert.ok(!fresh.state.treeRevealed);
    assert.ok(!f.messages.some(message=>message.type==='eiu-section-terminated'));
  } finally {f.close();}
});

test('the tree reveal persists through the scoped slide 4 bridge and resets on course return', async () => {
  const f=fixture();
  try {
    const requestId=`${f.sectionId}:2`;
    f.frame.current.dataset.requestId=requestId;
    f.emit({type:'eiu-reveal-load',requestId}); await tick();
    const session=f.messages.at(-1);
    assert.equal(session.type,'eiu-reveal-state');
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state:{...session.state,treeRevealed:true}});
    f.remount(); f.emit({type:'eiu-reveal-load',requestId});await tick();
    assert.equal(f.messages.at(-1).state.treeRevealed,true);
    f.store.resetLessonRevealState(f.sectionId);
    assert.ok(!f.store.getRevealSession(f.sectionId).state.treeRevealed);
  } finally {f.close();}
});


test('returning to the SVG tree restores it fully without replaying its reveal animation', () => {
  const window=new Window();
  const parent={postMessage(){}};
  Object.defineProperty(window,'parent',{value:parent});
  window.eiuLessonRequestId='section:2';
  const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,3);
  window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:'section:2',epoch:'current',state:{selected:1,symptom:[true,false,false],rootCause:[false,true,false],treeRevealed:true}}}));
  const content=slide.querySelector('[data-mis311-tree]');
  assert.equal(content.dataset.open,'true');
  assert.equal(content.dataset.restored,'true');
  assert.equal(slide.querySelector('[data-tree-trigger]').getAttribute('aria-expanded'),'true');
  window.happyDOM.abort();
});


test('a partially revealed tree restores the symptom stage and still requires a click for causes', () => {
  const window=new Window();
  const messages=[];
  const parent={postMessage(message){messages.push(structuredClone(message));}};
  Object.defineProperty(window,'parent',{value:parent});
  window.eiuLessonRequestId='section:2';
  const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,3);
  const state={selected:0,symptom:[false,false,false],rootCause:[false,false,false],treeStage:1,treeRevealed:false};
  window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:'section:2',epoch:'current',state}}));
  assert.equal(slide.querySelector('[data-mis311-tree]').dataset.step,'1');
  assert.equal(slide.querySelector('[data-tree-phase=leaves]').getAttribute('aria-hidden'),null);
  assert.equal(slide.querySelector('[data-tree-phase=roots]').getAttribute('aria-hidden'),'true');
  slide.querySelector('[data-tree-trigger]').dispatchEvent(new window.Event('click'));
  assert.equal(slide.querySelector('[data-tree-phase=roots]').getAttribute('aria-hidden'),null);
  assert.equal(messages.at(-1).state.treeStage,2);
  window.happyDOM.abort();
});


test('process reveals survive slide navigation and clear when returning to the course', async () => {
  const f=fixture();
  try {
    const requestId=`${f.sectionId}:2`;
    f.frame.current.dataset.requestId=requestId;
    f.emit({type:'eiu-reveal-load',requestId}); await tick();
    const session=f.messages.at(-1);
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state:{...session.state,processStep:5}});
    f.remount();f.emit({type:'eiu-reveal-load',requestId});await tick();
    assert.equal(f.messages.at(-1).state.processStep,5);
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state:{...session.state,processStep:9}});
    assert.equal(f.store.getRevealSession(f.sectionId).state.processStep,5);
    f.store.resetLessonRevealState(f.sectionId);
    assert.ok(!f.store.getRevealSession(f.sectionId).state.processStep);
  }finally{f.close();}
});

test('the process sandbox restores the focused step and continues at the next step', () => {
  const window=new Window();const parent={postMessage(){}};
  Object.defineProperty(window,'parent',{value:parent});window.eiuLessonRequestId='section:2';
  const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,4);
  window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:'section:2',epoch:'current',state:{selected:0,symptom:[false,false,false],rootCause:[false,false,false],processStep:5}}}));
  const content=slide.querySelector('[data-mis311-process]');
  assert.equal(content.dataset.processStep,'5');
  assert.deepEqual([...slide.querySelectorAll('.mis311-process-step')].filter(card=>!card.hidden).map(card=>card.querySelector('h2').textContent),['Recommend solutions']);
  content.click();assert.equal(content.dataset.processStep,'6');
  window.happyDOM.abort();
});


test('exercise groups persist independently through the slide 9 bridge and reset on Back to course', async () => {
  const f=fixture();
  try {
    const requestId=`${f.sectionId}:2`;f.frame.current.dataset.requestId=requestId;
    f.emit({type:'eiu-reveal-load',requestId});await tick();const session=f.messages.at(-1);
    const state={...session.state,exerciseGroups:[true,false,false,true,false,false]};
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state});
    // A save from another slide cannot erase exercise progress.
    f.store.saveRevealState(f.sectionId,session.epoch,{...session.state,selected:2});
    f.remount();f.emit({type:'eiu-reveal-load',requestId});await tick();
    assert.deepEqual(f.messages.at(-1).state.exerciseGroups,[true,false,false,true,false,false]);
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state:{...state,exerciseGroups:[true]}});
    assert.equal(f.store.getRevealSession(f.sectionId).state.exerciseGroups.length,6);
    f.store.resetLessonRevealState(f.sectionId);assert.equal(f.store.getRevealSession(f.sectionId).state.exerciseGroups,undefined);
  }finally{f.close();}
});

test('the exercise restores revealed groups for both SVG and narrow-screen controls', () => {
  const window=new Window();const messages=[];const parent={postMessage(value){messages.push(value);}};
  Object.defineProperty(window,'parent',{value:parent});window.eiuLessonRequestId='section:2';
  const lesson={exports:{}};vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,8);
  window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:'section:2',epoch:'current',state:{selected:0,symptom:[false,false,false],rootCause:[false,false,false],exerciseGroups:[true,false,false,true,false,false]}}}));
  const svg=[...slide.querySelectorAll('svg [data-defect-group]')],mobile=[...slide.querySelectorAll('button[data-defect-group]')];
  assert.deepEqual(svg.map(node=>node.getAttribute('aria-expanded')),['true','false','false','true','false','false']);
  assert.equal(mobile[3].getAttribute('aria-expanded'),'true');mobile[1].click();
  assert.deepEqual(messages.at(-1).state.exerciseGroups,[true,true,false,true,false,false]);
  window.happyDOM.abort();
});


test('slide 9 preserves the introduction stage, rejects out-of-range stages and resets on course return', async () => {
  const f=fixture();
  try {
    const requestId=`${f.sectionId}:2`;f.frame.current.dataset.requestId=requestId;f.emit({type:'eiu-reveal-load',requestId});await tick();const session=f.messages.at(-1);
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state:{...session.state,exerciseStage:3}});
    f.remount();f.emit({type:'eiu-reveal-load',requestId});await tick();assert.equal(f.messages.at(-1).state.exerciseStage,3);
    f.emit({type:'eiu-reveal-save',requestId,epoch:session.epoch,state:{...session.state,exerciseStage:6}});assert.equal(f.store.getRevealSession(f.sectionId).state.exerciseStage,3);
    f.store.resetLessonRevealState(f.sectionId);assert.equal(f.store.getRevealSession(f.sectionId).state.exerciseStage,undefined);
  }finally{f.close();}
});

test('the exercise restores Scenario focus and advances to the two story panels without opening causes', () => {
  const window=new Window();const parent={postMessage(){}};
  Object.defineProperty(window,'parent',{value:parent});window.eiuLessonRequestId='section:2';
  const lesson={exports:{}};vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,8);window.dispatchEvent(new window.MessageEvent('message',{source:parent,data:{type:'eiu-reveal-state',requestId:'section:2',epoch:'current',state:{selected:0,symptom:[false,false,false],rootCause:[false,false,false],exerciseStage:2}}}));
  const content=slide.querySelector('[data-mis311-exercise]');assert.equal(content.dataset.exerciseMode,'scenario');content.click();assert.equal(content.dataset.exerciseMode,'assembled');
  assert.ok([...slide.querySelectorAll('svg [data-defect-group]')].every(node=>node.hasAttribute('hidden')));
  window.happyDOM.abort();
});
