import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports, console, AbortController, AbortSignal, ...globals,
    require: name => dependencies[name] ?? (name.endsWith(".css") ? new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) }) : require(name)),
  });
  return exports;
}

async function fixture(scope, role) {
  const window = new Window({ url: "http://localhost/learn" }), calls = [], hidden = new Map();
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container), presenter = role === "admin" || role === "teaching";
  let failRead = false;
  const items = [{ id: "one", name: "Learner One", url: "https://example.test/app", sharedAt: "2026-10-22" }];
  const globals = { window, document: window.document, fetch: async (url, options = {}) => {
    calls.push({ url, ...options });
    const body = options.method === "POST" ? { item: { ...items[0], id: "two", url: JSON.parse(options.body).url } }
      : failRead ? { message: "Unable to load links" } : { items };
    return { ok: !failRead, text: async () => JSON.stringify(body) };
  } };
  window.confirm = () => true;
  const Showcase = load("components/ShowcaseSlide.tsx", {
    "@/lib/supabase/browser": { getSupabaseBrowserClient: () => null },
    "@/lib/liveRefresh": load("lib/liveRefresh.ts"),
    "@/lib/slideStorage": { getSlideStorage: key => hidden.get(key), setSlideStorage: (key, value) => hidden.set(key, value), SLIDE_STORAGE_KEYS: { s1_hiddenShowcase: "s1", s2_hiddenShowcase: "s2" } },
  }, globals).default;
  let Component = Showcase, props = { scale: 1, isAdmin: presenter, sectionId: "web-section", courseTitle: "Web Development", sectionTitle: "Section 1" };
  if (scope !== "web") {
    const empty = { __esModule: true, default: () => null };
    const page = scope === "section1" ? presenter ? 40 : 39 : 38;
    const dependencies = {
      "@/components/ShowcaseSlide": { __esModule: true, default: Showcase },
      "@/components/deck/SharedDeckFrame": { __esModule: true, default: ({ renderSlide }) => renderSlide(page, 960) },
      "@/components/QuizSlide": empty, "@/components/section1/SectionOneHtmlSlide": empty,
      "@/components/section1/SectionOneNativeSlide": empty, "@/components/section1/SectionOneSlide14": empty,
      "./SectionTwoSlide": empty, "@/lib/builtinDeckItems": load("lib/builtinDeckItems.ts"),
    };
    Component = load(scope === "section1" ? "components/PdfDeck.tsx" : "components/section2/SectionTwoDeck.tsx", dependencies, globals).default;
    props = { isAdmin: presenter };
  }
  await act(async () => { root.render(React.createElement(Component, props)); });
  await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 10)); });
  return { window, container, calls, hidden, failRead: () => { failRead = true; }, close: async () => { await act(async () => root.unmount()); await window.happyDOM.close(); } };
}

test("all three sharing slides show only the board for admin/teaching and retain the full submission flow for learners", async () => {
  for (const scope of ["web", "section1", "section2"]) for (const role of ["admin", "teaching", "learner"]) {
    const f = await fixture(scope, role);
    try {
      assert.equal(f.container.querySelector('.item a').href, 'https://example.test/app', `${scope}/${role}: submitted links remain accessible`);
      const form = f.container.querySelector('form');
      if (role !== "learner") {
        assert.equal(form, null, `${scope}/${role}: no submission form`);
        assert.ok(f.container.querySelector('.boardOnly'));
        await act(async () => f.container.querySelector('.showcase-delete-button').click());
        assert.equal(f.container.querySelector('.item'), null);
        assert.doesNotMatch(f.container.querySelector('.empty').textContent, /Hãy là người đầu tiên/);
        assert.equal(f.calls.some(call => call.method === 'POST' || call.method === 'DELETE'), false, 'hiding is local and does not remove report data');
        assert.equal(f.hidden.size, 1);
        assert.ok(f.container.querySelector('.board [role="status"]'), 'presenter feedback stays visible without a form');
      } else {
        assert.ok(form); assert.equal(f.container.querySelector('.boardOnly'), null);
        const input = form.querySelector('input[type="url"]');
        await act(async () => {
          Object.getOwnPropertyDescriptor(f.window.HTMLInputElement.prototype, 'value').set.call(input, 'https://example.test/new');
          input.dispatchEvent(new f.window.Event('input', { bubbles: true }));
        });
        await act(async () => form.dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
        assert.equal(f.container.querySelectorAll('.item').length, 2);
        assert.equal(input.value, '');
      }
    } finally { await f.close(); }
  }
});

test("presenters can still see list-loading errors after the submission panel is removed", async () => {
  const f = await fixture('web', 'admin');
  try {
    f.failRead();
    await act(async () => f.container.querySelector('[aria-label="Tải lại danh sách"]').click());
    assert.equal(f.container.querySelector('.board [role="status"]').textContent, 'Unable to load links');
    assert.equal(f.container.querySelector('form'), null);
  } finally { await f.close(); }
});
