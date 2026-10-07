import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const folderId = "1J0Kudr8xTczKjujXDZ3ek7Aq2pvEz1Ir";

function fixture(options = {}) {
  const state = { admin: true, write: true, connections: 0, ...options };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("app/api/admin/drive/picker/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies = {
    "next/server": { NextResponse: { json: (data, opts = {}) => ({ data, status: opts.status ?? 200, headers: opts.headers }) } },
    "@/lib/auth/currentUser": { requireAdminAccess: async () => state.admin ? {} : null },
    "@/lib/sectionSourceFiles": { SECTION_SOURCE_DESTINATIONS: { tsx: folderId } },
    "@/lib/drive/connection": {
      driveConfig: () => ({ redirectUri: "http://localhost:3000/api/admin/drive/callback", clientId: "123-client" }),
      authorizedDriveClient: async () => {
        state.connections++;
        return {
          getAccessToken: async () => ({ token: "short-lived-token" }),
          request: async () => ({ data: { name: "TSX sources", mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: state.write } } }),
        };
      },
    },
  };
  vm.runInNewContext(code, { exports, URL, process: { env: { GOOGLE_DRIVE_PICKER_API_KEY: "restricted-browser-key" } }, require: name => dependencies[name] ?? require(name) });
  return {
    state,
    post: (body, origin = "http://localhost:3000") => exports.POST({ headers: { get: () => origin }, json: async () => body }),
  };
}

test("picker refuses non-admin and cross-origin token requests", async () => {
  const denied = fixture({ admin: false });
  assert.equal((await denied.post({ action: "open", type: "tsx" })).status, 403);
  assert.equal(denied.state.connections, 0);
  const crossOrigin = fixture();
  assert.equal((await crossOrigin.post({ action: "open", type: "tsx" }, "https://other.example")).status, 403);
  assert.equal(crossOrigin.state.connections, 0);
});

test("picker returns only temporary credentials with no-store and rejects inherited source keys", async () => {
  const f = fixture();
  assert.equal((await f.post({ action: "open", type: "constructor" })).status, 400);
  const response = await f.post({ action: "open", type: "tsx" });
  assert.equal(response.status, 200);
  assert.equal(response.data.folderId, folderId);
  assert.equal(response.data.appId, "123");
  assert.match(response.headers["Cache-Control"], /no-store/);
  assert.equal(response.data.refreshToken, undefined);
});

test("folder verification requires the configured destination and actual write capability", async () => {
  const f = fixture();
  assert.equal((await f.post({ action: "verify", type: "tsx", folderId: "other-folder" })).status, 400);
  assert.equal(f.state.connections, 0);
  f.state.write = false;
  assert.equal((await f.post({ action: "verify", type: "tsx", folderId })).status, 403);
  f.state.write = true;
  const verified = await f.post({ action: "verify", type: "tsx", folderId });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.folder.available, true);
  assert.equal(verified.data.accessToken, undefined);
});
