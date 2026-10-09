import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function fixture(dependencies = {}) {
  const env = { NODE_ENV: "production", PASSCODE_SESSION_SECRET: "a".repeat(32), GOOGLE_DRIVE_CLIENT_ID: "client", GOOGLE_DRIVE_CLIENT_SECRET: "secret", GOOGLE_DRIVE_REDIRECT_URI: "https://example.com/api/admin/drive/callback", GOOGLE_DRIVE_ACCOUNT_EMAIL: "admin@example.com" };
  const state = { row: null, error: null, writes: 0, reads: 0 };
  const db = { from: name => { assert.equal(name, "google_drive_connections"); return {
    select: () => ({ eq: (_, email) => ({ maybeSingle: async () => { state.reads++; return { data: state.row?.account_email === email ? state.row : null, error: state.error }; } }) }),
    upsert: async row => { state.writes++; if (!state.error) state.row = row; return { error: state.error }; },
  }; } };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("lib/drive/connection.ts", "utf8"), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, URL, process: { env, cwd: () => "." }, require: name => {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/server") return { getSupabaseAdmin: () => db };
    if (name === "@/lib/sectionSourceFiles") return { SECTION_SOURCE_DESTINATIONS: {} };
    if (name === "node:fs/promises") return new Proxy({}, { get: () => () => { throw new Error("Production must not use filesystem"); } });
    return dependencies[name] ?? require(name);
  } });
  return { env, state, api: exports };
}
test("production credentials survive storage roundtrip encrypted and supersede env fallback", async () => {
  const f = fixture();
  assert.equal(await f.api.storedDriveToken(), null);
  await f.api.assertDriveTokenStorage();
  await f.api.saveDriveToken("admin@example.com", "new-private-refresh-token");
  assert.ok(!f.state.row.encrypted_token.includes("new-private-refresh-token"));
  f.env.GOOGLE_DRIVE_REFRESH_TOKEN = "old-token";
  assert.equal(await f.api.storedDriveToken(), "new-private-refresh-token");
  f.env.PASSCODE_SESSION_SECRET = "b".repeat(32);
  await assert.rejects(f.api.storedDriveToken());
});
test("storage errors cannot report a successful save or start OAuth", async () => {
  const f = fixture(); f.state.error = { message: "unavailable" };
  await assert.rejects(f.api.assertDriveTokenStorage(), /storage is unavailable/);
  await assert.rejects(f.api.saveDriveToken("admin@example.com", "token"), /persist/);
  await assert.rejects(f.api.storedDriveToken(), /storage is unavailable/);
  f.env.GOOGLE_DRIVE_REFRESH_TOKEN = "existing-env-token";
  assert.equal(await f.api.storedDriveToken(), "existing-env-token");
});
test("wrong account cannot replace saved credentials", async () => {
  const f = fixture();
  await assert.rejects(f.api.saveDriveToken("other@example.com", "token"), /Unexpected Drive account/);
  assert.equal(f.state.writes, 0);
});

test("Drive reuses OAuth access tokens but rechecks stored credentials and identity, replacing the client on reconnect", async () => {
  const clients = [];
  let verified = true, pendingIdentity;
  class OAuth2Client {
    constructor() { clients.push(this); this.checks = 0; }
    setCredentials(credentials) { this.credentials = credentials; }
    async request() { this.checks++; if (pendingIdentity) await pendingIdentity; return { data: { email: "admin@example.com", email_verified: verified } }; }
  }
  const f = fixture({ "google-auth-library": { OAuth2Client } });
  await f.api.saveDriveToken("admin@example.com", "first");
  let complete;
  pendingIdentity = new Promise(resolve => { complete = resolve; });
  const pair = Promise.all([f.api.authorizedDriveClient(), f.api.authorizedDriveClient()]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(clients.length, 1); assert.equal(clients[0].checks, 1); assert.equal(f.state.reads, 2);
  complete(); const [a, b] = await pair; assert.equal(a, b);
  pendingIdentity = null;
  assert.equal(await f.api.authorizedDriveClient(), a); assert.equal(a.checks, 2);
  await f.api.saveDriveToken("admin@example.com", "replacement");
  const replacement = await f.api.authorizedDriveClient();
  assert.notEqual(replacement, a); assert.equal(replacement.credentials.refresh_token, "replacement");
  verified = false;
  await assert.rejects(f.api.authorizedDriveClient(), /different Google account/);
  verified = true;
  assert.notEqual(await f.api.authorizedDriveClient(), replacement, "a failed identity check invalidates the reused client");
});
