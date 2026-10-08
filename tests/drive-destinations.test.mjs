import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/drive/destinations.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, require: name => name === "server-only" ? {} : name === "./connection" ? { driveConfig: () => ({ accountEmail: "admin@example.com" }) } : {} });
test("Drive destinations accept folder links and IDs, rejecting other hosts and paths", () => {
  assert.equal(exports.driveFolderId("https://drive.google.com/drive/folders/abcDEF_123456?usp=sharing"), "abcDEF_123456");
  assert.equal(exports.driveFolderId("abcDEF_123456"), "abcDEF_123456");
  for (const value of ["https://example.com/drive/folders/abcDEF_123456", "https://drive.google.com/file/d/abcDEF_123456", "bad'folder", "../unsafe"]) assert.throws(() => exports.driveFolderId(value));
});
test("only non-trashed writable folders can become export destinations", async () => {
  const client = value => ({ request: async () => ({ data: value }) });
  assert.equal(await exports.verifyDriveFolder(client({ name: "Archive", mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: true } }), "abcDEF_123456"), "Archive");
  for (const value of [{ mimeType: "application/pdf", capabilities: { canAddChildren: true } }, { mimeType: "application/vnd.google-apps.folder", trashed: true, capabilities: { canAddChildren: true } }, { mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: false } }]) await assert.rejects(exports.verifyDriveFolder(client(value), "abcDEF_123456"));
});
