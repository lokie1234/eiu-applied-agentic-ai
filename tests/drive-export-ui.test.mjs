import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { Window } from "happy-dom";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
const require = createRequire(import.meta.url);
test("folder export reviews names and retries only failed files", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent"]) globalThis[name] = name === "window" ? window : window[name];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = []; let failed = false;
  const fetch = async (url, options) => {
    const input = options?.body ? JSON.parse(options.body) : null; calls.push(input);
    if (!input) return { ok: true, json: async () => ({ destinations: [{ id: "destination", label: "Course archive" }] }) };
    if (input.action === "plan") return { ok: true, json: async () => ({ tasks: [{ sectionId: "one", name: "Section 1.pdf" }, { sectionId: "two", name: "Section 2.pptx" }] }) };
    if (input.sectionId === "two" && !failed) { failed = true; return { ok: false, json: async () => ({ message: "Temporary failure" }) }; }
    return { ok: true, json: async () => ({ success: true }) };
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("components/admin/DriveExport.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, fetch, require: name => name.endsWith(".css") ? new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }) : name === "next/link" ? { default: props => React.createElement("a", props), __esModule: true } : require(name) });
  const container = window.document.createElement("div"); window.document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(React.createElement(exports.default, { groupId: "group", label: "Save folder to Drive" })));
  await act(async () => container.querySelector("button").click());
  assert.match(container.textContent, /Course archive/);
  async function click(text) { const button = [...container.querySelectorAll("button")].find(item => item.textContent === text); assert.ok(button); await act(async () => button.click()); }
  await click("Review documents");
  assert.deepEqual([...container.querySelectorAll("input")].map(item => item.value), ["Section 1.pdf", "Section 2.pptx"]);
  await click("Save to Drive");
  assert.match(container.textContent, /Temporary failure/);
  await click("Retry remaining files");
  assert.equal(calls.filter(input => input?.action === "save" && input.sectionId === "one").length, 1);
  assert.equal(calls.filter(input => input?.action === "save" && input.sectionId === "two").length, 2);
  assert.ok(calls.filter(input => input?.action === "save").every(input => input.destinationId === "destination" && input.groupId === "group"));
  assert.match(container.textContent, /2 document\(s\) saved/);
  await act(async () => root.unmount()); window.happyDOM.abort();
});
