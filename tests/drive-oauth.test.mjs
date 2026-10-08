import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import ts from "typescript";
const require = createRequire(import.meta.url);

function fixture(overrides = {}) {
  const state = { exchanges: 0, saves: [], admin: true, identity: "son.lam@eiu.edu.vn", sessions: [], ...overrides };
  const sessionHash = createHash("sha256").update("admin-session").digest("hex");
  const values = new Map([
    ["session", "admin-session"],
    ["oauth", JSON.stringify({ state: "expected-state", verifier: "pkce-verifier", sessionHash, mode: state.mode })],
  ]);
  const code = ts.transpileModule(fs.readFileSync("app/api/admin/drive/callback/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options) => ({ data, status: options.status }), redirect: url => ({ url: url.toString() }) } },
    "next/headers": { cookies: async () => ({ get: key => values.has(key) ? { value: values.get(key) } : undefined, delete: ({ name }) => values.delete(name), set: (key, value) => { values.set(key, value); state.sessions.push(value); } }) },
    "@/lib/auth/currentUser": { requireAdminAccess: async () => state.admin ? {} : null },
    "@/lib/auth/session": { ACCESS_SESSION_COOKIE: "session", createAccessSession: payload => JSON.stringify(payload), sessionCookieOptions: () => ({}) },
    "@/lib/auth/adminPassword": { getAdminCredential: async () => ({ session_version: 7 }) },
    "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "son.lam@eiu.edu.vn" },
    "@/lib/drive/connection": {
      DRIVE_STATE_COOKIE: "oauth", driveConfig: () => ({ redirectUri: "http://localhost:3000/api/admin/drive/callback", accountEmail: "son.lam@eiu.edu.vn", clientId: "client" }),
      driveClient: () => ({
        getToken: async options => { state.exchanges++; assert.equal(options.codeVerifier, "pkce-verifier"); return { tokens: { id_token: "identity", refresh_token: "private-token", scope: state.scope ?? "https://www.googleapis.com/auth/drive.file" } }; },
        verifyIdToken: async () => ({ getPayload: () => ({ email: state.identity, email_verified: state.verified ?? true }) }),
      }),
      saveDriveToken: async (...args) => state.saves.push(args),
    },
  };
  vm.runInNewContext(code, { exports, URL, Buffer, require: name => dependencies[name] ?? require(name) });
  return { state, values, get: (query = "state=expected-state&code=code") => exports.GET({ url: `http://localhost:3000/api/admin/drive/callback?${query}` }) };
}

test("OAuth callback requires admin and never exchanges tokens for invalid state", async () => {
  const denied = fixture({ admin: false });
  assert.equal((await denied.get()).status, 403);
  assert.equal(denied.state.exchanges, 0);
  const invalid = fixture();
  assert.match((await invalid.get("state=wrong&code=code")).url, /result=failed/);
  assert.equal(invalid.state.exchanges, 0);
});

test("OAuth state is single-use and bound to the initiating admin session", async () => {
  const f = fixture();
  f.values.set("session", "different-session");
  await f.get();
  assert.equal(f.state.exchanges, 0);
  assert.equal(f.values.has("oauth"), false);
  const success = fixture();
  await success.get(); await success.get();
  assert.equal(success.state.exchanges, 1);
});

test("only verified configured account with Drive scope can replace saved credentials", async () => {
  const wrong = fixture({ identity: "other@example.com" });
  assert.match((await wrong.get()).url, /result=wrong-account/);
  assert.equal(wrong.state.saves.length, 0);
  const missing = fixture({ scope: "openid email" });
  assert.match((await missing.get()).url, /result=missing-scope/);
  assert.equal(missing.state.saves.length, 0);
  const success = fixture();
  const response = await success.get();
  assert.match(response.url, /result=connected/);
  assert.ok(!response.url.includes("private-token"));
  assert.equal(success.state.saves.length, 1);
});

test("Google landing login creates only an admin session and shares Drive authorization", async () => {
  const success = fixture({ admin: false, mode: "login" });
  const response = await success.get();
  assert.match(response.url, /admin\/access/);
  assert.equal(success.state.saves.length, 1);
  assert.equal(JSON.parse(success.values.get("session")).role, "admin");
  assert.equal(JSON.parse(success.values.get("session")).sessionVersion, 7);
  for (const options of [{ identity: "teacher@example.com" }, { verified: false }]) {
    const denied = fixture({ admin: false, mode: "login", ...options });
    assert.match((await denied.get()).url, /result=wrong-account/);
    assert.equal(denied.state.saves.length, 0);
    assert.equal(denied.state.sessions.length, 0);
  }
});
