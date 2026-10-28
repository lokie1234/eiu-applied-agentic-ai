import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
function load(path, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, AbortController, AbortSignal, ...globals,
    require: name => dependencies[name] ?? (name.endsWith(".css") ? new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }) : require(name)) });
  return exports;
}

test("Google admin code is inline and auto-submits once at six digits without buttons", async () => {
  const window = new Window({ url: "https://eiu.test" });
  for (const name of ["window", "document", "HTMLElement", "navigator"]) Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: true });
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  const requests = [];
  const { default: Card } = load("components/landing/SignInCard.tsx", {
    "@/lib/learningLanguage": { useLearningLanguage: () => ({ language: "en", setLanguage() {}, t: text => text }) },
    "./useGlassInteraction": { useGlassInteraction: () => ({}) },
    "./LearnerInformationDialog": { __esModule: true, default: () => null },
  }, { window, document: window.document, fetch: async (url, options) => { requests.push({ url, options }); return { ok: false, json: async () => ({ message: "Incorrect admin code." }) }; } });
  try {
    await act(async () => root.render(React.createElement(Card, { initialLanguageChosen: true, passcode: "", setPasscode() {}, loading: false, onSubmit() { throw Error("Learner login must not handle admin codes"); } })));
    await act(async () => container.querySelectorAll(".choice")[1].click());
    assert.equal(container.querySelector(".quickAccessToggle"), null);
    const input = container.querySelector("#admin-quick-code");
    assert.ok(input.closest(".accountNote"));
    assert.equal(input.type, "password");
    assert.equal(input.maxLength, 6);
    assert.equal(container.querySelector('#admin-quick-access button'), null);
    const enter = async value => act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await enter("12345");
    assert.equal(requests.length, 0);
    await enter("123456");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/auth/admin");
    assert.equal(JSON.parse(requests[0].options.body).password, "123456");
    assert.equal(container.querySelector("#admin-quick-error").textContent, "Incorrect admin code.");
    await act(async () => container.querySelector("#admin-quick-access").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(requests.length, 1, "a failed code must not re-submit itself");
    await enter("12345");
    await enter("123457");
    assert.equal(requests.length, 2, "editing the code allows a fresh attempt");
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test("admin endpoint rejects cross-origin requests and incorrect passwords without setting a session", async () => {
  const route = load("app/api/auth/admin/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/auth/adminPassword": { verifyAdminPassword: () => false },
    "@/lib/auth/session": {}, "@/lib/auth/types": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => ({}) },
  }, { URL });
  const request = origin => new Request("https://eiu.test/api/auth/admin", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ password: "000000" }) });
  assert.equal((await route.POST(request("https://other.test"))).status, 403);
  assert.equal((await route.POST(request("https://eiu.test"))).status, 401);
});
