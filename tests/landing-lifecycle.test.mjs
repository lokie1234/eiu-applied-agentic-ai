import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
function load(file, dependencies, globals) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, AbortController, AbortSignal, setTimeout, clearTimeout, ...globals,
    require: name => dependencies[name] ?? (name.endsWith(".css") ? new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }) : require(name)),
  });
  return exports.default;
}
async function fixture() {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  return { window, container, root, close: async () => { await act(async () => root.unmount()); await window.happyDOM.close(); } };
}
function landing(f, fetch, frameGlobals = {}) {
  let props, entrance, scene;
  const empty = { __esModule: true, default: () => null };
  const Component = load("components/LandingPage.tsx", {
    "@/lib/learningLanguage": { useLearningLanguage: () => ({ setLanguage: language => f.window.localStorage.setItem("eiu.learning-interface-language", language) }) },
    "next/image": empty, "next/dynamic": { __esModule: true, default: () => current => { if (current.mouseRef) scene = current; return null; } },
    "motion/react": { useReducedMotion: () => frameGlobals.reducedMotion ?? true, motion: { nav: ({ children, className }) => React.createElement("nav", { className }, children) } },
    "./EiuAgentBot": empty, "./landing/EntranceBootOverlay": { __esModule: true, default: current => { entrance = current; return null; } },
    "./landing/AnimatedHeroCopy": { __esModule: true, default: current => { props = current; return null; } },
  }, { window: f.window, document: f.window.document, fetch,
    requestAnimationFrame: callback => f.window.requestAnimationFrame(callback), cancelAnimationFrame: id => f.window.cancelAnimationFrame(id), ...frameGlobals });
  return { Component, props: () => props, entrance: () => entrance, scene: () => scene };
}

test("language card stays hidden throughout the boot fade and resets its entrance on reload", async () => {
  const f = await fixture();
  const view = landing(f, () => { throw new Error("No request expected"); });
  try {
    await act(async () => f.root.render(React.createElement(view.Component, { key: "first-visit" })));
    assert.equal(view.props().entranceReady, false);
    await act(async () => view.entrance().onStartExit());
    assert.equal(view.props().entranceReady, false, "card must not finish fading beneath the boot overlay");
    await act(async () => view.entrance().onComplete());
    assert.equal(view.props().entranceReady, true);
    assert.equal(f.container.querySelector('main').style.transform, '', 'the full-page compositing transform is released after boot');
    await act(async () => f.root.render(React.createElement(view.Component, { key: "reload" })));
    assert.equal(view.props().entranceReady, false, "a new visit starts with the card concealed again");
  } finally { await f.close(); }
});

test("hero reveals login immediately after language selection while the robot returns", () => {
  const Copy = load("components/landing/AnimatedHeroCopy.tsx", {
    "motion/react": { useReducedMotion: () => false, motion: { div: ({ children, inert }) => React.createElement("div", { inert }, children) } },
    "./SignInCard": { __esModule: true, default: () => React.createElement("div", { "data-login-card": true }) },
    "../EiuAgentBot": { __esModule: true, default: () => null },
  }, {});
  const render = phase => renderToStaticMarkup(React.createElement(Copy, {
    stage: 7, entranceReady: true, introPhase: phase, languageAnchor: { current: null }, onChooseLanguage() {},
  }));
  for (const phase of ["arriving", "choosing"]) {
    const html = render(phase);
    assert.doesNotMatch(html, /data-login-card/);
    assert.match(html, new RegExp(`data-visible="${phase === "choosing"}"`));
  }
  assert.match(render("returning"), /data-login-card/);
  assert.doesNotMatch(render("returning"), />VIE<|>ENG</);
  assert.match(render("ready"), /data-login-card/);
  assert.doesNotMatch(render("ready"), />VIE<|>ENG</);
});

test("robot waits for a language choice and continues returning alongside login", async () => {
  const f = await fixture(), timers = new Map(); let nextId = 0;
  const view = landing(f, () => { throw new Error("No request expected"); }, {
    setTimeout: (callback, delay) => { timers.set(++nextId, { callback, delay }); return nextId; },
    clearTimeout: id => timers.delete(id),
  });
  try {
    await act(async () => f.root.render(React.createElement(view.Component)));
    assert.equal(view.props().introPhase, "arriving");
    await act(async () => view.entrance().onComplete());
    const arrival = [...timers.values()].filter(timer => timer.delay === 0).at(-1);
    await act(async () => arrival.callback());
    assert.equal(view.props().introPhase, "choosing");
    await act(async () => view.props().onChooseLanguage("vi"));
    assert.equal(f.window.localStorage.getItem("eiu.learning-interface-language"), "vi");
    assert.equal(view.props().introPhase, "returning", "robot continues returning while login is available");
    const returning = [...timers.values()].find(timer => timer.delay === 150);
    await act(async () => returning.callback());
    assert.equal(view.props().introPhase, "ready");
    assert.equal(view.props().initialLanguageChosen, true, "the login card skips its old language step");
    await act(async () => f.root.render(React.createElement(view.Component, { key: "reload" })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 20)));
    assert.equal(view.props().introPhase, "ready", "a recent choice restores login on reload");
  } finally { await f.close(); }
});

test("refresh within ten minutes skips language and boot without extending the choice lifetime", async () => {
  const f=await fixture();let now=Date.now();
  class ClockDate extends Date { static now(){return now;} }
  const key="eiu.landing-language-choice";
  f.window.localStorage.setItem("eiu.learning-interface-language","vi");
  const selectedAt=now-599_000;
  f.window.localStorage.setItem(key,JSON.stringify({language:"vi",selectedAt}));
  const view=landing(f,()=>{throw Error("Restoring language must not make requests");},{Date:ClockDate,reducedMotion:false});
  const render=async id=>{
    await act(async()=>f.root.render(React.createElement(view.Component,{key:id})));
    await act(async()=>new Promise(resolve=>setTimeout(resolve,20)));
  };
  try{
    await render('recent');
    assert.equal(view.props().introPhase,'ready');
    assert.equal(view.props().entranceReady,true);
    assert.equal(view.props().stage,7);
    assert.equal(JSON.parse(f.window.localStorage.getItem(key)).selectedAt,selectedAt,'refresh does not restart the ten-minute window');
    await act(async()=>new Promise(resolve=>setTimeout(resolve,180)));
    assert.equal(view.props().stage,7,'the old boot timeline cannot hide login again');
    now=selectedAt+600_000;
    await render('expired');
    assert.equal(view.props().introPhase,'arriving');
    f.window.localStorage.setItem(key,'invalid json');
    await render('invalid');
    assert.equal(view.props().introPhase,'arriving');
    await act(async()=>view.props().onChooseLanguage('en'));
    assert.deepEqual(JSON.parse(f.window.localStorage.getItem(key)),{language:'en',selectedAt:now});
    await render('new-choice');
    assert.equal(view.props().introPhase,'ready');
  }finally{await f.close();}
});

test("full 3D greeting waits for the robot arrival and return callbacks", async () => {
  const f = await fixture(), timers = new Map(); let nextId = 0;
  const view = landing(f, () => { throw new Error("No request expected"); }, {
    reducedMotion: false,
    setTimeout: (callback, delay) => { timers.set(++nextId, { callback, delay }); return nextId; },
    clearTimeout: id => timers.delete(id),
  });
  try {
    await act(async () => f.root.render(React.createElement(view.Component)));
    await act(async () => [...timers.values()].find(timer => timer.delay === 150).callback());
    await act(async () => view.entrance().onComplete());
    assert.equal(view.props().introPhase, "arriving");
    assert.equal(view.scene().languageScreen, view.props().languageScreen, 'buttons share the actual 3D visor anchor');
    await act(async () => view.scene().onLanguageArrival());
    assert.equal(view.props().introPhase, "choosing");
    await act(async () => view.props().onChooseLanguage("en"));
    assert.equal(view.props().introPhase, "returning");
    assert.equal(view.scene().returningToOrbit, true);
    assert.equal(view.scene().languageIntro, false);
    await act(async () => view.scene().onLanguageArrival());
    assert.equal(view.props().introPhase, "returning", 'late greeting callbacks cannot interrupt the return flight');
    await act(async () => view.scene().onOrbitArrival());
    assert.equal(view.props().introPhase, "ready");
    assert.equal(view.scene().returningToOrbit, false);
  } finally { await f.close(); }
});

test("entrance progress grows, waits for preparation, reaches 100 before fading, and clears timers", async () => {
  const f = await fixture();
  let now = 0, nextId = 0, exiting = 0, completed = 0;
  const timers = new Map();
  const schedule = (callback, delay, repeat = false) => {
    const id = ++nextId;
    timers.set(id, { callback, at: now + delay, delay, repeat });
    return id;
  };
  const advance = async milliseconds => {
    const end = now + milliseconds;
    for (;;) {
      const entry = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, task] = entry;
      now = task.at;
      if (task.repeat) task.at += task.delay; else timers.delete(id);
      await act(async () => task.callback());
    }
    now = end;
  };
  const Overlay = load("components/landing/EntranceBootOverlay.tsx", {
    "next/image": { __esModule: true, default: ({ alt }) => React.createElement("img", { alt }) },
  }, {
    performance: { now: () => now },
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
  });
  const onStartExit = () => exiting++, onComplete = () => completed++;
  const render = ready => f.root.render(React.createElement(Overlay, { ready, onStartExit, onComplete }));
  const progress = () => Number(f.container.querySelector('[role="progressbar"]').getAttribute("aria-valuenow"));
  try {
    await act(async () => render(false));
    assert.equal(progress(), 0);
    await advance(900);
    assert.ok(progress() > 0 && progress() < 100);
    assert.equal(exiting, 0);
    await act(async () => render(true));
    await advance(180);
    assert.equal(progress(), 100);
    assert.equal(exiting, 0, "100% remains visible while the fill finishes");
    assert.equal(f.container.querySelector('.progressFill').style.transform, "scaleX(1)");
    await advance(220);
    assert.equal(exiting, 1); assert.equal(completed, 0);
    await advance(480);
    assert.equal(completed, 1);
    await act(async () => f.root.unmount());
    assert.equal(timers.size, 0);
  } finally { await f.close(); }
});

test("landing coalesces simultaneous submits, permits retry, and aborts on departure", async () => {
  const f = await fixture(), requests = [];
  const view = landing(f, (url, options) => new Promise(resolve => requests.push({ url, options, resolve })));
  let first, second;
  const event = { preventDefault() {} };
  try {
    await act(async () => f.root.render(React.createElement(view.Component)));
    await act(async () => view.props().setPasscode("12345"));
    await act(async () => view.props().onSubmit(event));
    assert.equal(requests.length, 0, "incomplete codes never leave the client");
    await act(async () => view.props().setPasscode("012345"));
    await act(async () => { first = view.props().onSubmit(event); await view.props().onSubmit(event); });
    assert.equal(requests.length, 1, "same-render submits share a synchronous lock");
    assert.equal(requests[0].url, "/api/auth/access");
    assert.equal(JSON.parse(requests[0].options.body).passcode, "012345");
    await act(async () => { requests[0].resolve({ ok: false, status: 401, json: async () => ({ success: false, message: "Incorrect or inactive passcode. Please contact your instructor." }) }); await first; });
    assert.equal(view.props().loading, false); assert.equal(view.props().error, "Wrong passcode");
    await act(async () => { second = view.props().onSubmit(event); });
    assert.equal(requests.length, 2); assert.equal(requests[1].options.signal.aborted, false);
    await act(async () => f.root.unmount());
    assert.equal(requests[1].options.signal.aborted, true);
    requests[1].resolve({ ok: true, json: async () => ({ requiresInformation: true, fields: [{ id: "name" }] }) });
    await second;
  } finally { await f.close(); }
});

test("landing reads pointer geometry once per frame and cancels pending work on unmount", async () => {
  const f = await fixture(), frames = new Map(); let frame = 0, reads = 0;
  const view = landing(f, () => { throw new Error("No request is expected"); }, {
    reducedMotion: false,
    requestAnimationFrame: callback => { frames.set(++frame, callback); return frame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  try {
    await act(async () => f.root.render(React.createElement(view.Component)));
    const main = f.container.querySelector("main");
    main.getBoundingClientRect = () => { reads++; return { left: 0, top: 0, width: 1000, height: 700 }; };
    main.dispatchEvent(new f.window.PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: 20, clientY: 20 }));
    assert.equal(frames.size, 0, 'language selection does not schedule unused pointer tracking');
    await act(async () => view.props().onChooseLanguage("en"));
    for (let i = 0; i < 40; i++) main.dispatchEvent(new f.window.PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: i, clientY: i }));
    assert.equal(frames.size, 1); assert.equal(reads, 0);
    const [id, callback] = [...frames][0]; frames.delete(id); callback();
    assert.equal(reads, 1);
    main.dispatchEvent(new f.window.PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
    await act(async () => f.root.unmount()); assert.equal(frames.size, 0);
  } finally { await f.close(); }
});

test("reduced-motion fallback never starts its JavaScript flight loop", async () => {
  const f = await fixture(); let frames = 0;
  const Bot = load("components/EiuAgentBot.tsx", {}, {
    window: f.window, document: f.window.document,
    requestAnimationFrame: () => { frames++; return frames; }, cancelAnimationFrame() {},
  });
  try {
    await act(async () => f.root.render(React.createElement(Bot, { reducedMotion: true })));
    assert.equal(frames, 0); assert.ok(f.container.querySelector(".staticBot"));
    assert.equal(f.container.querySelector('[role="button"]'), null);
  } finally { await f.close(); }
});

test("fallback flight stops offscreen or in a hidden tab, resumes once, and cancels on departure", async () => {
  const f = await fixture(), frames = new Map();
  let nextId = 0, hidden = false, observe;
  Object.defineProperty(f.window.document, "hidden", { configurable: true, get: () => hidden });
  const Bot = load("components/EiuAgentBot.tsx", {}, {
    window: f.window, document: f.window.document,
    requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class { constructor(callback) { observe = callback; } observe() {} disconnect() {} },
  });
  try {
    await act(async () => f.root.render(React.createElement(Bot, { reducedMotion: false })));
    assert.equal(frames.size, 1);
    hidden = true;
    await act(async () => f.window.document.dispatchEvent(new f.window.Event("visibilitychange")));
    assert.equal(frames.size, 0);
    hidden = false;
    await act(async () => f.window.document.dispatchEvent(new f.window.Event("visibilitychange")));
    assert.equal(frames.size, 1);
    await act(async () => observe([{ isIntersecting: false }]));
    assert.equal(frames.size, 0);
    await act(async () => observe([{ isIntersecting: true }]));
    assert.equal(frames.size, 1);
    await act(async () => f.root.unmount());
    assert.equal(frames.size, 0);
  } finally { await f.close(); }
});
