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
  vm.runInNewContext(code, { exports, console, Date, URL:globalThis.window?.URL,AbortController, AbortSignal, ResizeObserver: globalThis.window?.ResizeObserver, IntersectionObserver: globalThis.window?.IntersectionObserver, MutationObserver: globalThis.window?.MutationObserver, requestAnimationFrame: callback=>globalThis.window.requestAnimationFrame(callback), cancelAnimationFrame: id=>globalThis.window.cancelAnimationFrame(id), crypto: globalThis.crypto, window: globalThis.window, document: globalThis.document, navigator:globalThis.window?.navigator,fetch: (...args) => globalThis.fetch(...args), require: name => {
    if (name === "./LearnerInformationDialog") return { __esModule: true, default: component("components/landing/LearnerInformationDialog.tsx") };
    if (name === "./SectionEnergy") return { __esModule: true, default: () => null };
    if (name === "./CourseDiscoveryHeading") return { __esModule: true, default: props => React.createElement("span", {"data-heading-online": props.onlineCount}) };
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
    assert.equal(container.querySelectorAll("[title]:not([data-course-tool])").length, 0, "only admin-assigned tool icons may display native tooltips");
    assert.equal(container.querySelector(".sectionLaunchButton strong").textContent, "Phát triển Web App");
    assert.equal(container.querySelector(".sectionLaunchButton strong").hasAttribute("title"), false, "card names must not create delayed native tooltips");
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
    "next/dynamic": { __esModule: true, default: loader => /PdfDeck|SectionTwoDeck/.test(String(loader)) ? () => React.createElement("div", { "data-open-deck": true }, "Deck") : () => null },
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
    assert.equal(refreshes, 0, "returning to a tab must not refresh the active deck");
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

test("admin learner badges and Folder → Course → Section export apply beyond the built-in course",async()=>{
  const window=new Window({url:'http://localhost/learn'});
  for(const name of ['window','document','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');
  const previousFetch=globalThis.fetch,requests=[];
  const folders=[{value:'f-ai',label:'AI Training'},{value:'f-web',label:'Web Training'}];
  const courses=[{value:'c-ai',label:'Applied AI',folderGroupId:'f-ai'},{value:'c-web',label:'Web Course',folderGroupId:'f-web'}];
  const scopes=[{value:'s-ai',label:'AI 1',courseId:'c-ai',courseTitle:'Applied AI',folderGroupId:'f-ai'},{value:'s-web',label:'Web 1',courseId:'c-web',courseTitle:'Web Course',folderGroupId:'f-web'},{value:'s-web2',label:'Web 2',courseId:'c-web',courseTitle:'Web Course',folderGroupId:'f-web'}];
  courses.push(...[2,3].map(i=>({value:`c-web${i}`,label:`Web Course ${i}`,folderGroupId:'f-web'})));
  scopes.push(...[3,4].map(i=>({value:`s-web${i}`,label:`Web ${i}`,courseId:'c-web',courseTitle:'Web Course',folderGroupId:'f-web'})),...courses.slice(2).map(c=>({value:`s-${c.value}`,label:'Section 1',courseId:c.value,courseTitle:c.label,folderGroupId:'f-web'})));
  globalThis.fetch=async(url,options)=>{requests.push({url,options});if(url.includes('mode=sections'))return {ok:true,json:async()=>({success:true,sections:[],folders,courses,courseSections:scopes})};if(url.startsWith('/api/presence'))return {ok:true,json:async()=>({success:true,counts:{section1:0,section2:0,total:2,byFolder:{'f-web':2},byCourse:{'c-web':2},bySection:{'s-web':2,'s-web2':1}}})};if(url==='/api/admin/reset')return {ok:true,json:async()=>({success:true,legacySections:[]})};if(url.startsWith('/api/admin/report'))return {ok:true,headers:{get:()=>null},blob:async()=>new window.Blob(['example'])};return {ok:false};};
  window.URL.createObjectURL=()=> 'blob:http://localhost/report';window.URL.revokeObjectURL=()=>{};
  const Portal=component('components/LessonPortal.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'next/dynamic':{__esModule:true,default:()=>()=>null},'next/image':{__esModule:true,default:()=>null},'next/link':{__esModule:true,default:props=>React.createElement('a',{href:props.href},props.children)},'@/lib/auth/types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'},'@/lib/supabase/browser':{getSupabaseBrowserClient:()=>null},'@/lib/slideStorage':{}});
  const courseFolders=courses.map(c=>({id:c.value,slug:c.value==='c-ai'?'applied-agentic-ai':'web',title:c.label,folderGroupId:c.folderGroupId,folderGroupName:folders.find(f=>f.value==c.folderGroupId).label,sections:scopes.filter(s=>s.courseId===c.value).map((s,i)=>({id:s.value,sectionKey:s.value,title:s.label,contentType:'tsx',position:i+1}))}));
  const container=window.document.createElement('div');window.document.body.append(container);const root=createRoot(container);
  const select=async(node,value)=>act(async()=>{node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));});
  try{
    await act(async()=>root.render(React.createElement(Portal,{isAdmin:true,courseFolders,initialProfile:null})));
    assert.equal(container.querySelector('[data-heading-online]')?.dataset.headingOnline,'2');
    const folder=[...container.querySelectorAll('[data-icon-surface="folder"]')].find(e=>e.textContent.includes('Web Training'));
    await act(async()=>folder.click());
    assert.match(container.querySelector('.courseLearners').textContent,/2 online/);
    await act(async()=>container.querySelector('#course-choice-c-web').click());
    assert.deepEqual([...container.querySelectorAll('.cardLiveUsers')].map(e=>e.textContent),['2 online','1 online','0 online','0 online']);
    const trigger=container.querySelector('[aria-controls="course-functions"]');
    assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(container.querySelector('#course-functions'),null);
    await act(async()=>trigger.click());assert.equal(container.querySelectorAll('#course-functions a,#course-functions button').length,5);
    await act(async()=>window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(window.document.activeElement,trigger);
    await act(async()=>trigger.click());await act(async()=>window.document.body.dispatchEvent(new window.PointerEvent('pointerdown',{bubbles:true})));
    assert.equal(container.querySelector('#course-functions'),null);
    await act(async()=>trigger.click());
    await act(async()=>[...container.querySelectorAll('button')].find(e=>e.textContent==='Report').click());
    assert.equal(container.querySelector('#course-functions'),null);
    let selects=container.querySelectorAll('[role="dialog"] select');assert.equal(selects.length,3);
    await select(selects[0],'f-web');selects=container.querySelectorAll('[role="dialog"] select');
    assert.deepEqual([...selects[1].options].map(o=>o.value),['all','c-web','c-web2','c-web3']);
    assert.equal(selects[1].options[0].textContent,'All courses (3)');assert.equal(selects[2].options[0].textContent,'All sections (6)');assert.equal(selects[2].querySelectorAll('optgroup').length,3);
    await select(selects[1],'c-web');selects=container.querySelectorAll('[role="dialog"] select');
    assert.equal(selects[2].options[0].textContent,'All sections (4)');assert.deepEqual([...selects[2].options].map(o=>o.value),['all','s-web','s-web2','s-web3','s-web4']);
    await select(selects[2],'s-web4');await select(selects[1],'c-web3');
    selects=container.querySelectorAll('[role="dialog"] select');assert.equal(selects[2].value,'all');assert.deepEqual([...selects[2].options].map(o=>o.value),['all','s-c-web3']);
    await select(selects[1],'c-web');
    await select(selects[2],'s-web2');await select(selects[0],'f-ai');
    selects=container.querySelectorAll('[role="dialog"] select');assert.equal(selects[1].value,'all');assert.equal(selects[2].value,'all');
    await select(selects[0],'f-web');await select(selects[1],'c-web');
    await act(async()=>[...container.querySelectorAll('[role="dialog"] button')].find(e=>e.textContent==='Download Excel file').click());
    const download=requests.find(r=>r.url.startsWith('/api/admin/report?date='));assert.ok(download);const url=new URL(download.url,'http://localhost');assert.equal(url.searchParams.get('folderId'),'f-web');assert.equal(url.searchParams.get('courseId'),'c-web');assert.equal(url.searchParams.get('sectionId'),'all');
    assert.equal(container.querySelector('[role="dialog"]'),null);
    await act(async()=>trigger.click());await act(async()=>[...container.querySelectorAll('#course-functions button')].find(e=>e.textContent==='Reset data').click());
    selects=container.querySelectorAll('[role="dialog"] select');assert.equal(selects.length,3);assert.deepEqual([...selects].map(s=>s.value),['f-web','c-web','all']);
    assert.deepEqual([...selects[1].options].map(o=>o.value),['all','c-web','c-web2','c-web3']);
    await select(selects[2],'s-web4');await select(selects[1],'c-web3');assert.equal(container.querySelectorAll('[role="dialog"] select')[2].value,'all');
    await select(selects[0],'f-ai');selects=container.querySelectorAll('[role="dialog"] select');assert.deepEqual([...selects].map(s=>s.value),['f-ai','all','all']);
    await select(selects[0],'f-web');await select(selects[1],'c-web');await select(selects[2],'s-web4');
    const password=container.querySelector('input[type="password"]');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(password,'test-confirmation');password.dispatchEvent(new window.Event('input',{bubbles:true}));});
    await act(async()=>container.querySelector('form[role="dialog"]').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
    const reset=requests.find(r=>r.url==='/api/admin/reset');assert.ok(reset);const body=JSON.parse(reset.options.body);assert.equal(body.folderId,'f-web');assert.equal(body.courseId,'c-web');assert.equal(body.sectionId,'s-web4');assert.equal(body.section,undefined);
    assert.equal(requests.filter(r=>r.options?.method==='POST'&&r.url.startsWith('/api/presence')).length,0,'admin visits never heartbeat as learners');
  }finally{await act(async()=>root.unmount());globalThis.fetch=previousFetch;await window.happyDOM.close();}
});

test("uploaded lessons send one entry then bounded heartbeats without blocking the deck",async()=>{
  const window=new Window({url:'http://localhost/learn'});for(const name of ['window','document','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');const previousFetch=globalThis.fetch;
  const intervals=new Map(),requests=[],beacons=[];let nextId=0;
  window.setInterval=(fn,delay)=>{const id=++nextId;intervals.set(id,{fn,delay});return id;};window.clearInterval=id=>intervals.delete(id);
  Object.defineProperty(window.navigator,'sendBeacon',{configurable:true,value:(url,body)=>{beacons.push(JSON.parse(body));return true;}});
  let releaseEntry;
  globalThis.fetch=(url,options)=>{requests.push({url,options});if(options?.method==='POST'&&JSON.parse(options.body).action==='enter')return new Promise(resolve=>releaseEntry=resolve);return Promise.resolve({ok:true,json:async()=>({success:true})});};
  const router={refresh(){}};
  const Portal=component('components/LessonPortal.tsx',{'next/navigation':{useRouter:()=>router},'next/dynamic':{__esModule:true,default:()=>()=>null},'next/image':{__esModule:true,default:()=>null},'next/link':{__esModule:true,default:()=>null},'@/lib/auth/types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'},'@/lib/supabase/browser':{getSupabaseBrowserClient:()=>null},'@/lib/slideStorage':{}});
  const props={isAdmin:false,initialCourseId:'web',initialSectionId:'web-section',initialProfile:{name:'Alice',email:'alice@example.test',section:'section1'},courseFolders:[{id:'web',slug:'web',title:'Web Course',sections:[{id:'web-section',sectionKey:'arbitrary-key',title:'Web Section',position:1,contentType:'tsx'}]}]};
  const container=window.document.createElement('div');window.document.body.append(container);const root=createRoot(container);
  const beat=()=>[...intervals.values()].filter(i=>i.delay===20_000).forEach(i=>i.fn());
  try{
    await act(async()=>root.render(React.createElement(Portal,props)));
    assert.ok(container.querySelector('[aria-label="Session controls"]'),'deck is usable while presence request is still pending');
    assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0].options.body).sectionId,'web-section');assert.equal(JSON.parse(requests[0].options.body).action,'enter');
    await act(async()=>{beat();beat();beat();root.render(React.createElement(Portal,{...props}));});assert.equal(requests.length,1,'no overlapping presence requests or catalog rerender reconnect');
    Object.defineProperty(window.document,'visibilityState',{configurable:true,value:'hidden'});await act(async()=>window.document.dispatchEvent(new window.Event('visibilitychange')));
    Object.defineProperty(window.document,'visibilityState',{configurable:true,value:'visible'});await act(async()=>window.document.dispatchEvent(new window.Event('visibilitychange')));
    assert.equal(requests.length,1,'quick resume queues a refresh instead of overlapping the pending entry');
    await act(async()=>releaseEntry({ok:true}));
    assert.equal(JSON.parse(requests[1].options.body).action,'heartbeat');
    Object.defineProperty(window.document,'visibilityState',{configurable:true,value:'hidden'});await act(async()=>{window.document.dispatchEvent(new window.Event('visibilitychange'));beat();});assert.equal(requests.length,2);assert.equal(beacons.length,2,'hidden learner tab leaves immediately');
    Object.defineProperty(window.document,'visibilityState',{configurable:true,value:'visible'});await act(async()=>window.document.dispatchEvent(new window.Event('visibilitychange')));assert.equal(requests.length,3);
    window.dispatchEvent(new window.Event('pagehide'));await act(async()=>root.unmount());assert.equal(beacons.length,3);assert.equal(beacons[0].sectionId,'web-section');assert.equal(beacons[0].action,'leave');assert.equal(intervals.size,0);
  }finally{await act(async()=>root.unmount());globalThis.fetch=previousFetch;await window.happyDOM.close();}
});


test('course pages contain twelve courses and retain the remaining courses on the next page',async()=>{
  const window=new Window({url:'http://localhost/learn'});
  for(const name of ['window','document','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>({ok:false});
  const Portal=component('components/LessonPortal.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'next/dynamic':{__esModule:true,default:()=>()=>null},'next/image':{__esModule:true,default:()=>null},'next/link':{__esModule:true,default:props=>React.createElement('a',{href:props.href},props.children)},'@/lib/auth/types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'},'@/lib/supabase/browser':{getSupabaseBrowserClient:()=>null},'@/lib/slideStorage':{}});
  const courseFolders=Array.from({length:14},(_,i)=>({id:'course-'+i,slug:'course-'+i,title:'Course '+i,folderGroupId:'folder',folderGroupName:'Training',sections:[]}));
  const container=window.document.createElement('div');window.document.body.append(container);const root=createRoot(container);
  try{
    await act(async()=>root.render(React.createElement(Portal,{isAdmin:true,courseFolders,initialProfile:null})));
    assert.equal(container.querySelectorAll('[data-icon-surface="course"]').length,12);assert.match(container.textContent,/Showing 1\u201312 of 14 courses/);
    await act(async()=>[...container.querySelectorAll('button')].find(e=>e.textContent.startsWith('Next')).click());
    assert.equal(container.querySelectorAll('[data-icon-surface="course"]').length,2);assert.match(container.textContent,/Showing 13\u201314 of 14 courses/);
    await act(async()=>[...container.querySelectorAll('button')].find(e=>e.textContent.includes('Prev')).click());
    assert.equal(container.querySelectorAll('[data-icon-surface="course"]').length,12);
  }finally{await act(async()=>root.unmount());globalThis.fetch=previousFetch;await window.happyDOM.close();}
});

test('3D icons start pending and only expose a static fallback on renderer failure',async()=>{
  const window=new Window();Object.defineProperty(globalThis,'window',{configurable:true,value:window});
  const timers=new Map();let nextId=0;window.setTimeout=(fn)=>{const id=++nextId;timers.set(id,fn);return id;};window.clearTimeout=id=>timers.delete(id);
  const registry=moduleExports('components/learningIconRegistry.ts');const element=window.document.createElement('span');
  const release=registry.registerLearningIcon({element,kind:'folder',active:false});
  assert.equal(element.dataset.renderState,'pending');assert.equal(timers.size,1);
  registry.setLearningIconRendererState('ready');assert.equal(element.dataset.renderState,'ready');assert.equal(timers.size,0);
  registry.setLearningIconRendererState('fallback');assert.equal(element.dataset.renderState,'fallback');
  release();assert.equal(registry.learningIcons.size,0);
  registry.setLearningIconRendererState('pending');const second=window.document.createElement('span');const remove=registry.registerLearningIcon({element:second,kind:'course',active:false});
  [...timers.values()][0]();assert.equal(second.dataset.renderState,'fallback');remove();await window.happyDOM.close();
});


test('stationary online display stays beside the eyebrow and updates without replacing the robot',async()=>{
  const window=new Window({url:'http://localhost/learn'});for(const name of ['window','document','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');
  let modelRenders=0;
  const Heading=component('components/CourseDiscoveryHeading.tsx',{'next/dynamic':{__esModule:true,default:()=>props=>{modelRenders++;return React.createElement('span',{'data-model-count':props.onlineCount,'data-model-emotion':props.emotion});}}});
  const container=window.document.createElement('div');window.document.body.append(container);const root=createRoot(container);
  try{
    await act(async()=>root.render(React.createElement(Heading,{onlineCount:2})));
    const robot=container.querySelector('[aria-label="Activate AI companion animation"]');assert.ok(robot);assert.equal(container.querySelector('[data-model-count]'),null);assert.equal(container.querySelector('[role="status"]').parentElement.className,'eyebrowLine');assert.equal(container.querySelector('[role="status"]').textContent,'2 online');
    const trigger=container.querySelector('[aria-label="Choose robot emotion"]');
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
    assert.ok(trigger.closest('.faceControls'),'the antenna control must stay attached to the avatar');
    assert.equal(trigger.querySelector('svg'),null,'the external gear is removed');
    assert.equal(container.querySelector('[aria-label="Robot emotion"]'),null);
    for(const [index,value] of ['normal','angry','surprised'].entries()){
      await act(async()=>trigger.click());
      const emotions=[...container.querySelectorAll('[aria-label="Robot emotion"] button')];
      assert.equal(emotions.length,3);assert.equal(emotions.filter(button=>button.getAttribute('aria-pressed')==='true').length,1);
      await act(async()=>emotions[index].click());
      assert.equal(container.querySelector('[data-emotion]').dataset.emotion,value);
      assert.equal(container.querySelector('[data-model-emotion]').dataset.modelEmotion,value,'the selected face must reach the WebGL model');
      assert.equal(trigger.getAttribute('aria-expanded'),'false');
      assert.equal(window.document.activeElement,trigger);
    }
    await act(async()=>trigger.click());
    await act(async()=>window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
    await act(async()=>trigger.click());
    await act(async()=>window.document.body.dispatchEvent(new window.PointerEvent('pointerdown',{bubbles:true})));
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
    assert.equal(container.querySelector('[title]'),null,'emotion controls must not introduce tooltips');
    const beforeCountChange=modelRenders;
    await act(async()=>root.render(React.createElement(Heading,{onlineCount:5})));
    assert.equal(modelRenders,beforeCountChange,'online count changes must not re-render the 3D model');
    assert.equal(container.querySelector('[data-model-emotion]').dataset.modelEmotion,'surprised','presence updates must preserve the selected face');
    assert.equal(container.querySelector('[aria-label="Activate AI companion animation"]'),robot);assert.equal(container.querySelector('[data-model-count]'),null);assert.equal(container.querySelector('[role="status"]').textContent,'5 online');
    await act(async()=>root.render(React.createElement(Heading,{})));assert.equal(container.querySelector('[role="status"]'),null);
  }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});


test('presence broadcasts refresh within one second under a continuous event burst and reconnect refreshes again',async()=>{
  const window=new Window({url:'http://localhost/learn'});for(const name of ['window','document','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');const savedFetch=globalThis.fetch,savedNow=Date.now;
  let clock=10000,nextId=0,broadcast,status;Date.now=()=>clock;const timers=new Map(),intervals=new Map(),requests=[];
  window.setTimeout=(fn,delay)=>{const id=++nextId;timers.set(id,{fn,at:clock+delay});return id;};window.clearTimeout=id=>timers.delete(id);
  window.setInterval=(fn,delay)=>{intervals.set(delay,fn);return delay;};window.clearInterval=id=>intervals.delete(id);
  const channel={on(type,filter,fn){broadcast=fn;return this;},subscribe(fn){status=fn;return this;}};
  globalThis.fetch=async url=>{if(url.startsWith('/api/presence')){requests.push(clock);return {ok:true,json:async()=>({success:true,counts:{section1:0,section2:0,total:requests.length}})};}return {ok:false};};
  const Portal=component('components/LessonPortal.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'next/dynamic':{__esModule:true,default:()=>()=>null},'next/image':{__esModule:true,default:()=>null},'next/link':{__esModule:true,default:props=>React.createElement('a',{href:props.href},props.children)},'@/lib/auth/types':{APPLIED_AGENTIC_AI_SLUG:'applied-agentic-ai'},'@/lib/supabase/browser':{getSupabaseBrowserClient:()=>({channel:()=>channel,removeChannel(){}})},'@/lib/slideStorage':{}});
  const mount=window.document.createElement('div'),root=createRoot(mount);
  async function advance(ms){const end=clock+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;clock=next[1].at;timers.delete(next[0]);await act(async()=>next[1].fn());}clock=end;}
  try{
    await act(async()=>root.render(React.createElement(Portal,{isAdmin:true,courseFolders:[],initialProfile:null})));
    assert.deepEqual(requests,[10000]);assert.ok(intervals.has(5000));
    for(let i=0;i<16;i++){await act(async()=>broadcast());await advance(50);}
    assert.equal(requests.length,2);assert.ok(requests[1]-requests[0]<=1000,'continuous signals cannot postpone the snapshot indefinitely');
    await advance(1000);await act(async()=>status('SUBSCRIBED'));assert.equal(requests.length,3);
    Object.defineProperty(window.document,'visibilityState',{configurable:true,value:'hidden'});await advance(1000);await act(async()=>intervals.get(5000)());assert.equal(requests.length,3);
  }finally{await act(async()=>root.unmount());Date.now=savedNow;globalThis.fetch=savedFetch;await window.happyDOM.close();}
});
