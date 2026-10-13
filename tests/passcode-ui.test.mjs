import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import learningIdentity from "./helpers/learning-identity.mjs";
const require = createRequire(import.meta.url);
const liveRefresh = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/liveRefresh.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: liveRefresh, require, AbortController, AbortSignal });
function moduleExports(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, console, Date, AbortController, AbortSignal, crypto: globalThis.crypto, window: globalThis.window, document: globalThis.document, fetch: (...args) => globalThis.fetch(...args), require: name => {
    if (name === "./LearnerInformationDialog") return { __esModule: true, default: component("components/landing/LearnerInformationDialog.tsx") };
    if (name === "./EiuConfirmDialog") return { __esModule: true, default: component("components/admin/EiuConfirmDialog.tsx") };
    if (name === "./LearnerInformationSettings") return { __esModule: true, default: component("components/admin/LearnerInformationSettings.tsx", { "@/lib/learningIdentity": learningIdentity }) };
    if (name === "@/lib/deckLocation") return { rememberDeckSelection() {} };
    if (name === "@/lib/liveRefresh") return liveRefresh;
    if (name === "@/lib/sectionSlideCount") return { readSectionSlideCount: async () => 5 };
    if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
    if (dependencies[name]) return dependencies[name];
    if (name.startsWith(".")) {
      const local = [".tsx", ".ts"].map(extension => resolve(dirname(path), name + extension)).find(file => fs.existsSync(file));
      if (local) return moduleExports(local, dependencies);
    }
    if (name.startsWith("@/")) return moduleExports(`${name.slice(2)}.ts`, dependencies);
    return require(name);
  } });
  return exports;
}
function component(path, dependencies = {}) { return moduleExports(path, dependencies).default; }

test("section cards show actual totals without formats and automatically include newly added sections", async () => {
  const window = new Window({ url: "http://localhost/learn" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  const Portal = component("components/LessonPortal.tsx", {
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "next/dynamic": { __esModule: true, default: () => () => null },
    "next/image": { __esModule: true, default: () => null },
    "next/link": { __esModule: true, default: props => React.createElement("a", { href: props.href }, props.children) },
    "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai" },
    "@/lib/supabase/browser": { getSupabaseBrowserClient: () => null }, "@/lib/slideStorage": {},
  });
  const makeSection = (id, sectionKey, contentType, position) => ({ id, sectionKey, contentType, position, title: "Phát triển Web App", slideCount: 999 });
  const course = { id: "course", slug: "applied-agentic-ai", title: "Course", sections: [
    makeSection("one", "section1", "builtin", 1), makeSection("two", "section2", "builtin", 2), makeSection("three", "custom", "tsx", 3),
  ] };
  const container = window.document.createElement("div"), root = createRoot(container);
  const render = (currentCourse, isAdmin = false) => root.render(React.createElement(Portal, { isAdmin, initialCourseId: "course", initialSection: null, initialProfile: null, courseFolders: [currentCourse] }));
  const labels = () => [...container.querySelectorAll(".sectionLaunchButton small")].map(node => node.textContent);
  try {
    await act(async () => render(course));
    assert.deepEqual(labels(), ["41 slides", "39 slides", "5 slides"]);
    assert.equal(container.querySelectorAll(".sectionSlideBadge").length, 3);
    assert.equal(container.querySelector(".sectionLaunchButton strong").title, "Phát triển Web App");
    await act(async () => render({ ...course, sections: [...course.sections, makeSection("new", "future", "pdf", 4)] }, true));
    assert.deepEqual(labels(), ["42 slides", "39 slides", "5 slides", "5 slides"]);
    assert.ok(labels().every(label => !/TSX|PDF|PPTX|Interactive|999/.test(label)));
  } finally { await act(async () => root.unmount()); globalThis.fetch = previousFetch; await window.happyDOM.close(); }
});

test("landing offers passcode and admin Google sign-in without username login", () => {
  const SignIn = component("components/landing/SignInCard.tsx");
  const html = renderToStaticMarkup(React.createElement(SignIn, { passcode: "", setPasscode() {}, onSubmit() {}, loading: false }));
  assert.match(html, /Passcode/); assert.match(html, /Learner or facilitator access/);
  assert.match(html, /Administrator account only/); assert.doesNotMatch(html, /Username|registered account/);
});

test("completed quiz shows the identity confirmed by the server, including custom fields", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => url.startsWith("/api/quiz-control") ? { isOpen: true } : { success: true, learner: { name: "Alice", email: "alice@example.test", information: { name: "Alice", email: "alice@example.test", department: "IT" }, fields: [{ id: "department", label: "Department" }] } } });
  const originalTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 620 ? 0 : delay, ...args);
  const Quiz = component("components/QuizSlide.tsx", { "@/lib/supabase/browser": { getSupabaseBrowserClient: () => null } });
  const container = window.document.createElement("div"); window.document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => { root.render(React.createElement(Quiz, { scale: 1 })); await new Promise(resolve => setTimeout(resolve, 10)); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
    for (let i = 0; i < 10; i++) await act(async () => { container.querySelector(".option").click(); await new Promise(resolve => setTimeout(resolve, 10)); });
    const summary = container.querySelector(".submittedInfo");
    assert.ok(summary); assert.match(summary.textContent, /Alice/); assert.match(summary.textContent, /alice@example.test/); assert.match(summary.textContent, /Department:IT/);
    assert.doesNotMatch(summary.textContent, /Đã nhận từ phiên đăng nhập/);
  } finally { await act(async () => root.unmount()); globalThis.fetch = previousFetch; await window.happyDOM.close(); }
});

test("completed quiz restores on remount even when closed and keeps feedback inside the quiz", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const previousFetch = globalThis.fetch;
  let posts = 0, feedbackSubmitted = false;
  const reads = [];
  globalThis.fetch = async (url, options) => {
    if (options?.method === "POST") posts++;
    else reads.push(url);
    return { ok: true, json: async () => ({ success: true, isOpen: false, result: { answers: Array.from({ length: 10 }, (_, i) => ({ isCorrect: i < 8 })), learner: { name: "Alice", email: "alice@example.test", information: {}, fields: [] }, feedbackSubmitted } }) };
  };
  const Quiz = component("components/QuizSlide.tsx", { "@/lib/supabase/browser": { getSupabaseBrowserClient: () => null } });
  const container = window.document.createElement("div"); window.document.body.append(container); const root = createRoot(container);
  try {
    for (const key of ["refresh", "back"]) {
      await act(async () => { root.render(React.createElement(Quiz, { scale: 1, key })); await new Promise(resolve => setTimeout(resolve, 20)); });
      await act(async () => new Promise(resolve => setTimeout(resolve, 20)));
      assert.equal(container.querySelector(".score strong").textContent, "8");
      assert.equal(container.querySelector(".option"), null);
      assert.ok(container.querySelector(".inlineFeedbackForm textarea"));
      assert.equal(container.querySelector('[role="dialog"]'), null);
    }
    feedbackSubmitted = true;
    await act(async () => { root.render(React.createElement(Quiz, { scale: 1, key: "feedback-refresh" })); await new Promise(resolve => setTimeout(resolve, 20)); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 20)));
    assert.equal(container.querySelector("textarea"), null); assert.equal(posts, 0);
    assert.equal(reads.length, 3);
    assert.ok(reads.every(url => url.includes("/api/quiz-control?") && url.includes("includeProgress=1")), "each remount restores status and progress in one request");
  } finally { await act(async () => root.unmount()); globalThis.fetch = previousFetch; await window.happyDOM.close(); }
});

test("learner information opens a separate modal with focus, submission, and cancel controls", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const SignIn = component("components/landing/SignInCard.tsx");
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  let fields = [], cancelled = 0, submitted = 0;
  const render = () => root.render(React.createElement(SignIn, { passcode: "123456", setPasscode() {}, identityFields: fields, information: { name: "Alice" }, loading: false, onSubmit: e => { e.preventDefault(); submitted++; }, onInformationCancel: () => { cancelled++; fields = []; render(); } }));
  try {
    await act(async () => render());
    await act(async () => Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Passcode")).click());
    fields = [{ id: "name", label: "Name", type: "text" }];
    await act(async () => render());
    const dialog = window.document.querySelector("dialog");
    assert.equal(dialog.open, true); assert.equal(dialog.parentElement, window.document.body); assert.equal(container.querySelector("#learner-name"), null);
    assert.equal(window.document.activeElement.id, "learner-name");
    await act(async () => dialog.querySelector('button[type="submit"]').click()); assert.equal(submitted, 1);
    await act(async () => dialog.querySelector('[aria-label="Close learner information"]').click());
    assert.equal(cancelled, 1); assert.equal(window.document.querySelector("dialog"), null); assert.equal(container.querySelector("#hero-passcode-input").value, "123456");
    fields = [{ id: "name", label: "Name", type: "text" }]; await act(async () => render());
    await act(async () => window.document.querySelector("dialog").dispatchEvent(new window.Event("cancel", { cancelable: true })));
    assert.equal(cancelled, 2); assert.equal(window.document.querySelector("dialog"), null);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test("admin can enable required learner information and choose fields without changing passcodes", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const Manager = component("components/admin/PasscodeManager.tsx");
  const calls = []; const container = window.document.createElement("div"); const root = createRoot(container);
  const click = text => Array.from(container.querySelectorAll("button")).find(button => button.textContent === text).click();
  try {
    await act(async () => root.render(React.createElement(Manager, { folders: [], courses: [], onSave: async body => { calls.push(body); return true; } })));
    await act(async () => container.querySelector('.identityToggle input').click());
    await act(async () => click("Save settings"));
    assert.equal(calls[0].action, "set_learning_identity_policy"); assert.equal(calls[0].policy.enabled, true); assert.equal(calls[0].policy.fields.map(f => f.id).join(","), "name,email");
    await act(async () => container.querySelector('[aria-label="Remove Email"]').click());
    await act(async () => click("Save settings")); assert.equal(calls[1].policy.fields.length, 1);
    await act(async () => click("Add field"));
    assert.equal(Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Save settings").disabled, true);
    assert.equal(container.querySelectorAll('.identityRow').length, 2);
    assert.doesNotMatch(container.textContent, /Add Name|Add Email|Required when enabled/);
    await act(async () => container.querySelector('[aria-label="Remove field"]').click());
    await act(async () => container.querySelector('.identityToggle input').click());
    await act(async () => click("Save settings")); assert.equal(calls[2].policy.enabled, false);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test("admin can choose Number, save its limits, and cannot save reversed bounds", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const Settings = component("components/admin/LearnerInformationSettings.tsx", { "@/lib/learningIdentity": learningIdentity });
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container); const saved = [];
  const setInput = async (label, value) => act(async () => {
    const input = container.querySelector(`[aria-label="${label}"]`);
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  try {
    await act(async () => root.render(React.createElement(Settings, { policy: { enabled: true, fields: [{ id: "age", label: "Age", type: "text" }] }, onSave: async body => { saved.push(body); return true; } })));
    await act(async () => { const select = container.querySelector("select"); select.value = "number"; select.dispatchEvent(new window.Event("change", { bubbles: true })); });
    await setInput("Age minimum", "18"); await setInput("Age maximum", "65");
    const save = () => Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Save settings");
    await act(async () => save().click());
    assert.equal(saved[0].policy.fields[0].type, "number"); assert.equal(saved[0].policy.fields[0].min, 18); assert.equal(saved[0].policy.fields[0].max, 65);
    await setInput("Age minimum", "70"); assert.equal(save().disabled, true); assert.match(container.querySelector('[role="alert"]').textContent, /Minimum must not exceed maximum/);
    await setInput("Age minimum", ""); await setInput("Age maximum", ""); await act(async () => save().click());
    assert.equal(saved[1].policy.fields[0].min, undefined); assert.equal(saved[1].policy.fields[0].max, undefined);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test("admin passcode manager exposes two independent permission types for each target", () => {
  const Manager = component("components/admin/PasscodeManager.tsx");
  const html = renderToStaticMarkup(React.createElement(Manager, { courses: [{ id: "c", title: "Course", metadata: { passcode: "1234" } }], folders: [{ id: "f", name: "Folder", accessCodes: { learner: "L1234", facilitator: "T1234" } }], sections: [{ id: "s", course_id: "c", title: "Section" }], onSave() {} }));
  assert.match(html, /value="folder:f"/); assert.match(html, /value="course:c"/); assert.doesNotMatch(html, /value="section:s"/);
  assert.match(html, /aria-label="learner passcode"[^>]*value="L1234"/);
  assert.match(html, /aria-label="facilitator passcode"[^>]*value="T1234"/);
  assert.match(html, /No admin or content-management access/);
  assert.match(html, /Global access/);
  assert.match(html, /aria-label="global learner passcode"/);
  assert.match(html, /Search folders and courses/);
});

test("facilitator decks enable quiz controls without exposing admin navigation or reset functions", () => {
  const Portal = component("components/LessonPortal.tsx", {
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "next/dynamic": { __esModule: true, default: () => props => React.createElement("div", { "data-teaching": String(props.isAdmin) }, "Deck") },
    "next/image": { __esModule: true, default: () => null },
    "next/link": { __esModule: true, default: props => React.createElement("a", { href: props.href }, props.children) },
    "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai" },
    "@/lib/supabase/browser": {}, "@/lib/slideStorage": {},
    "./deck/UploadedSectionDeck": { __esModule: true, default: () => null },
  });
  const course = { id: "c", slug: "applied-agentic-ai", title: "Course", sections: [{ id: "s", sectionKey: "section1", canFacilitate: true }] };
  const render = isAdmin => renderToStaticMarkup(React.createElement(Portal, { isAdmin, canFacilitate: true, initialCourseId: "c", initialSection: "section1", courseFolders: [course] }));
  const teaching = render(false);
  assert.match(teaching, /data-teaching="true"/);
  assert.doesNotMatch(teaching, /href="\/admin|Terminate|Reset data|Export/);
  assert.match(render(true), /href="\/admin/);
  course.sections[0].canFacilitate = false;
  assert.match(render(false), /data-teaching="false"/);
});

test("catalog refresh preserves an open visible section and withdraws it when hidden", async () => {
  const window = new Window({ url: "http://localhost/learn" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  let refreshes = 0;
  const router = { refresh: () => { refreshes++; } };
  const Portal = component("components/LessonPortal.tsx", {
    "next/navigation": { useRouter: () => router },
    "next/dynamic": { __esModule: true, default: () => () => React.createElement("div", { "data-open-deck": true }, "Deck") },
    "next/image": { __esModule: true, default: () => null },
    "next/link": { __esModule: true, default: props => React.createElement("a", { href: props.href }, props.children) },
    "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai" },
    "@/lib/supabase/browser": { getSupabaseBrowserClient: () => null }, "@/lib/slideStorage": {},
    "./deck/UploadedSectionDeck": { __esModule: true, default: () => null },
  });
  // This admin fixture skips learner heartbeat and termination listeners; no database requests run.
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  const container = window.document.createElement("div");
  const root = createRoot(container);
  const course = { id: "c", slug: "applied-agentic-ai", title: "Course", sections: [{ id: "s", sectionKey: "section1", title: "Section" }] };
  const render = folders => root.render(React.createElement(Portal, { isAdmin: true, initialProfile: null, initialCourseId: "c", initialSection: "section1", courseFolders: folders }));
  try {
    await act(async () => render([course]));
    assert.ok(container.querySelector("[data-open-deck]"));
    await act(async () => window.dispatchEvent(new window.Event("focus")));
    assert.equal(refreshes, 1);
    await act(async () => render([{ ...course, title: "Updated course" }]));
    assert.ok(container.querySelector("[data-open-deck]"));
    await act(async () => render([{ ...course, sections: [] }]));
    assert.equal(container.querySelector("[data-open-deck]"), null);
    await act(async () => render([]));
    assert.equal(container.querySelector("[data-open-deck]"), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = previousFetch;
    await window.happyDOM.close();
  }
});


test("global Generate and course Generate save to their own scopes", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const Manager = component("components/admin/PasscodeManager.tsx");
  const calls = [];
  const container = window.document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(Manager, { folders: [{id:"f",name:"Folder"}], courses: [{id:"c",folderGroupId:"f",title:"Course",metadata:{}}], sections: [{id:"s",course_id:"c",title:"Section"}], onSave: async body => {calls.push(body); return true;} })));
    await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Generate").click());
    assert.equal(calls[0].kind, "global"); assert.equal(calls[0].id, "all"); assert.equal(calls[0].mode, "learner");
    await act(async () => container.querySelector('button[value="course:c"]').click());
    const generate = Array.from(container.querySelectorAll("button")).filter(button => button.textContent === "Generate");
    await act(async () => generate[3].click());
    assert.equal(calls[1].kind, "course"); assert.equal(calls[1].id, "c"); assert.equal(calls[1].mode, "facilitator");
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});


test("hidden Generate waits for consent, Cancel leaves content unchanged, bulk confirmation passes unhide", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const Manager = component("components/admin/PasscodeManager.tsx");
  const calls = [], container = window.document.createElement("div"), root = createRoot(container);
  const button = text => Array.from(container.querySelectorAll("button")).find(item => item.textContent === text);
  try {
    await act(async () => root.render(React.createElement(Manager, { folders: [{id:"f",name:"Hidden Folder",hidden:true}], courses: [{id:"c",folderGroupId:"f",title:"Course",metadata:{}}], onSave: async body => {calls.push(body); return true;} })));
    await act(async () => Array.from(container.querySelectorAll("button")).filter(item=>item.textContent==="Generate")[2].click());
    assert.ok(container.querySelector('[role="dialog"]'));
    assert.match(container.textContent,/Unhide content and generate passcodes/);
    assert.equal(calls.length,0);
    await act(async () => button("Cancel").click());
    assert.equal(calls.length,0);
    assert.equal(container.querySelector('[role="dialog"]'),null);
    await act(async () => container.querySelector('input[aria-label="Select folder: Hidden Folder"]').click());
    await act(async () => container.querySelector('input[aria-label="Select course: Course"]').click());
    await act(async () => button("Generate selected").click());
    assert.equal(calls.length,0);
    await act(async () => button("Unhide & generate").click());
    assert.equal(calls.length,1);
    assert.equal(calls[0].action,"bulk_access_passcodes");assert.equal(calls[0].targets.length,2);
    assert.equal(calls[0].modes.join(","),"learner,facilitator");assert.equal(calls[0].unhide,true);
    await act(async () => button("Clear selected codes").click());
    assert.match(container.textContent,/Clear selected passcodes/);
    await act(async () => button("Clear passcodes").click());
    assert.equal(calls[1].operation,"clear");assert.equal(calls[1].unhide,false);
  } finally {await act(async () => root.unmount());await window.happyDOM.close();}
});
