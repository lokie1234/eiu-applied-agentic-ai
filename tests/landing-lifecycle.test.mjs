import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
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
  let props, entrance;
  const empty = { __esModule: true, default: () => null };
  const Component = load("components/LandingPage.tsx", {
    "next/image": empty, "next/dynamic": { __esModule: true, default: () => () => null },
    "motion/react": { useReducedMotion: () => frameGlobals.reducedMotion ?? true, motion: { nav: ({ children, className }) => React.createElement("nav", { className }, children) } },
    "./EiuAgentBot": empty, "./landing/EntranceBootOverlay": { __esModule: true, default: current => { entrance = current; return null; } },
    "./landing/AnimatedHeroCopy": { __esModule: true, default: current => { props = current; return null; } },
  }, { window: f.window, document: f.window.document, fetch,
    requestAnimationFrame: callback => f.window.requestAnimationFrame(callback), cancelAnimationFrame: id => f.window.cancelAnimationFrame(id), ...frameGlobals });
  return { Component, props: () => props, entrance: () => entrance };
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
    await act(async () => f.root.render(React.createElement(view.Component, { key: "reload" })));
    assert.equal(view.props().entranceReady, false, "a new visit starts with the card concealed again");
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
