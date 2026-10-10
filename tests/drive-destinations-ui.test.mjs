import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);

test("destinations require a picked folder, preserve it on failure and reset after saving", async () => {
  const window = new Window({ url: "http://localhost/admin/drive" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let callback;
  class DocsView {
    setIncludeFolders() { return this; }
    setSelectFolderEnabled() { return this; }
    setMimeTypes() { return this; }
  }
  class PickerBuilder {
    addView() { return this; }
    setOAuthToken() { return this; }
    setDeveloperKey() { return this; }
    setAppId() { return this; }
    setOrigin() { return this; }
    setTitle() { return this; }
    setCallback(next) { callback = next; return this; }
    build() { return { setVisible() {}, dispose() {} }; }
  }
  const google = { picker: { DocsView, PickerBuilder, ViewId: { FOLDERS: "folders" }, Action: { PICKED: "picked", CANCEL: "cancel" } } };
  const writes = [];
  let finish;
  let destinations = [];
  const fetch = async (url, options) => {
    if (url.endsWith("/picker")) return { ok: true, json: async () => ({ accessToken: "test", apiKey: "test", appId: "test" }) };
    if (options?.method === "POST") {
      writes.push(JSON.parse(options.body));
      return new Promise(resolve => { finish = resolve; });
    }
    return { ok: true, json: async () => ({ destinations }) };
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL("../app/admin/drive/FolderPicker.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, fetch, google, window, require: name =>
    name.endsWith(".css") ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } :
    name === "@/lib/googlePicker" ? { loadPicker: async () => {} } :
    name === "next/image" ? { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) } : require(name) });
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const button = text => [...container.querySelectorAll("button")].find(button => button.textContent === text);
  const submit = async () => act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  try {
    await act(async () => root.render(React.createElement(exports.default, { configured: true })));
    assert.equal(button("Add destination").disabled, true);
    assert.equal(container.querySelector("input"), null, "initial selection only uses Browse folders");
    await submit();
    assert.equal(writes.length, 0);
    await act(async () => button("Browse folders").click());
    await act(async () => callback({ action: "cancel" }));
    assert.equal(button("Add destination").disabled, true);
    await act(async () => button("Browse folders").click());
    await act(async () => callback({ action: "picked", docs: [{ id: "folder-123", name: "Course materials" }] }));
    assert.equal(button("Add destination").disabled, false);
    assert.equal(container.querySelectorAll("input").length, 1, "only the display name is editable");
    assert.equal(container.querySelector("input").value, "Course materials");
    await act(async () => { container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
    assert.equal(writes.length, 1, "duplicate submission is blocked");
    assert.equal(writes[0].link, "https://drive.google.com/drive/folders/folder-123");
    await act(async () => finish({ ok: false, json: async () => ({ message: "Save failed" }) }));
    assert.match(container.textContent, /Save failed/);
    assert.equal(button("Add destination").disabled, false);
    assert.equal(container.querySelector("input").value, "Course materials");
    await submit();
    destinations = [{ id: "d1", label: "Course materials", folder_id: "folder-123" }];
    await act(async () => finish({ ok: true, json: async () => ({ destinations }) }));
    assert.equal(button("Add destination").disabled, true);
    assert.equal(container.querySelector("input"), null);
    assert.match(container.textContent, /Drive destination saved/);
    await act(async () => button("Edit").click());
    assert.equal(button("Save changes").disabled, false, "an existing saved folder can be renamed");
    await act(async () => button("Cancel").click());
    assert.equal(button("Add destination").disabled, true);
    await act(async () => root.render(React.createElement(exports.default, { configured: false })));
    assert.equal(button("Browse folders").disabled, true);
    assert.equal(button("Add destination").disabled, true);
  } finally {
    await act(async () => root.unmount());
    await window.happyDOM.close();
  }
});
