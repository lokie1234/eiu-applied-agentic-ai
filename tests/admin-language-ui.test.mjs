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

test("language saves retain the scrolling workspace and report pending, success and failure inside the card", async () => {
  const window = new Window({ url: "http://localhost/admin/access" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "navigator", "localStorage", "sessionStorage"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const courses = [{ id: "c1", slug: "course", title: "Course", status: "active", language_label: "vi", folderGroupId: "f1", metadata: {} }];
  const catalog = () => ({ success: true, courses: courses.map(course => ({ ...course })), sections: [{ id:"s1",course_id:"c1",section_key:"section1",title:"Lesson",position:1,status:"active",content_type:"tsx",content_path:"drive:lesson-id",source_filename:"Lesson.js" }], folderGroups: [{ id: "f1", name: "Folder", order: 0 }] });
  const calls = [];
  let finish;
  let finishUpload;
  const uploads = [];
  const fetch = async (url, options) => {
    if (url.endsWith("/content") && options?.method === "POST") {
      uploads.push(options.body);
      return new Promise(resolve => { finishUpload = resolve; });
    }
    if (options?.method === "POST") {
      calls.push(JSON.parse(options.body));
      return new Promise(resolve => { finish = resolve; });
    }
    return { ok: true, json: async () => url.includes("destinations") ? { destinations: [{ id: "dest1", label: "Course files" }] } : url.includes("/api/templates") ? { templates: [] } : catalog() };
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
      setTimeout, clearTimeout, console, URL, AbortController, AbortSignal, FormData, File,
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
    assert.match(container.textContent, /JS \u00b7 Drive \u00b7 Lesson\.js/);
    assert.doesNotMatch(container.textContent, /TSX \u00b7 Drive/);
    const downloadJs = container.querySelector('a[aria-label="Download Lesson as JS"]');
    assert.equal(downloadJs.getAttribute("href"), "/api/sections/s1/content?download=1");
    assert.equal(downloadJs.getAttribute("download"), "Lesson.js");
    assert.equal(downloadJs.getAttribute("title"), "Download to PC");
    assert.equal(downloadJs.textContent, "", "the action stays a compact icon");
    const pcActions = container.querySelector('[aria-label="PC file actions"]');
    const driveActions = container.querySelector('[aria-label="Drive file actions"]');
    assert.equal(pcActions.children[0].getAttribute("aria-label"), "Upload Lesson from PC");
    assert.equal(pcActions.children[2], downloadJs, "PC upload and download share one action group");
    assert.equal(pcActions.children[0].className, downloadJs.className, "PC controls use the same button style");
    assert.equal(driveActions.querySelectorAll("button").length >= 2, true);
    assert.equal(pcActions.nextElementSibling, driveActions, "Drive controls are grouped beside PC controls");
    const workspace = container.querySelector(".scrollArea");
    const language = container.querySelector('[aria-labelledby="course-language-heading"]');
    const button = text => [...language.querySelectorAll("button")].find(button => button.textContent === text);
    const feedback = language.querySelector('[role="status"]');
    workspace.scrollTop = 180;
    const stable = () => {
      assert.equal(container.querySelector(".scrollArea"), workspace);
      assert.equal(workspace.scrollTop, 180);
      assert.equal(language.querySelector('[role="status"]'), feedback);
      assert.equal(container.querySelector(".notice, .error, .processingBanner"), null);
    };
    await act(async () => button("Vietnamese").click());
    assert.equal(calls.length, 0, "the current language does not trigger a save");
    await act(async () => { button("English").click(); button("English").click(); });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, "set_course_language");
    assert.equal(calls[0].languageLabel, "en");
    assert.equal(button("English").disabled, true);
    assert.match(feedback.textContent, /Saving language/);
    stable();
    courses[0].language_label = "en";
    await act(async () => finish({ ok: true, json: async () => catalog() }));
    assert.equal(button("English").getAttribute("aria-pressed"), "true");
    assert.match(feedback.textContent, /Language saved/);
    stable();
    await act(async () => button("Vietnamese").click());
    await act(async () => finish({ ok: false, json: async () => ({ success: false, message: "Unable to save language." }) }));
    assert.match(feedback.textContent, /Unable to save language/);
    assert.equal(button("English").getAttribute("aria-pressed"), "true");
    assert.equal(button("Vietnamese").disabled, false);
    stable();
    const termination = () => container.querySelector('[aria-label="Enable Terminate section for Lesson"]');
    assert.equal(termination().getAttribute("aria-pressed"), "false");
    await act(async () => termination().click());
    assert.deepEqual(calls.at(-1), {action:"set_section_termination",sectionId:"s1",enabled:true});
    courses[0].metadata.terminableSectionIds = ["s1"];
    await act(async () => finish({ ok: true, json: async () => catalog() }));
    assert.equal(termination().getAttribute("aria-pressed"), "true");
    await act(async () => termination().click());
    assert.equal(calls.at(-1).enabled, false);
    courses[0].metadata.terminableSectionIds = [];
    await act(async () => finish({ ok: true, json: async () => catalog() }));
    assert.equal(termination().getAttribute("aria-pressed"), "false");
    await act(async () => pcActions.children[0].click());
    const uploadDialog = pcActions.querySelector("dialog");
    const fileInput = uploadDialog.querySelector('input[type="file"]');
    const uploadButton = [...uploadDialog.querySelectorAll("button")].find(button => button.textContent === "Upload file");
    assert.equal(uploadDialog.open, true);
    assert.equal(uploadDialog.querySelector("select").value, "dest1");
    assert.equal(uploadButton.disabled, true);
    async function choose(file) {
      Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
      await act(async () => fileInput.dispatchEvent(new window.Event("change", { bubbles: true })));
    }
    await choose(new File(["invalid"], "bad.exe"));
    assert.match(uploadDialog.textContent, /Choose a nonempty/);
    assert.equal(uploadButton.disabled, true);
    await choose(new File(["%PDF-1.4"], "lesson.pdf"));
    await act(async () => { uploadButton.click(); uploadButton.click(); });
    assert.equal(uploads.length, 1, "double clicks do not create duplicate uploads");
    assert.equal(uploads[0].get("file").name, "lesson.pdf");
    assert.equal(uploads[0].get("replaceLesson"), "1");
    assert.equal(uploads[0].get("destinationId"), "dest1");
    await act(async () => finishUpload({ ok: false, json: async () => ({ message: "Drive unavailable." }) }));
    assert.match(uploadDialog.textContent, /Drive unavailable/);
    assert.equal(uploadButton.disabled, false, "a failed upload can be retried");
    await act(async () => uploadButton.click());
    await act(async () => finishUpload({ ok: true, json: async () => ({ success: true, message: "File connected." }) }));
    assert.match(uploadDialog.textContent, /File connected/);
    assert.equal(uploadButton.disabled, true);
    assert.equal(fileInput.value, "");
  } finally {
    await act(async () => root.unmount());
    await window.happyDOM.close();
  }
});
