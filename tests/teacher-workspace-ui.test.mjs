import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { Window } from "happy-dom";
import ts from "typescript";
import React, { act } from "react";

const require = createRequire(import.meta.url);
test("teacher workspace creates and selects owned courses, manages sections and keeps other courses read-only", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent", "navigator", "FormData"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const courses = [
    { id: "other", title: "Agentic AI", summary: "The admin's course", languageLabel: "vi_en", canEdit: false, folderGroupId: "fg-ai-agentic", folderGroupName: "AI & Agentic" },
    { id: "existing", title: "A previous course", summary: "Existing material", languageLabel: "en", canEdit: true, folderGroupId: "fg-ai-agentic", folderGroupName: "AI & Agentic" },
  ];
  const sections = [{ id: "other-section", title: "Admin lesson", course_id: "other", canEdit: false, source_filename: "admin.pdf", content_type: "pdf" }];
  const calls = [], uploads = [];
  const folderGroups = [{ id: "fg-ai-agentic", name: "AI & Agentic", order: 1 }];
  let failCreate = true;
  const fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    calls.push(body); let createdCourseIds, createdFolderGroupId;
    if (body?.action === "create_folder_group") {
      createdFolderGroupId = "fg-business";
      folderGroups.push({ id: createdFolderGroupId, name: body.name, description: body.description, order: 2 });
    }
    if (body?.action === "create_course") {
      if (failCreate) return { ok: false, json: async () => ({ message: "Course ownership setup needs an administrator update." }) };
      courses.push({ id: "new-course", title: body.title, summary: body.title, languageLabel: "vi_en", canEdit: true, folderGroupId: body.folderGroupId, folderGroupName: folderGroups.find(g => g.id === body.folderGroupId).name });
      createdCourseIds = ["new-course"];
    }
    if (body?.action === "create_section") sections.push({ id: "new-section", course_id: body.courseId, title: body.title, source_filename: null, content_type: "builtin", canEdit: true });
    if (body?.action === "rename_section") sections.find(s => s.id === body.sectionId).title = body.title;
    if (body?.action === "set_course_folder_group") {
      const course = courses.find(c => c.id === body.courseId);
      course.folderGroupId = body.folderGroupId;
      course.folderGroupName = folderGroups.find(g => g.id === body.folderGroupId).name;
    }
    return { ok: true, json: async () => ({ courses: courses.map(c => ({ ...c })), sections: sections.map(s => ({ ...s })), folderGroups: [...folderGroups], createdCourseIds, createdFolderGroupId }) };
  };
  function load(path, dependencies = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, fetch, window, FormData: window.FormData, console,
      require: name => dependencies[name] ?? (name.endsWith(".css") ? new Proxy({}, { get: (_, key) => key === "__esModule" ? false : `${name.includes("AdminAccess") ? "admin" : "teacher"}_${String(key)}` }) : name === "next/link" ? ({ children, ...props }) => React.createElement("a", props, children) : require(name)),
    });
    return exports.default;
  }
  const Header = load("components/admin/CourseManagerHeader.tsx");
  const Portal = load("components/TeacherPortal.tsx", {
    "./admin/CourseManagerHeader": Header,
    "@/lib/uploadSectionFile": { uploadSectionFile: async (url, file, onProgress) => {
      uploads.push({ url, name: file.name }); onProgress(100);
      sections.find(s => s.id === "new-section").source_filename = file.name;
      sections.find(s => s.id === "new-section").content_type = "pdf";
    } },
  });
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  const input = async (selector, value) => {
    const element = container.querySelector(selector); assert.ok(element, selector);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value);
      element.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  const submit = async selector => act(async () => container.querySelector(selector).closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  const button = text => [...container.querySelectorAll("button")].find(b => b.textContent.startsWith(text));
  const detail = () => container.querySelector('[aria-label="Selected course"]');
  try {
    await act(async () => root.render(React.createElement(Portal, { name: "Teacher Example" })));
    assert.match(container.textContent, /Teacher Workspace/);
    assert.match(container.textContent, /EIU · LEARNING PLATFORM TEACHING/);
    assert.equal(container.querySelector('a[href="/admin/ai"]'), null);
    assert.equal(detail().querySelector("h2").textContent, "A previous course");
    await input("#new-course-title", "Z MIS 311");
    await submit("#new-course-title");
    assert.match(container.querySelector('[role="alert"]').textContent, /ownership setup/);
    assert.equal(container.querySelector("#new-course-title").value, "Z MIS 311");
    assert.equal(detail().querySelector("h2").textContent, "A previous course");
    failCreate = false;
    await act(async () => button("+ New folder").click());
    await input("#new-folder-name", "Business Analytics");
    await submit("#new-folder-name");
    assert.equal(calls.at(-1).action, "create_folder_group");
    assert.equal(container.querySelector("#new-folder-name"), null);
    assert.equal(container.querySelector("#new-course-folder").value, "fg-business");
    assert.match(container.textContent, /Business Analytics/);
    await submit("#new-course-title");
    assert.equal(detail().querySelector("h2").textContent, "Z MIS 311", "new course is selected even when it is not first in the list");
    assert.equal(container.querySelector("#new-course-title").value, "");
    assert.equal(calls.at(-1).folderGroupId, "fg-business");
    assert.equal(container.querySelector('[role="alert"]'), null);
    await input("#new-section-title", "Introduction");
    await submit("#new-section-title");
    assert.equal(calls.at(-1).courseId, "new-course");
    assert.equal(container.querySelector("#new-section-title").value, "");
    assert.match(detail().textContent, /Introduction/);
    assert.equal(container.querySelector('[aria-label="Move Introduction up"]').disabled, true);
    await input("#title-new-section", "Introduction to MIS");
    await submit("#title-new-section");
    assert.equal(calls.at(-1).sectionId, "new-section");
    assert.match(detail().textContent, /Introduction to MIS/);
    const fileInput = container.querySelector('input[type="file"]');
    const transfer = new window.DataTransfer();
    transfer.items.add(new window.File(["%PDF-1.4"], "lecture.pdf", { type: "application/pdf" }));
    await act(async () => { fileInput.files = transfer.files; fileInput.dispatchEvent(new window.Event("change", { bubbles: true })); });
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].url, "/api/admin/sections/new-section/content");
    assert.match(detail().textContent, /lecture.pdf/);
    await act(async () => {
      const select = container.querySelector("#course-parent-folder");
      select.value = "fg-ai-agentic";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(calls.at(-1).action, "set_course_folder_group");
    assert.equal(calls.at(-1).courseId, "new-course");
    assert.equal(container.querySelector("#course-parent-folder").value, "fg-ai-agentic");
    await input('[aria-label="Search courses"]', "not-a-course");
    assert.match(detail().textContent, /No matching courses/);
    await act(async () => button("All courses").click());
    await act(async () => button("Agentic AI").click());
    assert.equal(detail().querySelector("h2").textContent, "Agentic AI");
    assert.match(detail().textContent, /belongs to another teacher or the admin/);
    assert.equal(detail().querySelector("form"), null);
    assert.equal(detail().querySelector('input[type="file"]'), null);
    assert.equal(detail().querySelector("button"), null);
  } finally {
    await act(async () => root.unmount()); await window.happyDOM.abort();
  }
});
