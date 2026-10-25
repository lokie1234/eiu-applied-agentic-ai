import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { createRequire } from 'node:module';
import { Window } from 'happy-dom';
const require = createRequire(import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, console, URL, Date, AbortController, AbortSignal, ...globals,
    require: name => dependencies[name] ?? (name.endsWith('.css') ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }) : require(name)),
  });
  return exports;
}
const bank = load('lib/webDevelopmentQuiz.ts');
const courseId = bank.WEB_DEVELOPMENT_COURSE_ID, sectionId = bank.WEB_DEVELOPMENT_SECTION_ID;
const questions = bank.WEB_DEVELOPMENT_QUESTIONS;
function fixture() {
  const rows = [];
  const afterTasks = [], broadcasts = [], queriedActions = [];
  let access = { isActive: true, isAdmin: false, authUserId: 'auth', displayName: 'Alice', email: 'alice@example.test',
    learnerIdentity: { sessionId: 'learner-one', name: 'Alice', email: 'alice@example.test', information: { department: 'IT' }, fields: [{ id: 'department', label: 'Department' }] },
    courses: [{ id: courseId, title: 'AI-Powered Web Development' }], sections: [{ id: sectionId, courseId, sectionKey: 'section1', title: 'Section 1' }] };
  const db = { from() {
    const filters = []; let cap = Infinity, inserted;
    const query = { select() { return query; }, eq(key, value) { if(key==='action')queriedActions.push(value); filters.push(row => row[key] === value); return query; },
      contains(key, value) { filters.push(row => Object.entries(value).every(([k,v]) => row[key]?.[k] === v)); return query; },
      gt(key, value) { filters.push(row => row[key] > value); return query; },
      order() { return query; }, limit(value) { cap = value; return query; },
      insert(row) { inserted = { ...row, id: rows.length + 1, created_at: new Date(1792818000000 + rows.length * 1000).toISOString() }; rows.push(inserted); return query; },
      single: async () => ({ data: inserted }), maybeSingle: async () => ({ data: matching()[0] || null }),
      then(resolve, reject) { return Promise.resolve({ data: matching() }).then(resolve, reject); },
    };
    const matching = () => rows.filter(row => filters.every(filter => filter(row))).reverse().slice(0, cap);
    return query;
  } };
  db.channel = topic => ({ httpSend: async (event, payload) => { broadcasts.push({ topic, event, payload }); return { success: true }; } });
  db.removeChannel = async () => 'ok';
  const dependencies = {
    'next/server': { NextResponse: Response, after: callback => afterTasks.push(callback) }, '@/lib/auth/currentUser': { currentUserAccess: async () => access },
    '@/lib/supabase/server': { getSupabaseAdmin: () => db }, '@/lib/webDevelopmentQuiz': bank,
    '@/lib/auth/types': { APPLIED_AGENTIC_AI_SLUG: 'applied-agentic-ai' },
  };
  dependencies['@/lib/sectionTermination'] = load('lib/sectionTermination.ts', { 'server-only': {}, '@/lib/supabase/server': dependencies['@/lib/supabase/server'] });
  const route = load('app/api/sections/[id]/quiz/route.ts', dependencies);
  const control = load('app/api/sections/[id]/control/route.ts', dependencies);
  const context = { params: Promise.resolve({ id: sectionId }) };
  const get = () => route.GET(new Request('http://localhost/api/sections/' + sectionId + '/quiz'), context);
  const post = body => route.POST(new Request('http://localhost/api/sections/' + sectionId + '/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizSession: rows.findLast(row => row.action === 'SECTION_TERMINATED')?.details.token || 'initial', ...body }) }), context);
  const controlGet = () => control.GET(new Request('http://localhost/control'), context);
  const terminate = () => control.POST(new Request('http://localhost/control', { method: 'POST' }), context);
  return { rows, get, post, route, controlGet, terminate, afterTasks, broadcasts, queriedActions, get access() { return access; }, set access(value) { access = value; } };
}
const allCorrect = () => questions.map(question => ({ selected: question.options[question.answer], isCorrect: true }));

test('quiz session lookup starts alongside authorization rather than after it', async () => {
  let finishAccess, sessionRead = false;
  const accessPending = new Promise(resolve => { finishAccess = resolve; });
  const route = load('app/api/sections/[id]/quiz/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/auth/currentUser': { currentUserAccess: () => accessPending },
    '@/lib/supabase/server': {}, '@/lib/webDevelopmentQuiz': bank,
    '@/lib/sectionTermination': { readSectionTermination: async () => { sessionRead = true; return null; } },
  });
  const response = route.GET(new Request('http://localhost/quiz'), { params: Promise.resolve({ id: sectionId }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sessionRead, true, 'session query does not wait for the access database round trips');
  finishAccess(null);
  assert.equal((await response).status, 403, 'parallel reads still require authorization');
});

test('uncompleted learners skip feedback reads while completed progress still restores feedback', async () => {
  const f = fixture();
  const state = await (await f.get()).json();
  assert.equal(state.result, null);
  assert.deepEqual(f.queriedActions, ['SECTION_TERMINATED', 'QUIZ_OPENED', 'QUIZ_COMPLETED']);
  f.access.isAdmin = true; await f.post({ action: 'open' }); f.access.isAdmin = false;
  await f.post({ action: 'result', answers: allCorrect() });
  await f.post({ action: 'feedback', feedback: 'Useful' });
  f.queriedActions.length = 0;
  assert.equal((await (await f.get()).json()).result.feedbackSubmitted, true);
  assert.ok(f.queriedActions.includes('FEEDBACK_SUBMITTED'));
});

test('closed teaching quizzes skip completion reads and opening notifies the scoped channel after persistence', async () => {
  const f = fixture(); f.access.isAdmin = true;
  assert.equal((await (await f.get()).json()).isOpen, false);
  assert.ok(!f.queriedActions.includes('QUIZ_COMPLETED'));
  f.access.isAdmin = false;
  assert.equal((await f.post({action:'open'})).status,403);
  assert.equal(f.afterTasks.length,0,'unauthorized requests cannot broadcast');
  f.access.sections[0].canFacilitate = true;
  assert.equal((await f.post({action:'open'})).status,200);
  assert.equal(f.rows.filter(row=>row.action==='QUIZ_OPENED').length,1);
  assert.equal(f.broadcasts.length,0,'realtime delivery must not block the response');
  for(const task of f.afterTasks.splice(0))await task();
  assert.deepEqual(JSON.parse(JSON.stringify(f.broadcasts)),[{topic:`eiu:quiz:${sectionId}`,event:'quiz_state_changed',payload:{}}]);
});

test('only the admin or the teacher of this course section can open the quiz', async () => {
  const f = fixture();
  assert.equal((await f.get()).status, 200);
  assert.equal((await f.post({ action: 'open' })).status, 403);
  f.access.canFacilitate = true;
  assert.equal((await f.post({ action: 'open' })).status, 403, 'teaching another section grants no access');
  f.access.sections[0].canFacilitate = true;
  assert.equal((await f.post({ action: 'open' })).status, 200);
  assert.equal((await f.get()).status, 200);
  assert.equal(f.rows[0].course_id, courseId);
  assert.equal(f.rows[0].details.sectionId, sectionId);
  f.access.sections[0].canFacilitate = false;
  f.access.isAdmin = true;
  assert.equal((await f.post({ action: 'open' })).status, 200);
  assert.equal(f.rows.length, 1, 'opening twice retains the same state');
  f.access.isActive = false;
  assert.equal((await f.get()).status, 403);
});

test('scores are server graded, scoped, restored and followed by persistent feedback', async () => {
  const f = fixture();
  assert.equal(questions.length, 10);
  assert.equal((await f.post({ action: 'result', answers: allCorrect() })).status, 403);
  assert.equal((await f.post({ action: 'feedback', feedback: 'Useful' })).status, 403);
  f.access.isAdmin = true; await f.post({ action: 'open' }); f.access.isAdmin = false;
  assert.equal((await f.post({ action: 'result', answers: allCorrect().slice(1) })).status, 400);
  const forged = allCorrect(); forged[0].selected = 'not an option';
  assert.equal((await f.post({ action: 'result', answers: forged })).status, 400);
  const answers = allCorrect(); answers[0].selected = questions[0].options[0];
  const response = await f.post({ action: 'result', score: 10, answers, name: 'Imposter', courseId: 'other', sectionId: 'other' });
  const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.score, 9);
  assert.equal(result.answers[0].isCorrect, false);
  const saved = f.rows.find(row => row.action === 'QUIZ_COMPLETED');
  assert.equal(saved.details.name, 'Alice'); assert.equal(saved.details.score, 9);
  assert.equal(saved.details.courseId, courseId); assert.equal(saved.details.sectionId, sectionId);
  assert.equal((await (await f.post({ action: 'result', answers: allCorrect() })).json()).score, 9);
  assert.equal(f.rows.filter(row => row.action === 'QUIZ_COMPLETED').length, 1);
  assert.equal((await f.post({ action: 'feedback', feedback: ' ' })).status, 400);
  assert.equal((await f.post({ action: 'feedback', feedback: 'Useful lesson' })).status, 200);
  assert.equal((await f.post({ action: 'feedback', feedback: 'Again' })).status, 200);
  assert.equal(f.rows.filter(row => row.action === 'FEEDBACK_SUBMITTED').length, 1);
  const restored = await (await f.get()).json();
  assert.equal(restored.result.score, 9); assert.equal(restored.result.feedbackSubmitted, true);
  assert.equal(restored.result.learner.information.department, 'IT');
  f.access.learnerIdentity = { ...f.access.learnerIdentity, sessionId: 'another-learner' };
  assert.equal((await (await f.get()).json()).result, null);
  f.access.sections[0].courseId = 'applied-ai';
  assert.equal((await f.get()).status, 403, 'same section key in another course cannot read this quiz');
});

test('termination is opt-in and admin-only, closes quiz and resets attempts while retaining report history', async () => {
  const f = fixture();
  assert.equal((await (await f.controlGet()).json()).enabled, false);
  f.access.isAdmin = true;
  assert.equal((await f.terminate()).status, 403, 'disabled sections cannot be terminated');
  f.access.sections[0].terminationEnabled = true;
  f.access.isAdmin = false; f.access.sections[0].canFacilitate = true;
  assert.equal((await f.terminate()).status, 403, 'teachers can open quizzes but cannot terminate');
  await f.post({ action: 'open' }); f.access.sections[0].canFacilitate = false;
  await f.post({ action: 'result', answers: allCorrect() }); await f.post({ action: 'feedback', feedback: 'First session' });
  const before = await (await f.controlGet()).json();
  f.rows.push({ id: f.rows.length + 1, action: 'QUIZ_COMPLETED', created_at: 'now', details: { courseId: 'other', sectionId: 'other', score: 7 } });
  f.access.isAdmin = true; assert.equal((await f.terminate()).status, 200); f.access.isAdmin = false;
  const after = await (await f.controlGet()).json(); assert.notEqual(after.terminationToken, before.terminationToken);
  const closed = await (await f.get()).json(); assert.equal(closed.isOpen, false); assert.equal(closed.result, null);
  assert.equal((await f.post({ action: 'result', answers: allCorrect(), quizSession: before.terminationToken })).status, 409, 'old submissions cannot enter a new session');
  assert.equal((await f.post({ action: 'result', answers: allCorrect() })).status, 403, 'admin must reopen quiz');
  assert.equal(f.rows.filter(row => row.action === 'QUIZ_COMPLETED').length, 2, 'report history remains intact');
  const oldResult = f.rows.find(row => row.action === 'QUIZ_COMPLETED' && row.details.courseId === courseId);
  f.rows.push({ ...oldResult, id: f.rows.length + 1, created_at: '2026-10-25T00:00:00Z' });
  assert.equal((await (await f.get()).json()).result, null, 'an old-session write that finishes after termination cannot contaminate the new session');
  f.access.sections[0].canFacilitate = true;
  await f.post({ action: 'open' });
  assert.equal((await (await f.get()).json()).completedLearners.length, 0, 'completion list starts fresh');
  f.access.sections[0].canFacilitate = false;
  assert.equal((await f.post({ action: 'result', answers: allCorrect() })).status, 200);
  assert.equal((await (await f.get()).json()).result.feedbackSubmitted, false);
  assert.equal((await f.post({ action: 'feedback', feedback: 'Second session' })).status, 200);
  assert.equal(f.rows.filter(row => row.action === 'FEEDBACK_SUBMITTED').length, 2);
});

test('admin access settings save termination only for a verified section and expose it to the portal', async () => {
  let actor = { isAdmin: true };
  const metadata = { summary: 'Web course', terminableSectionIds: [] };
  const catalog = { folderGroups: [], courses: [{ id: courseId, slug: 'web', title: 'Web', status: 'active', metadata }],
    sections: [{ id: sectionId, course_id: courseId, section_key: 'section1', status: 'active', title: 'Section 1', position: 1 }] };
  const route = load('app/api/admin/access/route.ts', {
    'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/currentUser': { requireCourseManager: async () => actor }, '@/lib/auth/types': {},
    '@/lib/supabase/server': { getSupabaseAdmin: () => ({}) }, '@/lib/auth/passcodes': {}, '@/lib/learningIdentity': {},
    '@/lib/auth/courseAccessStorage': { getCoursesAndSectionsData: async () => catalog,
      updateCourseMetadata: async (id, update) => { assert.equal(id, courseId); Object.assign(metadata, update(metadata)); } },
  });
  const save = body => route.POST(new Request('http://localhost/api/admin/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  const settings = { action: 'set_section_termination', sectionId, enabled: true };
  assert.equal((await save({ ...settings, sectionId: 'missing' })).status, 404);
  assert.equal((await save({ ...settings, enabled: 'true' })).status, 400);
  actor = { isAdmin: false }; assert.equal((await save(settings)).status, 403);
  actor = { isAdmin: true }; assert.equal((await save(settings)).status, 200);
  const users = load('lib/auth/currentUser.ts', { 'server-only': {}, './session': {}, './passcodes': {},
    './courseAccessStorage': { getCoursesAndSectionsData: async () => catalog }, './types': { FIXED_ADMIN_EMAIL: 'admin@example.test' }, '@/lib/supabase/server': {} });
  assert.equal((await users.currentUserAccess(undefined, { role: 'admin' })).sections[0].terminationEnabled, true);
  assert.equal((await save({ ...settings, enabled: false })).status, 200);
  assert.equal((await users.currentUserAccess(undefined, { role: 'admin' })).sections[0].terminationEnabled, false);
});

test('the same opt-in control resets the existing Applied Agentic AI quiz state', async () => {
  const state = { termination_token: 'old', quiz_open: true, quiz_opened_at: 'old' };
  const access = { isActive:true,isAdmin:true,email:'admin@example.test',courses:[{id:'core',slug:'applied-agentic-ai'}],sections:[{id:'core-section',courseId:'core',sectionKey:'section1',terminationEnabled:true}] };
  const db = { from(table) { assert.equal(table,'section_state'); return {
    select(){return this;},eq(){return this;},maybeSingle:async()=>({data:state}),
    upsert:async value=>{Object.assign(state,value);return {error:null};},
  };} };
  const route = load('app/api/sections/[id]/control/route.ts', {
    'next/server':{NextResponse:Response},'@/lib/auth/currentUser':{currentUserAccess:async()=>access},
    '@/lib/auth/types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'},'@/lib/supabase/server':{getSupabaseAdmin:()=>db},'@/lib/sectionTermination':{},
  });
  const context={params:Promise.resolve({id:'core-section'})};
  assert.equal((await route.POST(new Request('http://localhost/control',{method:'POST'}),context)).status,200);
  assert.equal(state.quiz_open,false);assert.equal(state.quiz_opened_at,null);
  assert.notEqual(state.termination_token,'old');assert.ok(state.session_started_at);
  assert.equal((await (await route.GET(new Request('http://localhost/control'),context)).json()).terminationToken,state.termination_token);
});

test('teacher opens the shared quiz, learner completes ten questions, restores the result and submits feedback', async () => {
  const f = fixture(); f.access.sections[0].canFacilitate = true;
  const window = new Window({ url: 'http://localhost' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement']) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const originalTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 620 ? 0 : delay, ...args);
  const requests = [];
  const fetch = async (url, options) => { requests.push(url); return options?.method === 'POST' ? f.post(JSON.parse(options.body)) : f.get(); };
  const liveRefresh = load('lib/liveRefresh.ts');
  const Quiz = load('components/QuizSlide.tsx', {
    '@/lib/webDevelopmentQuiz': bank, '@/lib/liveRefresh': liveRefresh,
    '@/lib/supabase/browser': { getSupabaseBrowserClient: () => null },
  }, { window, document: window.document, fetch }).default;
  const { createRoot } = await import('react-dom/client');
  const container = window.document.createElement('div'); window.document.body.append(container); const root = createRoot(container);
  try {
    const props = { scale: 1, sectionId, courseTitle: 'AI-Powered Web Development' };
    await act(async () => { root.render(React.createElement(Quiz, { ...props, key: 'teacher', isAdmin: true })); await new Promise(resolve => setTimeout(resolve, 25)); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)));
    await act(async () => container.querySelector('.openQuizButton').click());
    assert.ok(container.querySelector('[role="dialog"]'));
    await act(async () => { container.querySelector('.confirmOpenButton').click(); await new Promise(resolve => setTimeout(resolve, 15)); });
    assert.ok(container.querySelector('.adminResultsStage'));
    assert.equal(f.rows.filter(row => row.action === 'QUIZ_OPENED').length, 1);
    f.access.sections[0].canFacilitate = false;
    await act(async () => { root.render(React.createElement(Quiz, { ...props, key: 'learner' })); await new Promise(resolve => setTimeout(resolve, 25)); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)));
    assert.equal(container.querySelector('a[href*="handout"]'), null);
    for (const question of questions) {
      assert.equal(container.querySelector('.questionCard h2').textContent, question.question);
      await act(async () => { container.querySelectorAll('.option')[question.answer].click(); await new Promise(resolve => setTimeout(resolve, 15)); });
    }
    await act(async () => new Promise(resolve => setTimeout(resolve, 15)));
    assert.equal(container.querySelector('.score strong').textContent, '10');
    assert.ok(container.querySelector('.inlineFeedbackForm'));
    assert.match(container.querySelector('.submittedInfo').textContent, /Alice/);
    await act(async () => { root.render(React.createElement(Quiz, { ...props, key: 'restored-learner' })); await new Promise(resolve => setTimeout(resolve, 25)); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)));
    assert.equal(container.querySelector('.score strong').textContent, '10');
    assert.equal(f.rows.filter(row => row.action === 'QUIZ_COMPLETED').length, 1);
    const input = container.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { setter.call(input, 'Very useful'); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
    await act(async () => { container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await new Promise(resolve => setTimeout(resolve, 15)); });
    assert.equal(f.rows.filter(row => row.action === 'FEEDBACK_SUBMITTED').length, 1);
    assert.equal(container.querySelector('.inlineFeedbackForm'), null);
    assert.ok(requests.every(url => url === `/api/sections/${sectionId}/quiz`));
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test('teacher can open before the initial read finishes, duplicate confirmation is ignored and late closed state cannot undo success', async () => {
  const window = new Window({url:'http://localhost'});
  for(const name of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const {createRoot}=await import('react-dom/client');
  const reads=[];let writes=0;
  const Quiz=load('components/QuizSlide.tsx',{
    '@/lib/webDevelopmentQuiz':bank,'@/lib/liveRefresh':load('lib/liveRefresh.ts'),
    '@/lib/supabase/browser':{getSupabaseBrowserClient:()=>null},
  },{window,document:window.document,fetch:async(_url,options)=>{
    if(options?.method==='POST'){writes++;return {ok:true,json:async()=>({success:true,isOpen:true})};}
    return new Promise(resolve=>reads.push(resolve));
  }}).default;
  const container=window.document.createElement('div'),root=createRoot(container);
  try{
    await act(async()=>{root.render(React.createElement(Quiz,{isAdmin:true,sectionId,courseTitle:'Web',sectionTitle:'Section 1',scale:1}));await new Promise(resolve=>setTimeout(resolve,15));});
    await act(async()=>new Promise(resolve=>setTimeout(resolve,15)));
    assert.equal(reads.length,1);
    assert.equal(container.querySelector('.openQuizButton').disabled,false,'the server rechecks permission on the open action');
    await act(async()=>container.querySelector('.openQuizButton').click());
    await act(async()=>{container.querySelector('.confirmOpenButton').click();container.querySelector('.confirmOpenButton').click();});
    assert.equal(writes,1);
    assert.ok(container.querySelector('.adminResultsStage'),'successful persistence updates the teacher screen without another GET');
    await act(async()=>reads[0]({ok:true,json:async()=>({isOpen:false,completedLearners:[]})}));
    assert.ok(container.querySelector('.adminResultsStage'),'a late pre-open read must not close the UI again');
    assert.equal(reads.length,2,'one queued refresh reads the new state in the background');
    await act(async()=>reads[1]({ok:true,json:async()=>({isOpen:true,completedLearners:[]})}));
    assert.ok(container.querySelector('.adminResultsStage'));
  }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});

test('learners detect an open quiz within the two-second fallback without realtime and slow polling after opening', async () => {
  const window = new Window({ url: 'http://localhost' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement']) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window.document, 'visibilityState', { value: 'visible', configurable: true });
  const intervals = new Map(); let nextId = 0, open = false, reads = 0;
  window.setInterval = (callback, delay) => { const id = ++nextId; intervals.set(id, { callback, delay }); return id; };
  window.clearInterval = id => intervals.delete(id);
  const { createRoot } = await import('react-dom/client');
  const Quiz = load('components/QuizSlide.tsx', {
    '@/lib/webDevelopmentQuiz': bank, '@/lib/liveRefresh': load('lib/liveRefresh.ts'),
    '@/lib/supabase/browser': { getSupabaseBrowserClient: () => null },
  }, { window, document: window.document, fetch: async () => {
    reads++; return { ok: true, json: async () => ({ isOpen: open, quizSession: 'initial', result: null }) };
  } }).default;
  const container = window.document.createElement('div'), root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(Quiz, { sectionId, scale: 1 })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 15)));
    assert.equal(reads, 1);
    assert.equal(intervals.size, 1);
    assert.equal([...intervals.values()][0].delay, 2000);
    assert.equal(container.querySelector('.questionCard'), null);
    open = true;
    await act(async () => { [...intervals.values()][0].callback(); await Promise.resolve(); });
    assert.equal(reads, 2);
    assert.ok(container.querySelector('.questionCard'));
    assert.equal(intervals.size, 1);
    assert.equal([...intervals.values()][0].delay, 8000);
    Object.defineProperty(window.document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => [...intervals.values()][0].callback());
    assert.equal(reads, 2, 'hidden quiz does not poll');
  } finally { await act(async () => root.unmount()); assert.equal(intervals.size, 0); await window.happyDOM.close(); }
});

test('uploaded deck binds the quiz marker to the active frame, section and page', async () => {
  const window = new Window({ url: 'http://localhost' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement']) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const container = window.document.createElement('div'); window.document.body.append(container); const root = createRoot(container);
  const Deck = load('components/deck/UploadedSectionDeck.tsx', {
    'next/dynamic': { __esModule: true, default: loader => String(loader).includes('QuizSlide') ? props => React.createElement('div', { 'data-native-quiz': props.sectionId, 'data-teaching': String(props.isAdmin) }) : () => null },
    '@/components/deck/SharedDeckFrame': { __esModule: true, default: ({ renderSlide }) => renderSlide(32, 960) },
    '@/components/HairlineLoading': { __esModule: true, default: () => null },
    '@/components/ShowcaseSlide': { __esModule: true, default: () => null },
    '@/components/QuizSlide': { __esModule: true, default: props => React.createElement('div', { 'data-native-quiz': props.sectionId, 'data-teaching': String(props.isAdmin) }) },
    '@/lib/compiledSectionMetadata': { getCompiledSectionMetadata: () => undefined },
    '@/lib/webDevelopmentQuiz': bank, '@/lib/tsxDocument': { createTsxDocument: () => '<html><body>Quiz placeholder</body></html>' },
  }, { window, document: window.document, fetch: async () => ({ ok: true, text: async () => 'exports.default=[];' }) }).default;
  try {
    await act(async () => { root.render(React.createElement(Deck, { sectionId, contentType: 'tsx', slideCount: 32, courseTitle: 'Web', sectionTitle: 'Section 1', isAdmin: true })); await new Promise(resolve => setTimeout(resolve, 15)); });
    const frame = container.querySelector('iframe'); assert.ok(frame);
    const send = async (source, requestId) => act(async () => {
      const event = new window.Event('message'); Object.defineProperties(event, { source: { value: source }, data: { value: { type: 'eiu-slide-interaction', interaction: 'quiz', page: 32, requestId } } }); window.dispatchEvent(event);
    });
    await send({}, `${sectionId}:32`); assert.equal(container.querySelector('[data-native-quiz]'), null);
    await send(frame.contentWindow, 'other-section:32'); assert.equal(container.querySelector('[data-native-quiz]'), null);
    await send(frame.contentWindow, `${sectionId}:32`);
    assert.equal(container.querySelector('[data-native-quiz]').getAttribute('data-native-quiz'), sectionId);
    assert.equal(container.querySelector('[data-native-quiz]').getAttribute('data-teaching'), 'true');
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});
