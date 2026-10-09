import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
function load(path, dependencies, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path, "utf8").replace(/^pdfjs.GlobalWorkerOptions.workerSrc =.*$/m, "");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, console, Date, AbortController, AbortSignal, ...globals,
    require: name => name.endsWith(".css") ? new Proxy({}, { get: (_, key) => String(key) }) : dependencies[name] ?? require(name),
  });
  return exports;
}

test("heartbeat resolves access once per request and still rejects revoked or wrong-section access", async () => {
  let reads = 0, writes = 0;
  let access = { isActive: true, isAdmin: false, displayName: "Alice", email: "alice@test.example", authUserId: "session",
    courses: [{ id: "course", slug: "applied-agentic-ai" }], sections: [{ courseId: "course", sectionKey: "section1" }] };
  const users = { currentUserAccess: async () => { reads++; return access; } };
  const roles = load("lib/currentRole.ts", {
    "server-only": {}, "next/headers": { cookies: async () => ({ get: () => ({ value: "section1" }) }) },
    "@/lib/auth/currentUser": users,
    "@/lib/auth/types": { ACTIVE_SECTION_COOKIE: "section", APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai", isLearningSection: value => ["section1", "section2"].includes(value) },
  });
  const profiles = load("lib/currentLearnerProfile.ts", { "server-only": {}, "@/lib/auth/currentUser": users, "@/lib/currentRole": roles });
  const route = load("app/api/presence/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": users, "@/lib/currentRole": roles, "@/lib/currentLearnerProfile": profiles,
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ upsert: async row => {
      writes++; assert.equal(row.name, "Alice"); return { error: null };
    } }) }) },
  });
  const heartbeat = section => route.POST({ text: async () => JSON.stringify({ section, clientId: "client", action: "heartbeat" }) });
  assert.equal((await heartbeat("section1")).status, 200);
  assert.equal(reads, 1); assert.equal(writes, 1);
  assert.equal((await heartbeat("section2")).status, 403);
  assert.equal(reads, 2); assert.equal(writes, 1);
  access = null;
  assert.equal((await heartbeat("section1")).status, 403);
  assert.equal(reads, 3); assert.equal(writes, 1);
});

test("PDF navigation and zoom retain the document while each slide keeps its transition", async () => {
  const window = new Window({ url: "http://localhost/learn" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  let mounts = 0, cleanups = 0;
  function Document({ children, onLoadSuccess }) {
    // This mock reports document load once, just as the PDF worker does for a fixed file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { mounts++; onLoadSuccess({ numPages: 3 }); return () => { cleanups++; }; }, []);
    return React.createElement("div", { "data-document": true }, children);
  }
  const globals = { window, document: window.document,
    requestAnimationFrame: callback => window.requestAnimationFrame(callback), cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    ResizeObserver: class { observe() {} disconnect() {} },
  };
  Object.defineProperties(window.HTMLElement.prototype, { clientWidth: { get: () => 1000 }, clientHeight: { get: () => 600 } });
  const Frame = load("components/deck/SharedDeckFrame.tsx", {
    "next/image": { default: () => null, __esModule: true },
    "@/components/DeckSideAmbient": { default: () => null, __esModule: true },
    "@/components/WorkshopLaunchButton": { default: () => null, __esModule: true },
    "@/lib/deckLocation": { rememberSlide() {}, restoredSlide: () => 1 },
  }, globals).default;
  const Pdf = load("components/deck/UploadedPdfDeck.tsx", {
    "./SharedDeckFrame": { default: Frame, __esModule: true }, "./EiuTemplateFrame": { default: ({ children }) => children, __esModule: true },
    "react-pdf": { Document, Page: ({ pageNumber, width }) => React.createElement("div", { "data-page": pageNumber, "data-width": width }), pdfjs: {} },
  }, globals).default;
  const container = window.document.createElement("div"); const root = createRoot(container);
  try {
    await act(async () => { root.render(React.createElement(Pdf, { contentUrl: "/protected.pdf", slideCount: 3, courseTitle: "Course", sectionTitle: "PDF", templateImage: "" })); });
    await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
    assert.equal(mounts, 1);
    const firstSlide = container.querySelector('[data-page="1"]').parentElement;
    await act(async () => container.querySelector('[title="Next slide"]').click());
    assert.ok(container.querySelector('[data-page="2"]'));
    assert.notEqual(container.querySelector('[data-page="2"]').parentElement, firstSlide);
    const width = Number(container.querySelector('[data-page="2"]').dataset.width);
    await act(async () => container.querySelector('[title="Zoom in"]').click());
    assert.ok(Number(container.querySelector('[data-page="2"]').dataset.width) > width);
    assert.equal(mounts, 1); assert.equal(cleanups, 0);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
  assert.equal(cleanups, 1);
});

test("slow background requests do not overlap or restart on a catalog refresh, and are aborted on unmount", async () => {
  const window = new Window({ url: "http://localhost/learn" });
  for (const name of ["window", "document", "HTMLElement", "navigator"])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const intervals = new Map();
  window.setInterval = (callback, delay) => { intervals.set(delay, callback); return delay; };
  window.clearInterval = delay => intervals.delete(delay);
  const requests = [];
  let beacons = 0;
  const router = { refresh() {} };
  const Portal = load("components/LessonPortal.tsx", {
    "next/navigation": { useRouter: () => router },
    "next/dynamic": { __esModule: true, default: () => () => null },
    "next/link": { __esModule: true, default: () => null }, "next/image": { __esModule: true, default: () => null },
    "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai" },
    "@/lib/deckLocation": { rememberDeckSelection() {} }, "@/lib/slideStorage": {},
    "@/lib/supabase/browser": { getSupabaseBrowserClient: () => null },
  }, { window, document: window.document, navigator: { sendBeacon: () => { beacons++; return true; } }, clearInterval: id => window.clearInterval(id),
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })),
  }).default;
  const container = window.document.createElement("div"); const root = createRoot(container);
  const course = { id: "course", slug: "applied-agentic-ai", title: "Course", sections: [{ id: "s", sectionKey: "section1", title: "Section", canFacilitate: true }] };
  const render = () => root.render(React.createElement(Portal, { isAdmin: false, canFacilitate: true,
    initialProfile: { name: "Alice", email: "alice@test.example", section: "section1" },
    initialCourseId: "course", initialSection: "section1", courseFolders: [{ ...course }],
  }));
  try {
    await act(async () => render());
    assert.equal(requests.length, 3);
    await act(async () => {
      for (let i = 0; i < 3; i++) { intervals.get(10_000)(); intervals.get(15_000)(); intervals.get(30_000)(); }
      render();
    });
    assert.equal(requests.length, 3, "pending requests and refreshed profile objects must not create more requests");
    await act(async () => requests.forEach(request => request.resolve({ ok: false })));
    await act(async () => { intervals.get(10_000)(); intervals.get(15_000)(); intervals.get(30_000)(); });
    assert.equal(requests.length, 6, "polling resumes after requests settle");
    window.dispatchEvent(new window.Event("beforeunload"));
    window.dispatchEvent(new window.Event("pagehide"));
    assert.equal(beacons, 1, "beforeunload and pagehide must not send the same leave twice");
  } finally {
    await act(async () => root.unmount());
    assert.ok(requests.every(request => request.options.signal.aborted));
    assert.equal(beacons, 1, "unmount must not send an already queued leave again");
    assert.equal(intervals.size, 0);
    await window.happyDOM.close();
  }
});

function transportFixture() {
  const calls = [];
  const { createSupabaseFetch } = load("lib/supabase/fetch.ts", {}, { Request, Response, Headers, URL, DOMException });
  const fetch = createSupabaseFetch((url, options) => new Promise((resolve, reject) => {
    calls.push({ url, options, resolve });
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  return { calls, fetch, url: "https://example.test/rest/v1/courses?select=*" };
}

test("identical in-flight catalog reads share transport, have independent response bodies, and never cache completed permissions", async () => {
  const f = transportFixture();
  const first = f.fetch(f.url), second = f.fetch(f.url);
  assert.equal(f.calls.length, 1);
  f.calls[0].resolve(Response.json({ passcode: "old" }));
  const responses = await Promise.all([first, second]);
  assert.equal((await responses[0].json()).passcode, "old");
  assert.equal((await responses[1].json()).passcode, "old");
  const next = f.fetch(f.url);
  assert.equal(f.calls.length, 2);
  f.calls[1].resolve(Response.json({ passcode: "rotated" }));
  assert.equal((await (await next).json()).passcode, "rotated");
});

test("cancelling one reader does not cancel another reader, and cancelling all readers releases upstream work", async () => {
  const f = transportFixture();
  const a = new AbortController(), b = new AbortController();
  const first = f.fetch(f.url, { signal: a.signal }), second = f.fetch(f.url, { signal: b.signal });
  const rejected = assert.rejects(first, { name: "AbortError" });
  a.abort(); await rejected;
  assert.equal(f.calls[0].options.signal.aborted, false);
  f.calls[0].resolve(Response.json({ success: true }));
  assert.equal((await (await second).json()).success, true);
  const c = new AbortController(), d = new AbortController();
  const third = f.fetch(f.url, { signal: c.signal }), fourth = f.fetch(f.url, { signal: d.signal });
  const cancelled = [assert.rejects(third, { name: "AbortError" }), assert.rejects(fourth, { name: "AbortError" })];
  c.abort(); d.abort(); await Promise.all(cancelled);
  assert.equal(f.calls[1].options.signal.aborted, true);
});

test("transport never shares different credentials or learner-specific reads, and writes invalidate pending reads", async () => {
  const f = transportFixture();
  const jobs = [f.fetch(f.url, { headers: { Authorization: "A" } }), f.fetch(f.url, { headers: { Authorization: "B" } }),
    f.fetch("https://example.test/rest/v1/access_audit_logs"), f.fetch("https://example.test/rest/v1/access_audit_logs")];
  assert.equal(f.calls.length, 4);
  jobs.push(f.fetch(f.url, { method: "PATCH", headers: { Authorization: "A" }, body: "{}" }));
  jobs.push(f.fetch(f.url, { headers: { Authorization: "A" } }));
  assert.equal(f.calls.length, 6);
  f.calls.forEach(call => call.resolve(Response.json({ success: true })));
  await Promise.all(jobs);
  const fresh = f.fetch(f.url, { headers: { Authorization: "A" } });
  assert.equal(f.calls.length, 7);
  f.calls[6].resolve(Response.json({ success: true })); await fresh;
});

test("Realtime bursts queue one follow-up and disposal cancels the pending refresh", async () => {
  const { createRefreshRunner } = load("lib/liveRefresh.ts", {});
  const calls = [];
  const runner = createRefreshRunner(signal => new Promise(resolve => calls.push({ signal, resolve })));
  const active = runner.refresh();
  for (let i = 0; i < 20; i++) runner.refresh();
  assert.equal(calls.length, 1);
  calls[0].resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2);
  runner.refresh(); runner.dispose();
  assert.equal(calls[1].signal.aborted, true);
  calls[1].resolve(); await active;
  await runner.refresh(); assert.equal(calls.length, 2);
});

test("combined quiz read checks access once and keeps progress scoped to the authenticated learner and section", async () => {
  let reads = 0, progresses = 0;
  let role = "section1", teaching = false;
  const access = { isActive: true };
  const route = load("app/api/quiz-control/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": { currentUserAccess: async () => { reads++; return access; } },
    "@/lib/currentRole": { currentRole: async resolved => { assert.equal(resolved, access); return role; }, canFacilitateSection: async (_, resolved) => { assert.equal(resolved, access); return teaching; } },
    "@/lib/currentLearnerProfile": { currentLearnerProfile: async resolved => { assert.equal(resolved, access); return { section: role, identity: { sessionId: "authenticated" } }; } },
    "@/lib/quizProgress": { readQuizProgress: async (identity, section) => { progresses++; assert.equal(identity.sessionId, "authenticated"); assert.equal(section, "section1"); return { score: 8, feedbackSubmitted: true }; } },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { quiz_open: false } }), order: async () => ({ data: [] }) }) }) },
  }, { URL });
  const result = await route.GET(new Request("http://localhost/api/quiz-control?section=section1&includeProgress=1"));
  assert.equal(result.status, 200); assert.equal(reads, 1); assert.equal(progresses, 1);
  assert.equal(result.data.result.score, 8); assert.equal(result.data.isOpen, false);
  role = "section2";
  assert.equal((await route.GET(new Request("http://localhost/api/quiz-control?section=section1&includeProgress=1"))).status, 403);
  assert.equal(progresses, 1);
  teaching = true;
  assert.equal((await route.GET(new Request("http://localhost/api/quiz-control?section=section1&includeProgress=1"))).status, 200);
  assert.equal(progresses, 1, "teaching access to another section must not return that section's learner progress");
});

test("a temporary cache outage retries on the next request while a missing schema uses the existing fallback", async () => {
  for (const code of ["08006", "42P01"]) {
    let reads = 0;
    const { getCachedAiAnswer } = load("lib/ai/retrieval.ts", {
      "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, gt() { return this; }, maybeSingle: async () => {
        reads++; return reads === 1 ? { error: { code } } : { data: { answer: "Recovered", sources: [], expires_at: new Date(Date.now() + 10_000).toISOString() } };
      } }) }) },
    }, { process, Map });
    assert.equal(await getCachedAiAnswer("query"), null);
    const recovered = await getCachedAiAnswer("query");
    assert.equal(reads, code === "08006" ? 2 : 1);
    assert.equal(recovered?.answer ?? null, code === "08006" ? "Recovered" : null);
  }
});

test("chat embeddings are reused only for identical inputs within one request and failed embeddings can retry", async () => {
  let calls = 0, fail = false;
  const ai = { models: { embedContent: async ({ contents, config }) => {
    calls++; assert.equal(config.taskType, "RETRIEVAL_QUERY");
    if (fail) throw new Error("Temporary outage");
    return { embeddings: [{ values: [contents[0].length, 1] }] };
  } } };
  const { createQueryEmbeddingReader } = load("lib/ai/retrieval.ts", { "server-only": {}, "@/lib/supabase/server": {} }, { process, Map });
  const reader = createQueryEmbeddingReader(ai);
  const [a, b] = await Promise.all([reader("BHXH"), reader("BHXH")]);
  assert.equal(a, b); assert.equal(calls, 1);
  await reader("bhxh"); assert.equal(calls, 2, "normalization differences must retain their original inputs");
  await createQueryEmbeddingReader(ai)("BHXH"); assert.equal(calls, 3, "another request has its own reader");
  fail = true; await assert.rejects(reader("retry"), /Temporary/);
  fail = false; await reader("retry"); assert.equal(calls, 5);
});

test("presence counts are read-only, exclude expired/left sessions, and query only permitted teaching sections", async () => {
  let allowed = ["section1"];
  const queries = [];
  const now = Date.now();
  const rows = [{ section: "section1", lastSeen: now, leftAt: null }, { section: "section1", lastSeen: now - 36_000, leftAt: null },
    { section: "section1", lastSeen: now, leftAt: "left" }, { section: "section2", lastSeen: now, leftAt: null }];
  const route = load("app/api/presence/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": {}, "@/lib/currentLearnerProfile": {},
    "@/lib/currentRole": { teachingSections: async () => allowed },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: table => {
      assert.equal(table, "presence_sessions");
      const query = {}; queries.push(query);
      return { select(_, options) { assert.equal(options.head, true); return this; }, eq(key, value) { query[key] = value; return this; }, is(key, value) { query[key] = value; return this; }, gt(key, value) {
        query[key] = value;
        return Promise.resolve({ count: rows.filter(row => row.section === query.section && row.leftAt === query.left_at && row.lastSeen > Date.parse(value)).length });
      } };
    } }) },
  });
  const response = await route.GET();
  assert.equal(response.status, 200); assert.equal(response.data.counts.section1, 1); assert.equal(response.data.counts.section2, 0);
  assert.equal(queries.length, 1);
  allowed = [];
  assert.equal((await route.GET()).status, 403); assert.equal(queries.length, 1);
});
