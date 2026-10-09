import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function component(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, console, Date, window: globalThis.window, document: globalThis.document, fetch: (...args) => globalThis.fetch(...args), require: name => {
    if (name === "./EiuConfirmDialog") return { __esModule: true, default: component("components/admin/EiuConfirmDialog.tsx") };
    if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
    return dependencies[name] ?? require(name);
  } });
  return exports.default;
}

test("landing offers passcode and admin Google sign-in without username login", () => {
  const SignIn = component("components/landing/SignInCard.tsx");
  const html = renderToStaticMarkup(React.createElement(SignIn, { passcode: "", setPasscode() {}, onSubmit() {}, loading: false }));
  assert.match(html, /Passcode/); assert.match(html, /Learner or facilitator access/);
  assert.match(html, /Administrator account only/); assert.doesNotMatch(html, /Username|registered account/);
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
