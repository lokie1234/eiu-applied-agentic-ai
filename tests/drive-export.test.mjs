import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const catalogStorage = { getCoursesAndSectionsData: async () => ({ courses: [], sections: [], folderGroups: [] }) };
function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Buffer, URL, Uint8Array, process, TextDecoder, require: name => name === "@/lib/auth/courseAccessStorage" && !(name in dependencies) ? catalogStorage : name in dependencies ? dependencies[name] : (name === "./sectionLimits" ? load("lib/sectionLimits.ts", {}) : require(name)) });
  return exports;
}
function fixture() {
  const section = { id: "section", course_id: "course", title: "Section 1", position: 1, source_filename: "lesson.tsx", content_path: "course/section/compiled.js", original_content_path: "course/section/original.tsx" };
  const state = { section, downloads: [], uploads: [], requests: [], original: "export default [<h1>Original TSX</h1>];" };
  const catalog = { folderGroups: [{ id: "group", name: "MIS 301" }], courses: [{ id: "course", title: "MIS 301", folderGroupId: "group" }], sections: [section] };
  state.catalog = catalog;
  const db = { from: table => { let updating; const query = { update(value) { updating = value; return this; }, is() { return this; }, select() { return this; }, eq() { return this; }, in() { return this; }, maybeSingle: async () => { if(updating) { state.published = updating; return { data: state.conflict ? null : section, error: null }; } return { data: section, error: null }; }, then: resolve => Promise.resolve({ data: table === "course_sections" ? [section] : [], error: null }).then(resolve) }; return query; }, storage: { from: () => ({ download: async p => { state.downloads.push(p); return { data: new Blob([state.original]), error: null }; } }) } };
  const api = load("lib/drive/export.ts", { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async () => catalog }, "@/lib/sectionSourceFiles": load("lib/sectionSourceFiles.ts", {}), "./destinations": { driveFolderId: id => id }, "./localOriginal": load("lib/drive/localOriginal.ts", { "server-only": {} }), "./sectionContent": { readDriveFile: async () => ({ bytes: state.corrupt ? new Uint8Array([0]) : state.uploads.at(-1).body }) }, "@/lib/localSectionContent": load("lib/localSectionContent.ts", { "server-only": {}, "@/course-content/sources.json": JSON.parse(fs.readFileSync("course-content/sources.json", "utf8")) }), "@/lib/sectionContent": load("lib/sectionContent.ts", {}), "./sourceUpload": { saveDriveOriginal: async (_client, input) => { state.uploads.push(input); return "uploaded-file-123"; } } });
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

test("concurrent exports create a shared folder once and later operations still check Drive", async () => {
  const f = fixture();
  const results = await Promise.all([
    f.api.webFolder(f.client, "parent", "group", undefined, f.state.catalog),
    f.api.webFolder(f.client, "parent", "group", undefined, f.state.catalog),
  ]);
  assert.deepEqual(results, ["web-folder", "web-folder"]);
  assert.equal(f.state.requests.length, 2, "one lookup and one creation instead of two of each");
  await f.api.webFolder(f.client, "parent", "group", undefined, f.state.catalog);
  assert.equal(f.state.requests.length, 4, "a completed write must not cache folder permissions");
});

test("failed folder operations are released so retry can recover", async () => {
  const f = fixture();
  const request = f.client.request;
  f.client.request = async () => { throw new Error("Temporary Drive error"); };
  await assert.rejects(f.api.webFolder(f.client, "parent", "group"), /Temporary/);
  f.client.request = request;
  assert.equal(await f.api.webFolder(f.client, "parent", "group"), "web-folder");
});
test("legacy TSX exports compiled JS with custom safe names", async () => {
  const f = fixture();
  await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent", name: "Custom slides" });
  assert.deepEqual(f.state.downloads, ["course/section/original.tsx"]);
  const { compileTsx } = load("lib/sectionContent.ts", {});
  assert.equal(Buffer.from(f.state.uploads[0].body).toString(), compileTsx(f.state.original));
  assert.equal(f.state.uploads[0].name, "Custom slides.js");
  assert.equal(f.state.uploads[0].folderId, "parent");
  f.state.section.original_content_path = null;
  f.state.original = "exports.default = [h('h1', {}, 'Compiled slide')];";
  await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent", name: "Runtime.tsx" });
  assert.equal(f.state.uploads.length, 2);
  assert.equal(f.state.uploads[1].name, "Runtime.js");
  assert.equal(Buffer.from(f.state.uploads[1].body).toString(), f.state.original);
  assert.equal(f.state.downloads[1], "course/section/compiled.js");
  assert.equal(f.state.section.original_content_path, null);
  const plan = await f.api.exportPlan("group");
  assert.equal(plan[0].unavailable, undefined);
  assert.match(plan[0].name, /\.js$/);
  f.state.section.content_path = "course/section/unknown.bin";
  f.state.original = "broken code";
  await assert.rejects(f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent" }));
});
test("PDF and PPTX export stored bytes without regeneration", async () => {
  for (const type of ["pdf", "pptx"]) {
    const f = fixture(); f.state.section.source_filename = "lesson." + type; f.state.section.content_path = "course/section/original." + type; f.state.original = "exact-original-bytes";
    await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent" });
    assert.equal(Buffer.from(f.state.uploads[0].body).toString(), f.state.original);
    assert.equal(f.state.uploads[0].name, "Section 1 \u2014 Section 1." + type);
  }
});
test("export API rejects learners, teachers and cross-origin callers before Drive access", async () => {
  let admin = false; let calls = 0;
  const route = load("app/api/admin/drive/export/route.ts", { "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } }, "@/lib/auth/currentUser": { requireAdminAccess: async () => admin }, "@/lib/drive/connection": { driveConfig: () => ({ redirectUri: "https://example.com/api/admin/drive/callback" }), authorizedDriveClient: async () => { calls++; } }, "@/lib/drive/destinations": {}, "@/lib/drive/export": {}, "@/lib/drive/builtinExport": {} });
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

test("Pandas exports recover the exact bundled TSX and publish a Drive source", async () => {
  const f = fixture();
  Object.assign(f.state.section, {
    id: "71c4d32e-7d80-4ae6-9576-13a0840ccd45", course_id: "5e9700b6-d498-4ce7-b7b5-3cabca3fe8d5",
    content_path: "5e9700b6-d498-4ce7-b7b5-3cabca3fe8d5/71c4d32e-7d80-4ae6-9576-13a0840ccd45/PandasPracticePart2.js",
    original_content_path: null, source_filename: "PandasPracticePart2.tsx",
  });
  f.state.catalog.courses[0].id = f.state.section.course_id;
  const plan = await f.api.exportPlan("group");
  assert.equal(plan[0].unavailable, undefined);
  await f.api.exportDocument(f.client, { sectionId: f.state.section.id, folderId: "target" });
  const { compileTsx } = load("lib/sectionContent.ts", {});
  assert.equal(Buffer.from(f.state.uploads[0].body).toString(), fs.readFileSync("course-content/mis301/PandasPracticePart2.js", "utf8"));
  assert.equal(f.state.downloads.length, 0);
  assert.equal(f.state.published.content_path, "drive:uploaded-file-123");
  assert.equal(f.state.published.original_content_path, null);
  assert.equal(f.state.section.original_content_path, null);
  f.state.section.content_path = "course/section/other.bin";
  await assert.rejects(f.api.exportDocument(f.client, { sectionId: f.state.section.id, folderId: "target" }), /Invalid stored document path/);
});

test("verified legacy export switches subsequent exports to Drive without another Storage read", async () => {
  const f = fixture();
  await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent" });
  assert.equal(f.state.published.content_path, "drive:uploaded-file-123");
  Object.assign(f.state.section, f.state.published);
  await f.api.exportDocument(f.client, { sectionId: "section", folderId: "another-target" });
  assert.equal(f.state.downloads.length, 1);
  assert.equal(f.state.uploads.length, 2);
  assert.equal(Buffer.from(f.state.uploads[1].body).toString(), Buffer.from(f.state.uploads[0].body).toString());
});

test("Drive verification failure or concurrent edits cannot replace the live source", async () => {
  const corrupted = fixture(); corrupted.state.corrupt = true;
  await assert.rejects(corrupted.api.exportDocument(corrupted.client, { sectionId: "section", folderId: "parent" }), /verification failed/);
  assert.equal(corrupted.state.published, undefined);
  const conflict = fixture(); conflict.state.conflict = true;
  await assert.rejects(conflict.api.exportDocument(conflict.client, { sectionId: "section", folderId: "parent" }), /section changed/);
  assert.equal(conflict.state.section.content_path, "course/section/compiled.js");
});

test("legacy runtime JavaScript exports and publishes as JS rather than pretending to be TSX", async () => {
  const f = fixture(); f.state.section.original_content_path = null;
  f.state.original = "module.exports.default=[h('h1',{},'Legacy content')];";
  await f.api.exportDocument(f.client, { sectionId: "section", folderId: "parent" });
  assert.match(f.state.published.source_filename, /\.js$/);
  assert.equal(f.state.published.original_content_path, null);
  Object.assign(f.state.section, f.state.published);
  assert.match((await f.api.exportPlan("group"))[0].name, /\.js$/);
});

test("folder plans include built-in snapshots and stored attachments", async () => {
  const f = fixture();
  f.state.catalog.courses[0].slug = "applied-agentic-ai";
  f.state.section.section_key = "section1";
  const plan = await f.api.exportPlan("group");
  assert.equal(plan.length, 2);
  assert.equal(plan[0].builtin, true);
  assert.equal(plan[0].courseId, "course");
  assert.equal(plan[1].builtin, undefined);
});

test("folder exports nest course folders and validate built-in membership before saving", async () => {
  const folders = []; const saves = [];
  const catalog = { courses: [], sections: [], folderGroups: [] };
  let catalogReads = 0;
  const route = load("app/api/admin/drive/export/route.ts", {
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": { requireAdminAccess: async () => true },
    "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async () => { catalogReads++; return catalog; } },
    "@/lib/drive/connection": { driveConfig: () => ({ redirectUri: "https://example.com/api/admin/drive/callback" }), authorizedDriveClient: async () => ({}) },
    "@/lib/drive/destinations": { selectedDestination: async () => ({ folder_id: "target" }), verifyDriveFolder: async () => {} },
    "@/lib/drive/export": {
      exportPlan: async (_group, _section, _course, received) => { assert.equal(received, catalog); return [{ sectionId: "builtin", courseId: "course", builtin: true }, { sectionId: "pdf", courseId: "course" }]; },
      webFolder: async (_client, parent, groupId, courseId, received) => { assert.equal(received, catalog); folders.push({ parent, groupId, courseId }); return groupId ? "group-folder" : "course-folder"; },
      exportDocument: async (_client, input, received) => { assert.equal(received, catalog); saves.push(input); return "pdf-copy"; },
    },
    "@/lib/drive/builtinExport": { saveBuiltinSection: async (_client, input) => { saves.push(input); return "builtin-copy"; } },
  });
  const request = (sectionId, action) => ({ headers: new Headers({ origin: "https://example.com" }), json: async () => ({ destinationId: "destination", groupId: "group", sectionId, action }) });
  assert.equal((await route.POST(request("builtin", "save_builtin"))).status, 200);
  assert.equal(catalogReads, 1, "membership and both folder operations share one fresh catalog");
  assert.equal(folders[0].parent, "target");
  assert.equal(folders[0].groupId, "group");
  assert.equal(folders[1].parent, "group-folder");
  assert.equal(folders[1].courseId, "course");
  assert.equal(saves[0].folderId, "course-folder");
  assert.equal((await route.POST(request("pdf", "save"))).status, 200);
  assert.equal((await route.POST(request("outside", "save_builtin"))).status, 400);
  assert.equal((await route.POST(request("builtin", "save"))).status, 400);
  assert.equal(saves.length, 2);
  assert.equal(catalogReads, 4, "each new request must read fresh catalog data");
});

for (const filename of ["Section1.js", "Section2.js"]) {
 test("project " + filename + " exports current slide bytes without changing its source", async () => {
  const f = fixture(); f.state.catalog.courses[0] = { id: "a857595d-def0-4543-9216-a680c6abfe26", title: "Renamed course", folderGroupId: "group" };
  Object.assign(f.state.section, { id: filename === "Section1.js" ? "47c1183e-a26e-4c5d-9937-88ec5a755a32" : "2faaf285-a215-4874-a367-82c84ce46b2e", course_id: "a857595d-def0-4543-9216-a680c6abfe26", content_type: "tsx", source_filename: "Renamed source.tsx", content_path: "drive:stale-copy-123", original_content_path: null });
  const plan = await f.api.exportPlan("group"); assert.equal(plan[0].unavailable, undefined); assert.match(plan[0].note, /Self-contained JavaScript/);
  for (const target of ["first-target", "second-target"]) await f.api.exportDocument(f.client, { sectionId: f.state.section.id, folderId: target, name: "Renamed backup" });
  const original = fs.readFileSync("course-content/web-app-development/" + filename, "utf8");
  assert.equal(f.state.uploads.length, 2); for (const upload of f.state.uploads) { assert.equal(Buffer.from(upload.body).toString(), original); assert.equal(upload.name, "Renamed backup.js"); }
  assert.equal(f.state.downloads.length, 0); assert.equal(f.state.requests.length, 0); assert.equal(f.state.published, undefined);
  assert.equal(f.state.section.source_filename, "Renamed source.tsx"); assert.equal(f.state.section.content_path, "drive:stale-copy-123");
  f.state.corrupt = true; await assert.rejects(f.api.exportDocument(f.client, { sectionId: "section", folderId: "target" }), /verification failed/);
  assert.equal(f.state.published, undefined);
 });
}
