import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
test("slide 11 opens four demos, cycles approval and spreadsheet data, and cleans up on close", async () => {
  const window = new Window();
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const timers = new Map();
  let nextId = 0;
  window.setInterval = callback => { timers.set(++nextId, callback); return nextId; };
  window.clearInterval = id => timers.delete(id);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("components/section1/SectionOneSlide11.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, window, require: name => {
    if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
    if (name === "next/image") return { __esModule: true, default: props => React.createElement("img", props) };
    return require(name);
  } });
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  const click = async target => act(async () => target.click());
  const tick = async () => act(async () => { for (const callback of timers.values()) callback(); });
  const dialog = () => container.querySelector('[role="dialog"]');
  const close = () => click(dialog().querySelector("button"));
  try {
    await act(async () => root.render(React.createElement(exports.default)));
    const cards = [...container.querySelectorAll('[aria-haspopup="dialog"]')];
    assert.equal(cards.length, 4);
    assert.doesNotMatch(container.textContent, /Bấm để hiện câu trả lời/);
    await click(cards[0]);
    assert.match(dialog().textContent, /Tạo đơn xin nghỉ/);
    assert.equal(window.document.activeElement, dialog().querySelector("button"));
    assert.equal(timers.size, 0);
    await close();
    assert.equal(window.document.activeElement, cards[0]);
    await click(cards[1]);
    assert.match(dialog().querySelector(".active").textContent, /Nhân viên/);
    await tick(); assert.match(dialog().querySelector(".active").textContent, /Phó phòng/);
    await tick(); assert.match(dialog().querySelector(".active").textContent, /Trưởng phòng/);
    await tick(); assert.equal(dialog().querySelectorAll(".done").length, 3);
    await tick(); assert.match(dialog().querySelector(".active").textContent, /Nhân viên/);
    await close(); assert.equal(timers.size, 0);
    await click(cards[2]);
    assert.equal(dialog().querySelectorAll('[data-filled="true"]').length, 0);
    for (let count = 1; count <= 5; count++) {
      await tick(); assert.equal(dialog().querySelectorAll('[data-filled="true"]').length, count);
    }
    assert.match(dialog().textContent, /NP005/);
    await tick(); await tick(); await tick();
    assert.equal(dialog().querySelectorAll('[data-filled="true"]').length, 0);
    await close(); assert.equal(timers.size, 0);
    await click(cards[3]);
    assert.match(dialog().textContent, /Đơn xin nghỉ được duyệt/);
    assert.match(dialog().textContent, /Đơn xin nghỉ bị từ chối/);
    assert.ok(dialog().querySelector('[aria-label="Mặt cười"]'));
    assert.ok(dialog().querySelector('[aria-label="Mặt giận"]'));
    await act(async () => dialog().querySelector("button").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.equal(dialog(), null);
    assert.equal(timers.size, 0);
    await click(cards[2]);
    assert.equal(dialog().querySelectorAll('[data-filled="true"]').length, 0);
  } finally {
    await act(async () => root.unmount());
    assert.equal(timers.size, 0);
    await window.happyDOM.close();
  }
});
