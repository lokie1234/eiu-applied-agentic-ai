import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { Window } from "happy-dom";
import ts from "typescript";
import React, { act } from "react";

const require = createRequire(import.meta.url);

test("admin can clear a summary and reopen or cancel the editor without restoring fallback text", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const course = {
    id: "course", slug: "example", title: "Example course", status: "active", language_label: "en",
    description: "Legacy description", folderGroupId: "folder",
    metadata: { summary: "Original summary", allowedEmails: [], passcode: "1234" },
  };
  const calls = [];
  const fetch = async (url, options) => {
    if (url === "/api/templates") return { ok: true, json: async () => ({ templates: [{ id: "eiu-business-v1", name: "EIU Business" }] }) };
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body) calls.push(body);
    if (body?.action === "set_course_template") course.metadata.templateKey = body.templateKey;
    if (body?.action === "update_course_description") course.metadata.summary = body.summary;
    return { ok: true, json: async () => ({ success: true, courses: [{ ...course, metadata: { ...course.metadata } }], sections: [], authorizedEmails: [], folderGroups: [{ id: "folder", name: "Materials", order: 1 }] }) };
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("components/admin/AdminAccessPortal.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, fetch, window, document: window.document, console,
    require: name => {
      if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
      if (name === "@/lib/uploadQueue") return { createUploadQueue: () => task => task() };
      if (name === "@/lib/uploadSectionFile") return {};
      if (name.startsWith("./")) return { __esModule: true, default: () => null };
      return require(name);
    },
  });
  const container = window.document.createElement("div");
  window.document.body.append(container);
  let root = createRoot(container);
  const edit = async () => act(async () => container.querySelector('[title="Edit course summary"]').click());
  const input = () => container.querySelector(".descInput");
  try {
    await act(async () => root.render(React.createElement(exports.default, { adminEmail: "admin@example.test" })));
    await act(async () => [...container.querySelectorAll('[role="tab"]')].find(tab => tab.textContent.includes("Course")).click());
    assert.equal(container.querySelector(".workspaceDescText").textContent, "Original summary");
    await edit();
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input(), "");
      input().dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector(".descSaveBtn").click());
    assert.equal(calls.at(-1).action, "update_course_description");
    assert.equal(calls.at(-1).summary, "");
    assert.equal(container.querySelector(".workspaceDescText").textContent, "");
    await edit();
    assert.equal(input().value, "");
    await act(async () => container.querySelector(".descCancelBtn").click());
    assert.equal(container.querySelector(".workspaceDescText").textContent, "");
    await act(async () => root.unmount());
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(exports.default, { adminEmail: "admin@example.test" }));
    });
    await act(async () => [...container.querySelectorAll('[role="tab"]')].find(tab => tab.textContent.includes("Course")).click());
    assert.equal(container.querySelector(".workspaceDescText").textContent, "");
    const option = container.querySelector('[aria-label="Slide template"]');
    assert.equal(option.value, "");
    assert.equal(container.querySelector('a[href="/templates/eiu-business-v1/template.pdf"]'), null);
    await act(async () => { option.value = "eiu-business-v1"; option.dispatchEvent(new window.Event("change", { bubbles: true })); });
    assert.equal(calls.at(-1).action, "set_course_template");
    assert.equal(calls.at(-1).templateKey, "eiu-business-v1");
    const sectionTitle = container.querySelector(".addSectionInput");
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(sectionTitle, "Template section");
      sectionTitle.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await act(async () => sectionTitle.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(calls.at(-1).action, "create_section");
    assert.equal(calls.at(-1).useEiuTemplate, undefined);
  } finally {
    await act(async () => root.unmount());
    window.happyDOM.abort();
  }
});
