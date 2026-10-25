import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";
const require = createRequire(import.meta.url);

async function fixture({ restored = 1, reduced = false, supported = true } = {}) {
  const window = new Window({ url: "http://localhost/learn" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: reduced });
  const calls = [], writes = [], ready = new Set([restored]);
  if (supported) window.document.startViewTransition = update => {
    let complete;
    const finished = new Promise(resolve => { complete = resolve; });
    const updateCallbackDone = Promise.resolve().then(update);
    const call = { complete, updateCallbackDone, skipped: false };
    calls.push(call);
    return { ready: updateCallbackDone, updateCallbackDone, finished: updateCallbackDone.then(() => finished),
      skipTransition() { call.skipped = true; complete(); } };
  };
  else {
    window.document.startViewTransition = undefined;
    window.HTMLElement.prototype.animate = undefined;
  }
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("components/deck/SharedDeckFrame.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, window, document: window.document, MutationObserver: window.MutationObserver,
    requestAnimationFrame: cb => window.requestAnimationFrame(cb), cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    ResizeObserver: class { observe() {} disconnect() {} },
    require: name => name === "@/lib/deckLocation" ? { rememberSlide: page => writes.push(page), restoredSlide: () => restored }
      : ["next/image", "@/components/DeckSideAmbient", "@/components/WorkshopLaunchButton"].includes(name) ? { __esModule: true, default: () => null } : require(name),
  });
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div"), root = createRoot(container);
  const render = () => root.render(React.createElement(exports.default, { courseTitle: "Web", sectionTitle: "Section 1", totalSlides: 5,
    slideTransitions: true, renderSlide: page => React.createElement("div", { "data-slide-content-ready": ready.has(page), "data-page": page }, `Slide ${page}`) }));
  await act(async () => render());
  await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  return { window, container, calls, writes, ready,
    click: title => act(async () => container.querySelector(`[title="${title}"]`).click()),
    prepared: page => act(async () => { ready.add(page); render(); await new Promise(resolve => setTimeout(resolve, 0)); }),
    close: async () => { await act(async () => root.unmount()); await window.happyDOM.close(); },
  };
}

test("navigation waits for real content before starting the outgoing/incoming transition", async () => {
  const f = await fixture();
  try {
    assert.equal(f.calls.length, 0, "initial opening must not animate a loading screen");
    await f.click("Next slide");
    assert.equal(f.calls.length, 1);
    assert.equal(f.container.querySelector('[data-slide-transition]').dataset.slideTransition, "preparing");
    assert.deepEqual(f.writes, [2]);
    await f.prepared(2);
    await f.calls[0].updateCallbackDone;
    assert.equal(f.container.querySelector('[data-slide-transition]').dataset.slideTransition, "animating");
    await act(async () => f.calls[0].complete());
    assert.equal(f.window.document.documentElement.hasAttribute("data-eiu-slide-transition"), false);
  } finally { await f.close(); }
});

test("rapid navigation cancels the previous wait and unmount releases the final transition", async () => {
  const f = await fixture();
  await f.click("Next slide");
  await f.click("Next slide");
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].skipped, true);
  assert.equal(f.container.querySelector('[data-page]').dataset.page, "3");
  await f.close();
  assert.equal(f.calls[1].skipped, true);
  assert.equal(f.window.document.documentElement.hasAttribute("data-eiu-slide-transition"), false);
});

test("restored positions, reduced motion and browsers without animation APIs still navigate", async () => {
  for (const options of [{ restored: 3, reduced: true }, { supported: false }]) {
    const f = await fixture(options);
    try {
      assert.equal(f.calls.length, 0);
      await f.click("Next slide");
      assert.equal(f.container.querySelector('[data-page]').dataset.page, String((options.restored ?? 1) + 1));
      assert.equal(f.calls.length, 0);
    } finally { await f.close(); }
  }
});
