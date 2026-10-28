import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { generateKeyPairSync, verify } from "node:crypto";
const require = createRequire(import.meta.url);
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
function fixture() {
  const exports = {}, env = { REALTIME_PROVIDER: "convex", CONVEX_JWT_PRIVATE_KEY: keys.privateKey.export({ type: "pkcs8", format: "pem" }), CONVEX_SITE_URL: "https://example.convex.site", REALTIME_BRIDGE_SECRET: "test-bridge" };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/realtime/server.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Buffer, Date, process: { env }, require: name => name === "server-only" || name === "@/lib/supabase/server" ? {} : require(name) });
  return exports;
}
test("Convex token is short-lived, excludes secrets and hidden sections and preserves teaching scope", () => {
  const f = fixture(), now = Date.now();
  const token = f.mintRealtimeToken({ authUserId: "learner-session", isAdmin: false, courses: [{ id: "course", hidden: false }], sections: [{ id: "allowed", courseId: "course", canFacilitate: true }, { id: "hidden", courseId: "course", hidden: true }], email: "private@example.test" }, now);
  const [header, body, signature] = token.split(".");
  assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${body}`), keys.publicKey, Buffer.from(signature, "base64url")), true);
  const claims = JSON.parse(Buffer.from(body, "base64url"));
  assert.equal(claims.exp - claims.iat, 120); assert.equal(claims.aud, "eiu-interactive");
  assert.equal(claims.sections, '["allowed"]'); assert.equal(claims.teaching, '["allowed"]');
  assert.equal(claims.email, undefined); assert.equal(claims.password, undefined);
});
test("reconciliation accepts only the server bridge credential", () => {
  const f = fixture();
  assert.equal(f.bridgeAuthorized(new Request("https://example.test")), false);
  assert.equal(f.bridgeAuthorized(new Request("https://example.test", { headers: { Authorization: "Bearer test-bridge-extra" } })), false);
  assert.equal(f.bridgeAuthorized(new Request("https://example.test", { headers: { Authorization: "Bearer test-bridge" } })), true);
});
