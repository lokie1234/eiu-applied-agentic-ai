import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Buffer, URL, Uint8Array, require: name => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}
function fixture() {
  const section = { id: "section", course_id: "course", title: "Section 1", source_filename: "lesson.tsx", content_path: "course/section/compiled.js", original_content_path: "course/section/original.tsx" };
  const state = { section, downloads: [], uploads: [], requests: [], original: "export default [<h1>Original TSX</h1>];" };
  const catalog = { folderGroups: [{ id: "group", name: "MIS 301" }], courses: [{ id: "course", title: "MIS 301", folderGroupId: "group" }], sections: [section] };
  state.catalog = catalog;
  const db = { from: table => { const query = { select() { return this; }, eq() { return this; }, in() { return this; }, maybeSingle: async () => ({ data: section, error: null }), then: resolve => Promise.resolve({ data: table === "course_sections" ? [section] : [], error: null }).then(resolve) }; return query; }, storage: { from: () => ({ download: async p => { state.downloads.push(p); return { data: new Blob([state.original]), error: null }; } }) } };
  const api = load("lib/drive/export.ts", { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async () => catalog }, "@/lib/sectionSourceFiles": load("lib/sectionSourceFiles.ts", {}), "./destinations": { driveFolderId: id => id }, "./sourceUpload": { saveDriveOriginal: async (_client, input) => { state.uploads.push(input); return "uploaded"; } } });
  const client = { request: async input => { state.requests.push(input); return { data: input.method === "POST" ? { id: "web-folder" } : { files: state.existingFolder ? [{ id: "web-folder", name: "Old name" }] : [] } }; } };
  return { state, api, client };
}
test("web folder exports preserve the web name and reuse the existing folder", async () => {
  const f = fixture();
  assert.equal(await f.api.webFolder(f.client, "parent", "group"), "web-folder");
  assert.equal(f.state.requests.at(-1).data.name, "MIS 301");
  assert.deepEqual(Array.from(f.state.requests.at(-1).data.parents), ["parent"]);
  f.state.existingFolder = true; f.state.requests = [];
  await f.api.webFolder(f.client, "parent", "group");
  assert.equal(f.state.requests.filter(item => item.method === "POST").length, 0);
  assert.equal(f.state.requests.at(-1).data.name, "MIS 301");
});
test("existing TSX exports use exact original bytes and custom safe names", async () => {
  const f = fixture();
  await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent", name: "Custom slides" });
  assert.deepEqual(f.state.downloads, ["course/section/original.tsx"]);
  assert.equal(Buffer.from(f.state.uploads[0].body).toString(), f.state.original);
  assert.equal(f.state.uploads[0].name, "Custom slides.tsx");
  assert.equal(f.state.uploads[0].folderId, "parent");
  f.state.section.original_content_path = null;
  await assert.rejects(f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent" }), /Original TSX unavailable/);
  assert.equal(f.state.uploads.length, 1);
  const plan = await f.api.exportPlan("group");
  assert.match(plan[0].unavailable, /Original TSX/);
});
test("PDF and PPTX export stored bytes without regeneration", async () => {
  for (const type of ["pdf", "pptx"]) {
    const f = fixture(); f.state.section.source_filename = "lesson." + type; f.state.section.content_path = "course/section/original." + type; f.state.original = "exact-original-bytes";
    await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent" });
    assert.equal(Buffer.from(f.state.uploads[0].body).toString(), f.state.original);
    assert.equal(f.state.uploads[0].name, "lesson." + type);
  }
});
test("export API rejects learners, teachers and cross-origin callers before Drive access", async () => {
  let admin = false; let calls = 0;
  const route = load("app/api/admin/drive/export/route.ts", { "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } }, "@/lib/auth/currentUser": { requireAdminAccess: async () => admin }, "@/lib/drive/connection": { driveConfig: () => ({ redirectUri: "https://example.com/api/admin/drive/callback" }), authorizedDriveClient: async () => { calls++; } }, "@/lib/drive/destinations": {}, "@/lib/drive/export": {} });
  const request = origin => ({ headers: new Headers({ origin }), json: async () => ({}) });
  assert.equal((await route.POST(request("https://example.com"))).status, 403);
  admin = true;
  assert.equal((await route.POST(request("https://other.com"))).status, 403);
  assert.equal(calls, 0);
});

test("course exports create a folder named after the selected course", async () => {
  const f = fixture(); f.state.catalog.courses[0].title = "Selected course";
  await f.api.webFolder(f.client, "parent", undefined, "course");
  assert.equal(f.state.requests.at(-1).data.name, "Selected course");
  assert.equal((await f.api.exportPlan(undefined, undefined, "course")).length, 1);
  await assert.rejects(f.api.exportPlan(undefined, undefined, "missing"), /Course not found/);
});
