import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);

test("Drive actions only export copies, guard repeated clicks and report partial failure", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "navigator", "localStorage", "sessionStorage"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const courses = [{ id: "c1", slug: "applied-agentic-ai", title: "Agentic AI", status: "active", folderGroupId: "f1", metadata: {} }];
  const sections = [
    { id: "s1", course_id: "c1", section_key: "section1", title: "Web App", position: 1, status: "active", content_type: "builtin" },
    { id: "s2", course_id: "c1", section_key: "section2", title: "Framework", position: 2, status: "active", content_type: "builtin" },
    { id: "s3", course_id: "c1", section_key: "section3", title: "Document", position: 3, status: "active", content_type: "pdf", content_path: "c1/s3/file.pdf", source_filename: "file.pdf" },
  ];
  const catalog = () => ({ success: true, courses, sections, folderGroups: [{ id: "f1", name: "Folder", order: 0 }] });
  const calls = [];
  const pending = [];
  const fetch = async (url, options) => {
    if (options?.method === "POST") {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (body.action === "plan") return { ok: true, json: async () => ({ tasks: sections.filter(section => !body.sectionId || section.id === body.sectionId).map(section => ({ sectionId: section.id, name: section.title, builtin: section.section_key !== "section3" })) }) };
      return new Promise(resolve => pending.push(resolve));
    }
    return { ok: true, json: async () => url.includes("destinations") ? { destinations: [{ id: "d1", label: "Export folder" }] } : url.includes("/api/templates") ? { templates: [] } : catalog() };
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, {
      exports, fetch, window, document: window.document, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
      setTimeout, clearTimeout, console, URL,
      require: name => {
        if (name === "next/image") return { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) };
        if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
        if (name.startsWith(".") || name.startsWith("@/")) {
          let next = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
          if (!fs.existsSync(next)) next = [".ts", ".tsx", ".js"].map(extension => next + extension).find(fs.existsSync);
          return load(next);
        }
        return require(name);
      },
    });
    return exports;
  }
  const Component = load(path.resolve("components/admin/AdminAccessPortal.tsx")).default;
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(Component, { adminEmail: "admin@example.test" })));
    assert.doesNotMatch(container.textContent, /Load from Drive|Move existing|Upload files to Drive/);
    assert.equal(container.querySelectorAll('button[aria-label^="Save "][aria-label$="to Drive"]').length, 5);
    assert.equal(container.querySelector('[aria-label="Drive save destination"]'), null);
    const batch = container.querySelector('button[aria-label="Save course files to Drive"]');
    await act(async () => { batch.click(); batch.click(); });
    assert.equal(calls.length, 1, "opening only loads the plan");
    const dialog = batch.nextElementSibling;
    assert.equal(dialog.open, true);
    const select = dialog.querySelector("select");
    const save = [...dialog.querySelectorAll("button")].find(button => button.textContent === "Save to Drive");
    assert.equal(save.disabled, true, "target must be chosen explicitly");
    await act(async () => { select.value = "d1"; select.dispatchEvent(new window.Event("change", { bubbles: true })); });
    await act(async () => { save.click(); save.click(); });
    assert.equal(calls.length, 2);
    assert.equal(save.disabled, true);
    assert.match(dialog.querySelector('[role="status"]').textContent, /System is working/);
    assert.match(dialog.querySelector('[role="status"]').textContent, /Saving 1 of 3/);
    await act(async () => pending.shift()({ ok: true, json: async () => ({ success: true }) }));
    await act(async () => pending.shift()({ ok: false, json: async () => ({ success: false, message: "Drive unavailable" }) }));
    await act(async () => pending.shift()({ ok: true, json: async () => ({ success: true }) }));
    assert.deepEqual(calls.slice(1).map(call => call.body.action), ["save_builtin", "save_builtin", "save"]);
    assert.ok(calls.slice(1).every(call => call.url === "/api/admin/drive/export" && call.body.destinationId === "d1" && call.body.courseId === "c1"));
    assert.match(dialog.textContent, /2 document\(s\) saved/);
    assert.match(dialog.textContent, /Drive unavailable/);
    assert.equal(sections[2].content_path, "c1/s3/file.pdf");
    await act(async () => [...dialog.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === "Close").click());
    const folder = container.querySelector('button[aria-label="Save folder Folder to Drive"]');
    await act(async () => folder.click());
    assert.equal(folder.nextElementSibling.open, true);
    assert.equal(calls.at(-1).body.groupId, "f1");
    const single = container.querySelector('button[aria-label="Save Document to Drive"]');
    await act(async () => single.click());
    assert.equal(calls.at(-1).body.sectionId, "s3");
    assert.equal(single.nextElementSibling.querySelector("select").value, "");
  } finally {
    await act(async () => root.unmount());
    await window.happyDOM.close();
  }
});
