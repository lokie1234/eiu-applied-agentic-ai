import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies, env = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), process: { env: { PASSCODE_SESSION_SECRET: "test-secret-not-a-production-credential", ...env } }, Buffer, Date, Headers, URL, console });
  return exports;
}
const limiter = (rpc = async () => ({ data: { allowed: true, retry_after: 0 } }), env = {}) => load("lib/security/rateLimit.ts", {
  "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => ({ rpc }) },
}, env);

test("browser identity is signed, expires and cannot be forged to select a victim's bucket", () => {
  const f = limiter(), now = Date.now();
  const first = f.requestIdentity(undefined, now);
  assert.equal(first.fresh, true);
  assert.equal(f.requestIdentity(first.cookie, now + 1).id, first.id);
  assert.notEqual(f.requestIdentity(first.cookie.replace(first.id, "a".repeat(36)), now).id, first.id);
  assert.notEqual(f.requestIdentity(first.cookie, now + 86400_001).id, first.id);
  assert.notEqual(f.requestIdentity(first.cookie + ".extra", now).id, first.id);
});

test("reload and login budgets stay separate from polling, prefetch, assets and heartbeats", () => {
  const { requestPolicy } = limiter();
  const html = new Headers({ accept: "text/html", "sec-fetch-dest": "document" });
  assert.equal(requestPolicy("/learn", "GET", html).limit, 5);
  assert.equal(requestPolicy("/admin/access", "GET", html).group, "navigation");
  assert.equal(requestPolicy("/learn", "GET", new Headers({ accept: "text/html", rsc: "1" })).group, "page-data");
  assert.equal(requestPolicy("/learn", "GET", new Headers({ accept: "text/html", "next-router-prefetch": "1" })).limit, 120);
  assert.equal(requestPolicy("/learn", "HEAD", html).group, "page-data");
  assert.equal(requestPolicy("/api/signout", "POST", html), null);
  assert.equal(requestPolicy("/api/admin/drive/callback", "GET", html), null);
  assert.equal(requestPolicy("/api/auth/access", "POST", html).group, requestPolicy("/api/auth/admin", "POST", html).group);
  assert.equal(requestPolicy("/api/presence", "POST", html).limit, 12);
  assert.equal(requestPolicy("/api/presence", "GET", html).limit, 240);
  assert.equal(requestPolicy("/api/arbitrary-path-one", "POST", html).group, requestPolicy("/api/arbitrary-path-two", "POST", html).group);
});

test("50 learners on one Vercel IP have independent five-request buckets and a generous network guard", () => {
  const f = limiter(undefined, { VERCEL: "1" });
  const policy = f.requestPolicy("/learn", "GET", new Headers({ accept: "text/html" }));
  const all = Array.from({ length: 50 }, () => f.rateRules(f.requestIdentity().id, policy, new Headers({ "x-forwarded-for": "203.0.113.7" })));
  assert.equal(new Set(all.map(rules => rules[0].key)).size, 50);
  assert.equal(new Set(all.map(rules => rules[1].key)).size, 1);
  assert.ok(all[0][1].limit >= 50 * 5);
  assert.equal(limiter().rateRules("browser", policy, new Headers({ "x-forwarded-for": "203.0.113.7" })).length, 1);
});

test("the shared RPC receives limits and cooldown; missing store fails closed", async () => {
  let args;
  const f = limiter(async (...value) => { args = value; return { data: { allowed: false, retry_after: 120 } }; });
  const result = await f.consumeRateLimit("one", { group: "login", limit: 5, networkLimit: 500 }, new Headers());
  assert.equal(result.allowed, false);
  assert.equal(args[0], "consume_request_limits");
  assert.equal(args[1].p_block_seconds, 120);
  assert.equal(args[1].p_window_seconds, 60);
  await assert.rejects(limiter(async () => ({ error: { message: "missing function" } })).consumeRateLimit("one", { group: "login", limit: 5 }, new Headers()), /unavailable/);
  await assert.rejects(limiter(async () => ({ data: {} })).consumeRateLimit("one", { group: "login", limit: 5 }, new Headers()), /Invalid/);
});

test("unauthorized Admin Access GET never reads the course catalog", async () => {
  let catalogReads = 0;
  const route = load("app/api/admin/access/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "next/cache": {}, "@/lib/auth/currentUser": { requireCourseManager: async () => null },
    "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async () => { catalogReads++; return {}; } },
    "@/lib/auth/passcodes": {}, "@/lib/auth/types": {}, "@/lib/supabase/server": {}, "@/lib/learningIdentity": {},
  });
  assert.equal((await route.GET()).status, 403);
  assert.equal(catalogReads, 0);
});

test("proxy returns a real 429 with retry metadata, a signed browser cookie, and a readable page", async () => {
  class FakeResponse extends Response {
    cookies = { values: [], set(...args) { this.values.push(args); } };
    static next() { return new FakeResponse(null); }
    static json(body, options) { return new FakeResponse(JSON.stringify(body), options); }
  }
  let storeCalls = 0;
  const f = limiter();
  const route = load("proxy.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/security/rateLimit": { ...f, consumeRateLimit: async () => { storeCalls++; return { allowed: false, retry_after: 120 }; } },
  });
  const request = path => ({ nextUrl: new URL(`https://eiu.test${path}`), method: "GET", headers: new Headers({ accept: "text/html" }), cookies: { get() {} } });
  const html = await route.proxy(request("/learn"));
  assert.equal(html.status, 429);
  assert.equal(html.headers.get("Retry-After"), "120");
  assert.match(html.headers.get("Cache-Control"), /no-store/);
  assert.match(await html.text(), /Vui lòng thử lại sau/);
  assert.equal(html.cookies.values[0][0], f.RATE_COOKIE);
  assert.equal(html.cookies.values[0][2].httpOnly, true);
  const api = await route.proxy(request("/api/presence"));
  assert.equal(api.status, 429);
  assert.equal((await api.json()).retryAfter, 120);
  await route.proxy(request("/api/admin/drive/callback"));
  assert.equal(storeCalls, 2, "OAuth callback must still complete while throttled");
  const unavailable = load("proxy.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/security/rateLimit": { ...f, consumeRateLimit: async () => { throw new Error("offline"); } },
  });
  assert.equal((await unavailable.proxy(request("/learn"))).status, 503);
});
