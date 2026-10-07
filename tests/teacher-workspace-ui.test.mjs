import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { Window } from "happy-dom";
import ts from "typescript";
import React, { act } from "react";

const require = createRequire(import.meta.url);
test("teacher uses the admin workspace, edits only owned content and keeps shared courses read-only", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent", "navigator", "FormData"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const courses = [
    { id: "admin", title: "Admin Analytics", status: "active", slug: "admin-analytics", language_label: "vi_en", canEdit: false, canDelete: false, folderGroupId: "business", metadata: { summary: "Admin materials" } },
    { id: "other", title: "Other teacher", status: "active", slug: "other", language_label: "en", canEdit: false, canDelete: false, folderGroupId: "business", metadata: { summary: "Other teacher materials" } },
    { id: "own", title: "My analytics course", status: "active", slug: "own", language_label: "en", canEdit: true, canDelete: true, folderGroupId: "business", metadata: { summary: "My summary" } },
  ];
  const sections = [{ id: "admin-section", title: "Admin lesson", course_id: "admin", status: "active", position: 1, section_key: "admin-lesson", canEdit: false, source_filename: "admin.pdf", content_path: "admin.pdf", content_type: "pdf" }];
  const calls = [], uploads = [];
  const folders = [{ id: "business", name: "Business Analytics", order: 1, canEdit: false }];
  let failCreate = false, sequence = 0;
  const layoutBackground = "data:image/png;base64," + fs.readFileSync("public/templates/eiu-business-v1/background.png").toString("base64");
  const fetch = async (url, options) => {
    if (url === "/api/templates") return { ok: true, json: async () => ({ templates: [{ id: "eiu-business-v1", name: "EIU Business", background: layoutBackground }] }) };
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body) calls.push(body);
    let createdCourseIds, createdFolderGroupId;
    if (body?.action === "create_folder_group") {
      createdFolderGroupId = "new-folder"; folders.push({ id: createdFolderGroupId, name: body.name, description: body.description, order: 2, canEdit: true });
    }
    if (body?.action === "update_folder_group") Object.assign(folders.find(f => f.id === body.id), { name: body.name });
    if (body?.action === "create_course") {
      if (failCreate) return { ok: false, json: async () => ({ success: false, message: "Unable to create course" }) };
      createdCourseIds = ["new-course"];
      courses.push({ id: "new-course", title: body.title, status: "active", slug: "new-course", language_label: "vi_en", folderGroupId: body.folderGroupId, canEdit: true, canDelete: true, metadata: { summary: "" } });
    }
    if (body?.action === "set_folder_group_hidden") folders.find(f => f.id === body.folderGroupId).hidden = body.hidden;
    if (body?.action === "set_course_hidden") courses.find(c => c.id === body.courseId).metadata.hidden = body.hidden;
    if (body?.action === "set_course_template") courses.find(c => c.id === body.courseId).metadata.templateKey = body.templateKey;
    if (body?.action === "create_section") for (const title of body.titles ?? [body.title]) sections.push({ id: `section-${++sequence}`, course_id: body.courseId, section_key: `lesson-${sequence}`, title, position: sequence, status: "active", source_filename: null, content_path: null, content_type: "builtin", canEdit: true });
    if (body?.action === "rename_section") sections.find(s => s.id === body.sectionId).title = body.title;
    if (body?.action === "update_course_description") courses.find(c => c.id === body.courseId).metadata.summary = body.summary;
    if (body?.action === "update_course_title") courses.find(c => c.id === body.courseId).title = body.title;
    if (body?.action === "update_course_system_icons") courses.find(c => c.id === body.courseId).systemIcons = body.systemIcons;
    if (body?.action === "set_course_language") courses.find(c => c.id === body.courseId).language_label = body.languageLabel;
    if (body?.action === "reorder_sections") body.sectionIds.forEach((id, index) => sections.find(s => s.id === id).position = index + 1);
    if (body?.action === "delete_sections") for (let i = sections.length - 1; i >= 0; i--) if (body.sectionIds.includes(sections[i].id)) sections.splice(i, 1);
    if (body?.action === "set_course_folder_group") courses.find(c => c.id === body.courseId).folderGroupId = body.folderGroupId;
    return { ok: true, json: async () => ({ success: true, courses: structuredClone(courses), sections: structuredClone(sections), folderGroups: structuredClone(folders), createdCourseIds, createdFolderGroupId }) };
  };
  const cache = {};
  const load = path => {
    if (cache[path]) return cache[path];
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, fetch, window, document: window.document, navigator: window.navigator, FormData: window.FormData, FileReader: window.FileReader, console, structuredClone,
      require: name => {
        if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
        if (name === "@/components/deck/EiuTemplateFrame") return { __esModule: true, default: load("components/deck/EiuTemplateFrame.tsx") };
        if (name === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
        if (name === "@/lib/courseIconImage") return { compressAndResizeIcon: async () => "data:image/png;base64,UE5H" };
        if (name === "@/lib/uploadQueue") return { createUploadQueue: () => task => task() };
        if (name === "@/lib/uploadSectionFile") return { uploadSectionFile: async (url, file, progress) => {
          uploads.push({ url, name: file.name }); progress?.(100);
          const section = sections.find(s => url.includes(`/${s.id}/`));
          Object.assign(section, { content_type: "pdf", content_path: file.name, source_filename: file.name, slide_count: 2 });
          return { contentType: "pdf", contentPath: file.name, sourceFilename: file.name, slideCount: 2 };
        } };
        if (name === "./TeacherAccounts") return { __esModule: true, default: () => React.createElement("div", null, "Account controls") };
        if (name.startsWith("./")) return { __esModule: true, default: load(new URL(`${name}.tsx`, `file:///${path.replaceAll('\\', '/')}`).pathname.slice(1)) };
        return require(name);
      },
    });
    cache[path] = exports.default; return exports.default;
  };
  const Portal = load("components/TeacherPortal.tsx");
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  const detail = () => container.querySelector('[aria-label="Selected course"]');
  const button = text => [...container.querySelectorAll("button")].find(b => b.textContent.trim() === text);
  const input = async (selector, value) => act(async () => { const el = container.querySelector(selector); assert.ok(el, selector); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); });
  const submit = async selector => act(async () => container.querySelector(selector).closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  const snapshot = name => {
    fs.mkdirSync("tmp/teacher-workspace", { recursive: true });
    const clone = container.cloneNode(true);
    [...container.querySelectorAll("select")].forEach((select, index) => [...clone.querySelectorAll("select")[index].options].forEach(option => option.toggleAttribute("selected", option.value === select.value)));
    fs.writeFileSync(`tmp/teacher-workspace/${name}.html`, `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Arial,sans-serif}${fs.readFileSync("components/admin/AdminAccessPortal.module.css", "utf8")}${fs.readFileSync("components/admin/TemplateLibrary.module.css", "utf8")}${fs.readFileSync("components/deck/UploadedSectionDeck.module.css", "utf8")}</style>${clone.innerHTML}`);
  };
  try {
    await act(async () => root.render(React.createElement(Portal, { name: "Teacher Example" })));
    assert.match(container.textContent, /Teacher Workspace/);
    assert.equal(container.querySelector('a[href="/admin/ai"]'), null);
    assert.doesNotMatch(container.textContent, /Authorized Emails|Teacher Accounts|PASSCODE:|ACCESS BYPASS CONTROL|Unlock All|Lock All/);
    assert.equal(detail().querySelector("h2").textContent, "My analytics course");
    assert.ok(container.querySelector(".passcodeLayout .courseList"), "same layout as admin");
    assert.equal(button("+ New Course").disabled, true, "teacher must create own root folder first");
    assert.equal(container.querySelector(".folderGroupCard .compactAddCourseBtn"), null);
    await act(async () => container.querySelector('[title="Edit course summary"]').click());
    await input(".descInput", ""); await act(async () => button("Save").click());
    assert.equal(calls.at(-1).summary, ""); assert.equal(detail().querySelector(".workspaceDescText").textContent, "");
    await act(async () => button("New Folder").click());
    await input('input[placeholder^="Folder name"]', "Teacher folder"); await submit('input[placeholder^="Folder name"]');
    assert.equal(calls.at(-1).action, "create_folder_group");
    await act(async () => button("+ New Course").click());
    assert.equal(container.querySelector(".newCourseInlineBox select").value, "new-folder");
    await input('.newCourseInlineBox input[type="text"]', "Z MIS 311");
    failCreate = true; await submit('.newCourseInlineBox input[type="text"]');
    assert.match(container.querySelector('[role="alert"]').textContent, /Unable to create/);
    assert.equal(container.querySelector('.newCourseInlineBox input[type="text"]').value, "Z MIS 311");
    failCreate = false; await submit('.newCourseInlineBox input[type="text"]');
    assert.equal(detail().querySelector("h2").textContent, "Z MIS 311");
    assert.equal(calls.at(-1).folderGroupId, "new-folder");
    const dropdown = detail().querySelector('[aria-label="Slide template"]');
    assert.equal(dropdown.value, "");
    assert.equal(detail().textContent.includes("Preview EIU template"), false);
    await act(async () => { dropdown.value = "eiu-business-v1"; dropdown.dispatchEvent(new window.Event("change", { bubbles: true })); });
    assert.equal(calls.at(-1).action, "set_course_template");
    assert.equal(calls.at(-1).templateKey, "eiu-business-v1");
    await input('.addSectionForm .addSectionInput', "Introduction"); await submit('.addSectionForm .addSectionInput');
    assert.equal(calls.at(-1).useEiuTemplate, undefined); assert.equal(calls.at(-1).courseId, "new-course");
    await act(async () => button("Rename").click());
    await input('[aria-label="Section name"]', "Introduction to MIS"); await submit('[aria-label="Section name"]');
    assert.equal(calls.at(-1).sectionId, "section-1");
    const transfer = new window.DataTransfer(); transfer.items.add(new window.File(["%PDF-1.4"], "lecture.pdf", { type: "application/pdf" }));
    await act(async () => { const el = detail().querySelector('input[type="file"][multiple]'); el.files = transfer.files; el.dispatchEvent(new window.Event("change", { bubbles: true })); });
    await act(async () => button("Upload 1 files").click());
    assert.equal(uploads[0].url, "/api/admin/sections/section-1/content");
    assert.ok(detail().querySelector('a[download="lecture.pdf"]'));
    assert.equal(detail().querySelector('.sectionItemRight a').getAttribute('href'), '/learn?courseId=new-course&sectionId=section-1');
    const multiple = [...detail().querySelectorAll("label")].find(l => l.textContent.includes("Add multiple sections")).querySelector("input");
    await act(async () => multiple.click());
    await input('.addSectionForm .addSectionInput', "Basics, Practice"); await submit('.addSectionForm .addSectionInput');
    assert.deepEqual(calls.at(-1).titles, ["Basics", "Practice"]);
    const reorder = detail().querySelector('[aria-label="Reorder Practice"]');
    await act(async () => reorder.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })));
    assert.equal(calls.at(-1).action, "reorder_sections");
    assert.deepEqual(calls.at(-1).sectionIds, ["section-1", "section-3", "section-2"]);
    const iconTransfer = new window.DataTransfer();
    iconTransfer.items.add(new window.File(["PNG"], "python.png", { type: "image/png" }));
    await act(async () => { const el = detail().querySelector('[aria-label="Upload course icon"]'); el.files = iconTransfer.files; el.dispatchEvent(new window.Event("change", { bubbles: true })); });
    assert.equal(calls.at(-1).action, "update_course_system_icons");
    assert.equal(calls.at(-1).courseId, "new-course");
    assert.equal(calls.at(-1).systemIcons[0].name, "python");
    await act(async () => detail().querySelector('[aria-label="Delete icon python"]').click());
    assert.equal(calls.at(-1).systemIcons.length, 0);
    await act(async () => container.querySelector('[title="Rename folder"]').click());
    await input('.folderRenameInput', 'My teaching materials');
    await act(async () => container.querySelector('.folderRenameSaveBtn').click());
    assert.equal(calls.at(-1).action, 'update_folder_group');
    assert.equal(calls.at(-1).id, 'new-folder');
    snapshot("owned");
    for (const title of ["Basics", "Practice"]) await act(async () => detail().querySelector(`input[title='Select section ${String.fromCharCode(8220)}${title}${String.fromCharCode(8221)}']`).click());
    await act(async () => button("Delete Selected Sections (2)").click());
    assert.ok(container.querySelector('[role="dialog"]'));
    await act(async () => button("Cancel").click());
    assert.equal(calls.at(-1).action, "update_folder_group");
    await act(async () => button("Delete Selected Sections (2)").click());
    await act(async () => container.querySelector('[data-confirm="true"]').click());
    assert.equal(calls.at(-1).action, "delete_sections");
    assert.equal(detail().querySelectorAll(".sectionItemRow").length, 1);
    await act(async () => button("My courses").click());
    assert.equal([...container.querySelectorAll(".compactCourseMain")].some(b => b.textContent.includes("Admin Analytics")), false);
    await act(async () => button("All courses").click());
    for (const title of ["Admin Analytics", "Other teacher"]) {
      await act(async () => [...container.querySelectorAll(".compactCourseMain")].find(b => b.textContent.includes(title)).click());
      assert.equal(detail().querySelector("h2").textContent, title);
      assert.match(detail().textContent, /Read only/);
      assert.equal(detail().querySelector("form"), null);
      assert.equal(detail().querySelector('input[type="file"]'), null);
      assert.equal(detail().querySelector('[title="Edit course title"]'), null);
      assert.equal(detail().querySelector('[title="Edit course summary"]'), null);
      assert.equal(detail().querySelector(".parentFolderSelect").disabled, true);
      assert.ok([...detail().querySelectorAll(".langBtn")].every(b => b.disabled));
      assert.equal(detail().querySelector('[aria-label^="Reorder"]'), null);
      assert.equal(detail().querySelector('.teacherOwnership a').getAttribute('href'), `/learn?courseId=${title === "Admin Analytics" ? "admin" : "other"}`);
      if (title === "Admin Analytics") { assert.ok(detail().querySelector('a[download="admin.pdf"]')); snapshot("readonly"); }
    }
    assert.equal(container.querySelector(".folderGroupCard").querySelector('[title="Rename folder"]'), null);
    assert.equal(container.querySelector('[title="Select Admin Analytics"]'), null);
    assert.equal(container.querySelector('[title="Select Other teacher"]'), null);
    const layoutTab = [...container.querySelectorAll('[role="tab"]')].find(tab => tab.textContent.includes("Slide Layouts"));
    assert.ok(layoutTab.closest('[role="tablist"]'));
    assert.equal(container.querySelector('header a[href="/layouts"]'), null);
    await act(async () => layoutTab.click());
    assert.ok(container.querySelector('[aria-label="Slide layout library"]'));
    assert.equal(container.querySelector('input[type=file]'), null);
    assert.equal(button("Delete layout"), undefined);
    snapshot('teacher-layouts');
    await act(async () => { root.unmount(); });
    const adminRoot = createRoot(container);
    await act(async () => adminRoot.render(React.createElement(cache['components/admin/AdminAccessPortal.tsx'], { adminEmail: 'admin@example.test' })));
    assert.match(container.textContent, /Authorized Emails|Teacher Accounts/);
    await act(async () => [...container.querySelectorAll('[role="tab"]')].find(b => b.textContent.includes('Course Setup')).click());
    assert.ok(container.querySelector('.masterAccessToolbar'));
    assert.ok(container.querySelector('[title="Rename folder"]'));
    assert.ok(detail().querySelector('[title="Edit course title"]'));
    const folderEye = container.querySelector('button[aria-label="Hide folder Business Analytics"]');
    assert.ok(folderEye.querySelector('svg'));
    assert.equal(folderEye.textContent.trim(), "");
    await act(async () => folderEye.click());
    assert.equal(calls.at(-1).action, "set_folder_group_hidden");
    assert.equal(calls.at(-1).hidden, true);
    const hiddenEye = container.querySelector('button[aria-label="Unhide folder Business Analytics"]');
    assert.equal(hiddenEye.getAttribute('aria-pressed'), "true");
    assert.ok(hiddenEye.querySelector('path[d="m3 3 18 18"]'));
    await act(async () => hiddenEye.click());
    const courseEye = container.querySelector('button[aria-label="Hide course Admin Analytics"]');
    await act(async () => courseEye.click());
    assert.equal(calls.at(-1).action, "set_course_hidden");
    assert.ok(container.querySelector('button[aria-label="Unhide course Admin Analytics"]'));
    await act(async () => container.querySelector('button[aria-label="Unhide course Admin Analytics"]').click());
    snapshot('admin');
    await act(async () => [...container.querySelectorAll('[role="tab"]')].find(tab => tab.textContent.includes("Slide Layouts")).click());
    assert.ok(container.querySelector('[aria-label="Slide layout library"]'));
    assert.ok(container.querySelector('input[type=file]'));
    snapshot('admin-layouts');
    await act(async () => button("Delete layout").click());
    assert.ok(container.querySelector('[role="dialog"]'));
    await act(async () => button("Cancel").click());
    await act(async () => adminRoot.unmount());
  } finally { await window.happyDOM.abort(); }
});
