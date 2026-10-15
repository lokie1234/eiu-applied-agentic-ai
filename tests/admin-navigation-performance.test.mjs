import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, console, AbortController, AbortSignal, ...globals,
    require: name => dependencies[name] ?? (name.endsWith(".css") ? { default: new Proxy({}, { get: (_, key) => String(key) }), __esModule: true }
      : name.startsWith("./") ? { __esModule: true, default: () => null } : require(name)),
  });
  return exports;
}

test("admin guards recheck the verified session without reading the course catalog", async () => {
  let session = { role: "admin" }, checks = 0, catalogs = 0;
  const signal = new AbortController().signal;
  const api = load("lib/auth/currentUser.ts", {
    "server-only": {}, "./session": { currentAccessSession: async received => { assert.equal(received, signal); checks++; return session; } },
    "./courseAccessStorage": { getCoursesAndSectionsData: async () => { catalogs++; throw Error("Not needed for admin guards"); } },
    "./passcodes": {}, "./types": { FIXED_ADMIN_EMAIL: "admin@example.test" }, "@/lib/supabase/server": {},
  });
  assert.equal((await api.requireAdminAccess(signal)).email, "admin@example.test");
  assert.equal((await api.requireCourseManager(signal)).isAdmin, true);
  session = null;
  assert.equal(await api.requireAdminAccess(signal), null, "revocation must not reuse a prior authorization");
  session = { role: "passcode" };
  assert.equal(await api.requireAdminAccess(signal), null);
  assert.equal(checks, 4); assert.equal(catalogs, 0);
});

test("admin catalog reads propagate cancellation and omit large layout images without modifying storage", async () => {
  const image = "data:image/png;base64," + "A".repeat(1_000_000);
  const data = { courses: [{ id: "c", metadata: { summary: "Course", slideTemplates: [{ id: "t", name: "Layout", background: image }] } }], sections: [], folderGroups: [] };
  const signals = [];
  const api = load("app/api/admin/access/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body: JSON.parse(JSON.stringify(body)), options }) } },
    "next/cache": {}, "@/lib/auth/currentUser": { requireCourseManager: async signal => { signals.push(signal); return { email: "admin@example.test" }; } },
    "@/lib/auth/types": {}, "@/lib/supabase/server": {}, "@/lib/auth/passcodes": {}, "@/lib/learningIdentity": {},
    "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async signal => { signals.push(signal); return data; } },
  });
  const request = new Request("https://example.test/api/admin/access");
  const response = await api.GET(request);
  assert.deepEqual(signals, [request.signal, request.signal]);
  assert.equal(response.body.courses[0].metadata.summary, "Course");
  assert.equal(response.body.courses[0].metadata.slideTemplates, undefined);
  assert.equal(data.courses[0].metadata.slideTemplates[0].background, image);
  assert.ok(JSON.stringify(response.body).length < 200);
  assert.equal(response.options.headers["Cache-Control"], "no-store");
});

test("Access Settings coalesces focus reads, cancels requests on departure and ignores late responses", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const requests = [];
  const Portal = load("components/admin/AdminAccessPortal.tsx", {
    "@/lib/learningIdentity": { DEFAULT_IDENTITY_POLICY: { enabled: false, fields: [] } },
  }, { window, document: window.document, fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })) }).default;
  const container = window.document.createElement("div"), root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(Portal, { adminEmail: "admin@example.test" })));
    assert.equal(requests.length, 2);
    await act(async () => { for (let i = 0; i < 8; i++) window.dispatchEvent(new window.Event("focus")); });
    assert.equal(requests.length, 2, "focus bursts must share the pending layouts read");
    await act(async () => root.unmount());
    assert.ok(requests.every(request => request.options.signal.aborted));
    await act(async () => requests.forEach(request => request.resolve({ ok: true, json: async () => ({ success: true, courses: [], sections: [], folderGroups: [], templates: [] }) })));
    assert.equal(container.innerHTML, "");
    window.dispatchEvent(new window.Event("focus"));
    assert.equal(requests.length, 2);
  } finally { await window.happyDOM.close(); }
});

test("Access Settings rejects duplicate saves, orders metadata writes and ignores stale catalog reads", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const catalog = metadata => ({ success: true, courses: [{ id: "c1", slug: "course", title: "Course", status: "active", folderGroupId: "f1", metadata }], sections: [], folderGroups: [{ id: "f1", name: "Folder", order: 0 }] });
  const posts = [], reads = [];
  let initialized = false;
  const Portal = load("components/admin/AdminAccessPortal.tsx", {
    "@/lib/learningIdentity": { DEFAULT_IDENTITY_POLICY: { enabled: false, fields: [] } },
    "./CourseSystemIcons": { __esModule: true, default: ({ onSave }) => React.createElement("button", { id: "save-icons-test", onClick: () => void onSave([]) }, "Save icons") },
    "./DriveExport": { __esModule: true, default: ({ onSaved }) => React.createElement("button", { className: "refresh-test", onClick: onSaved }, "Refresh") },
  }, { window, document: window.document, fetch: (url, options) => {
    if (options?.method === "POST") return new Promise(resolve => posts.push({ body: JSON.parse(options.body), resolve }));
    if (url === "/api/templates") return Promise.resolve({ ok: true, json: async () => ({ templates: [{ id: "t1", name: "Layout" }] }) });
    if (!initialized) { initialized = true; return Promise.resolve({ ok: true, json: async () => catalog({}) }); }
    return new Promise(resolve => reads.push({ options, resolve }));
  } }).default;
  const container = window.document.createElement("div"), root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(Portal, { adminEmail: "admin@example.test" })));
    await act(async () => container.querySelector(".refresh-test").click());
    assert.equal(reads.length, 1);
    const select = container.querySelector('#course-slide-template');
    assert.ok(select);
    await act(async () => {
      select.value = "t1";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
      container.querySelector("#save-icons-test").click();
    });
    assert.equal(posts.length, 1, "duplicate template writes are suppressed and the icon write waits");
    assert.equal(reads[0].options.signal.aborted, true);
    await act(async () => posts[0].resolve({ ok: true, json: async () => catalog({ templateKey: "t1" }) }));
    assert.equal(posts.length, 2);
    assert.equal(posts[1].body.action, "update_course_system_icons");
    await act(async () => posts[1].resolve({ ok: true, json: async () => catalog({ templateKey: "t1", systemIcons: [] }) }));
    await act(async () => reads[0].resolve({ ok: true, json: async () => catalog({}) }));
    assert.equal(container.querySelector('#course-slide-template').value, "t1", "late pre-save reads cannot overwrite saved metadata");
  } finally {
    await act(async () => root.unmount());
    await window.happyDOM.close();
  }
});
