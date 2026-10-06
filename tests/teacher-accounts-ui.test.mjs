import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { Window } from "happy-dom";
import ts from "typescript";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
const require = createRequire(import.meta.url);
test("teacher management renders a searchable full table and reveals passwords only on request", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent", "KeyboardEvent"]) globalThis[name] = name === "window" ? window : window[name];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const accounts = [
    { id: "1", email: "an.nguyen@example.test", display_name: "Nguyễn Minh An", status: "active", must_change_password: true },
    { id: "2", email: "linh.tran@example.test", display_name: "Trần Thùy Linh", status: "active", must_change_password: false },
    { id: "3", email: "khoa.le@example.test", display_name: "Lê Anh Khoa", status: "suspended", must_change_password: false },
  ];
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null; calls.push(body);
    return { ok: true, json: async () => body?.action === "reveal_password" ? { password: "000007" } : { accounts } };
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("components/admin/TeacherAccounts.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, fetch: globalThis.fetch, document: window.document, navigator: window.navigator, console,
    require: name => name.endsWith(".css") ? new Proxy({}, { get: (_, key) => key === "__esModule" ? false : `teacher_${String(key)}` }) : require(name),
  });
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(exports.default)); });
  assert.match(container.textContent, /Nguyễn Minh An/);
  assert.match(container.textContent, /Suspended/);
  assert.match(container.textContent, /Changed/);
  assert.equal(calls.filter(c => c?.action === "reveal_password").length, 0);
  const reveal = container.querySelector('[aria-label="View password for an.nguyen@example.test"]');
  await act(async () => { reveal.click(); });
  assert.match(container.textContent, /000007/);
  assert.equal(calls.at(-1).action, "reveal_password");
  await act(async () => { container.querySelector('[aria-label="Hide password for an.nguyen@example.test"]').click(); });
  assert.equal(container.textContent.includes("000007"), false);
  const filter = container.querySelector('[aria-label="Filter teachers"]');
  await act(async () => { filter.value = "suspended"; filter.dispatchEvent(new window.Event("change", { bubbles: true })); });
  assert.equal(container.textContent.includes("Nguyễn Minh An"), false);
  assert.match(container.textContent, /Lê Anh Khoa/);
  await act(async () => { filter.value = "all"; filter.dispatchEvent(new window.Event("change", { bubbles: true })); });
  if (process.env.WRITE_TEACHER_PREVIEW) {
    let teacherCss = fs.readFileSync("components/admin/TeacherAccounts.module.css", "utf8").replace(/\.([a-zA-Z][\w-]*)/g, ".teacher_$1");
    let adminCss = fs.readFileSync("components/admin/AdminAccessPortal.module.css", "utf8").replace(/\.([a-zA-Z][\w-]*)/g, ".admin_$1");
    const markup = `<main class="admin_page"><header class="admin_header"><div class="admin_headerTitleGroup"><span>EIU · LEARNING PLATFORM ADMINISTRATION</span><h1>Admin Control Center</h1><p>Admin: <b>son.lam@eiu.edu.vn</b> · Centralized Learner Access &amp; Course Management</p></div><nav class="admin_headerNav"><a href="#">Learning Space</a><a href="#">✦ AI Knowledge</a><button>Sign out</button></nav></header><div class="admin_topControlRow"><div class="admin_tabsTrack"><button class="admin_tabBtn">✉ Authorized Emails <span class="admin_tabBadge">1</span></button><button class="admin_tabBtn">▣ Course Setup &amp; Structure <span class="admin_tabBadge">1</span></button><button class="admin_tabBtn admin_tabBtnActive">♙ Teacher Accounts</button></div></div><div class="admin_scrollArea">${container.innerHTML}</div></main>`;
    fs.mkdirSync("tmp/teacher-qa", { recursive: true });
    fs.writeFileSync("tmp/teacher-qa/index.html", `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}${adminCss}${teacherCss}</style></head><body>${markup}</body></html>`);
  }
  await act(async () => { root.unmount(); }); window.happyDOM.abort();
});
