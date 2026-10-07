import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import { Window } from "happy-dom";
import ts from "typescript";
import React, { act } from "react";

const require = createRequire(import.meta.url);
test("landing teacher login reveals the password, submits it, and clears it when the email changes", async () => {
  const window = new Window({ url: "http://localhost" });
  for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "Event", "MouseEvent", "navigator", "localStorage"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const motionComponents = new Map();
  const motion = new Proxy({}, { get(_, tag) {
    if (!motionComponents.has(tag)) motionComponents.set(tag, ({ initial, animate, exit, transition, whileHover, whileTap, ...props }) => React.createElement(tag, props));
    return motionComponents.get(tag);
  } });
  const calls = []; const timers = [];
  const fetch = async (_, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    return { ok: false, json: async () => body.adminPassword
      ? { success: false, message: "Incorrect email or password, or account suspended." }
      : { success: false, requireTeacherPassword: true } };
  };
  function load(path, dependencies = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, fetch, window, document: window.document, localStorage: window.localStorage,
      setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {}, console,
      require: name => dependencies[name] ?? (name.endsWith(".css") ? {} : name === "motion/react" ? { motion, AnimatePresence: ({ children }) => children, useReducedMotion: () => true } : require(name)),
    });
    return exports.default;
  }
  const Hero = load("components/landing/AnimatedHeroCopy.tsx");
  const Landing = load("components/LandingPage.tsx", {
    "next/image": () => null, "next/dynamic": () => () => null,
    "./landing/AnimatedHeroCopy": Hero, "./landing/EntranceBootOverlay": () => null, "./EiuAgentBot": () => null,
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
  const submit = async () => act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  try {
    await act(async () => root.render(React.createElement(Landing)));
    assert.equal(container.querySelector('input[type="password"]'), null);
    await input("#hero-email-input", "teacher@example.test");
    await submit();
    assert.equal(calls.length, 1); assert.equal(calls[0].adminPassword, "");
    assert.match(container.textContent, /Teacher Password/);
    assert.ok(container.querySelector('input[type="password"]'));
    assert.equal(container.querySelector("#landing-access-button").disabled, true);
    assert.equal(container.querySelector('[role="alert"]'), null);
    await submit(); assert.equal(calls.length, 1);
    await input('input[type="password"]', " wrong password ");
    await submit();
    assert.equal(calls[1].adminPassword, " wrong password ");
    assert.match(container.querySelector('[role="alert"]').textContent, /Incorrect email or password/);
    assert.ok(container.querySelector('input[type="password"]'));
    await input("#hero-email-input", "learner@example.test");
    assert.equal(container.querySelector('input[type="password"]'), null);
    await submit(); assert.equal(calls[2].adminPassword, "");
    await input("#hero-email-input", "son.lam@eiu.edu.vn");
    assert.match(container.textContent, /Administrator Password/);
    assert.equal(container.querySelector('input[type="password"]').value, "");
  } finally {
    await act(async () => root.unmount()); await window.happyDOM.abort();
  }
});
