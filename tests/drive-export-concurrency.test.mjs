import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);

test("batch export overlaps sections, orders each section and retries only failed files", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const pending = [], sent = [];
  const tasks = [
    { sectionId: "a", builtin: true, name: "A snapshot" },
    { sectionId: "a", sourceId: "source-a", name: "A source" },
    { sectionId: "b", name: "B" },
    { sectionId: "c", name: "C" },
  ];
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("components/admin/DriveExport.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, AbortController, AbortSignal,
    fetch: async (_url, options) => {
      const input = options?.body ? JSON.parse(options.body) : null;
      if (!input) return { ok: true, json: async () => ({ destinations: [{ id: "target", label: "Archive" }] }) };
      if (input.action === "plan") return { ok: true, json: async () => ({ tasks }) };
      sent.push(input);
      return new Promise(resolve => pending.push({ input, resolve }));
    },
    require: name => name.endsWith(".css") ? { __esModule: true, default: {} }
      : name === "./DriveActionIcon" ? { __esModule: true, default: () => null }
      : name === "next/link" ? { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) }
      : require(name),
  });
  const container = window.document.createElement("div"), root = createRoot(container);
  const click = async text => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text).click());
  async function finish(section, sourceId, ok = true) {
    const index = pending.findIndex(item => item.input.sectionId === section && item.input.sourceId === sourceId);
    assert.ok(index >= 0);
    const [item] = pending.splice(index, 1);
    await act(async () => item.resolve({ ok, json: async () => ok ? { success: true } : { message: "Temporary failure" } }));
  }
  try {
    await act(async () => root.render(React.createElement(exports.default, { courseId: "course" })));
    await act(async () => container.querySelector("button").click());
    await act(async () => {
      const select = container.querySelector("select");
      select.value = "target"; select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await click("Save to Drive");
    assert.deepEqual(sent.map(item => item.name), ["A snapshot", "B"]);
    await finish("b");
    assert.deepEqual(sent.map(item => item.name), ["A snapshot", "B", "C"]);
    assert.equal(pending.length, 2);
    await finish("a");
    assert.deepEqual(sent.map(item => item.name), ["A snapshot", "B", "C", "A source"]);
    assert.equal(pending.length, 2);
    await finish("c", undefined, false);
    await finish("a", "source-a");
    assert.match(container.textContent, /3 document\(s\) saved/);
    await click("Retry remaining files");
    assert.equal(sent.length, 5);
    assert.equal(sent.at(-1).sectionId, "c");
    await finish("c");
    assert.match(container.textContent, /4 document\(s\) saved/);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});
