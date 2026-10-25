import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";
const require = createRequire(import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, Buffer, Uint8Array, TextDecoder, TextEncoder, AbortController, AbortSignal, console, URL,
    require: name => dependencies[name] ?? (name.endsWith(".css") ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } : (name === "./sectionLimits" ? load("lib/sectionLimits.ts", {}) : require(name))), ...globals,
  });
  return exports;
}
const content = load("lib/sectionContent.ts");
const sample = fs.readFileSync("public/downloads/interactive-lesson-example.js", "utf8");

test("JS lessons need no TSX, remain byte-exact and reject TSX, invalid JS and external imports", async () => {
  const ready = await content.prepareSectionFile(Buffer.from(sample), "lesson.js");
  assert.equal(ready.contentType, "tsx", "existing database runtime category stays compatible");
  assert.equal(ready.name, "lesson.js"); assert.equal(ready.mimeType, "text/javascript");
  assert.equal(Buffer.from(ready.bytes).toString(), sample);
  for (const [source, name] of [["export default [<div />]", "lesson.tsx"], ["exports.default = [<div />]", "lesson.js"], ["import React from 'react'; exports.default=[]", "lesson.js"], ["exports.default = [", "lesson.js"]])
    await assert.rejects(content.prepareSectionFile(Buffer.from(source), name));
});

test("plain JS sample runs in the lesson runtime and retains button interactions", async () => {
  const { createTsxDocument } = load("lib/tsxDocument.ts");
  const window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  try {
    const html = createTsxDocument(sample, 1);
    window.document.write(html);
    await window.happyDOM.whenAsyncComplete();
    assert.match(window.document.body.textContent, /Ideas launched: 0/);
    window.document.querySelector("button").click();
    assert.match(window.document.querySelector('[aria-live="polite"]').textContent, /Ideas launched: 1/);
  } finally { await window.happyDOM.close(); }
});

test("JS validation permits teaching text and comments while rejecting executable restricted APIs", async () => {
  const source = `// fetch('/example'); document.cookie; window.parent
exports.default = [h('p', null, 'localStorage và sessionStorage',
  'import React from "react"; require("example"); fetch("/example")',
  \`XMLHttpRequest, WebSocket, document.cookie, window.top\`)];`;
  const ready = await content.prepareSectionFile(Buffer.from(source), "storage-lesson.js");
  assert.equal(Buffer.from(ready.bytes).toString(), source);
  for (const expression of [
    'localStorage.getItem("key")', 'sessionStorage.clear()', 'document.cookie',
    'window.parent', 'window["top"]', 'document["cookie"]', 'window["localStorage"]',
    'fetch("/example")', 'window["fetch"]("/example")', 'require("example")',
    'import("example")', 'new XMLHttpRequest()', 'new WebSocket("wss://example.test")',
    '`storage: ${localStorage.getItem("key")}`',
  ]) await assert.rejects(content.prepareSectionFile(Buffer.from(`exports.default=[]; ${expression};`), "lesson.js"), /self-contained/);
});

function fixture() {
  const state = { admin: true, project: false, reads: 0, writes: [], conflict: false, name: "lesson.js", bytes: Buffer.from(sample), section: { id: "s1", course_id: "c1", section_key: "custom", content_type: "tsx", content_path: "drive:previous-file-123" } };
  const db = { from: table => {
    let update;
    return { select() { return this; }, eq() { return this; }, is() { return this; }, update(value) { update = value; return this; }, async maybeSingle() {
      if (update) { state.writes.push(update); return { data: state.conflict ? null : { id: "s1" } }; }
      return { data: table === "courses" ? { slug: "custom" } : state.section };
    } };
  } };
  const api = load("app/api/admin/sections/[id]/drive/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "next/cache": { revalidatePath() {} }, "@/lib/auth/currentUser": { canManageSection: async () => state.admin },
    "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "@/lib/sectionContent": content,
    "@/lib/localSectionContent": { localSectionSourcePath: () => state.project ? "registered.tsx" : null },
    "@/lib/drive/sectionContent": { readDriveFile: async () => { state.reads++; return { id: "selected-drive-123", name: state.name, bytes: state.bytes }; } },
  });
  const submit = (body, origin = "https://example.test") => api.POST(new Request("https://example.test/api/admin/sections/s1/drive", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ fileId: "selected-drive-123", ...body }) }), { params: Promise.resolve({ id: "s1" }) });
  return { state, submit };
}
test("Drive import previews without writes, then connects exact JS only after confirmation", async () => {
  const f = fixture();
  const preview = await f.submit({ action: "preview" });
  assert.equal(preview.status, 200); assert.equal(preview.body.file.name, "lesson.js"); assert.equal(f.state.writes.length, 0);
  assert.equal((await f.submit({ action: "connect", revision: preview.body.file.revision })).status, 200);
  assert.equal(f.state.writes[0].source_filename, "lesson.js");
  assert.equal(f.state.writes[0].content_path, "drive:selected-drive-123");
  assert.equal(f.state.writes[0].original_content_path, null);
});
test("Drive import rejects revoked access, cross-origin, TSX and changed files", async () => {
  const f = fixture(); f.state.admin = false;
  assert.equal((await f.submit({ action: "preview" })).status, 403); assert.equal(f.state.reads, 0);
  f.state.admin = true;
  assert.equal((await f.submit({ action: "preview" }, "https://other.test")).status, 403);
  f.state.project = false; f.state.name = "lesson.tsx";
  assert.equal((await f.submit({ action: "preview" })).status, 400);
  f.state.name = "lesson.js";
  const preview = await f.submit({ action: "preview" });
  f.state.bytes = Buffer.from(sample + "\n// changed");
  assert.equal((await f.submit({ action: "connect", revision: preview.body.file.revision })).status, 409);
  assert.equal(f.state.writes.length, 0);
});
test("Drive import reports concurrent section updates instead of claiming success", async () => {
  const f = fixture(), preview = await f.submit({ action: "preview" }); f.state.conflict = true;
  assert.equal((await f.submit({ action: "connect", revision: preview.body.file.revision })).status, 409);
});

test("Drive import UI previews, confirms, prevents duplicate clicks and cancels reads on departure", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = [];
  const Import = load("components/admin/DriveImport.tsx", {
    "@/lib/googlePicker": {}, "./DriveActionIcon": { __esModule: true, default: () => null },
  }, { window, fetch: (url, options) => new Promise(resolve => calls.push({ url, options, resolve, body: JSON.parse(options.body) })) }).default;
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div");
  const mounted = createRoot(container); let saves = 0;
  const button = text => [...container.querySelectorAll("button")].find(item => item.textContent === text);
  try {
    await act(async () => mounted.render(React.createElement(Import, { sectionId: "s1", title: "Lesson", onSaved: () => saves++ })));
    await act(async () => container.querySelector('button[title="Upload from Drive"]').click());
    const input = container.querySelector("input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => { setter.call(input, "selected-drive-123"); input.dispatchEvent(new window.Event("input", { bubbles: true })); input.dispatchEvent(new window.Event("change", { bubbles: true })); });
    await act(async () => { button("Check file").click(); button("Check file").click(); });
    assert.equal(calls.length, 1); assert.equal(calls[0].body.action, "preview");
    await act(async () => calls[0].resolve({ ok: true, json: async () => ({ file: { id: "selected-drive-123", name: "lesson.js", bytes: 10, type: "tsx", revision: "hash" } }) }));
    await act(async () => { button("Connect to section").click(); button("Connect to section").click(); });
    assert.equal(calls.length, 2); assert.equal(calls[1].body.revision, "hash");
    await act(async () => calls[1].resolve({ ok: true, json: async () => ({ success: true }) }));
    assert.equal(saves, 1); assert.match(container.textContent, /is connected/);
    await act(async () => container.querySelector('button[title="Upload from Drive"]').click());
    await act(async () => { setter.call(input, "another-drive-123"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    await act(async () => button("Check file").click());
    await act(async () => mounted.unmount());
    assert.equal(calls.at(-1).options.signal.aborted, true);
    await act(async () => calls.at(-1).resolve({ ok: true, json: async () => ({ file: {} }) }));
  } finally { await window.happyDOM.close(); }
});

test("registered project lessons can preview and connect an explicit Drive replacement", async () => {
  const f = fixture(); f.state.project = true;
  const preview = await f.submit({ action: "preview" });
  assert.equal(preview.status, 200); assert.equal(f.state.writes.length, 0);
  assert.equal((await f.submit({ action: "connect", revision: preview.body.file.revision })).status, 200);
  assert.equal(f.state.writes[0].content_path, "drive:override:selected-drive-123");
});
