import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { exports, Buffer, File, Date, require: name => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}

function fixture(options = {}) {
  const state = { allowed: true, missingTable: false, uploadFailure: false, originals: [], writes: [], ...options };
  const db = { from: table => {
    assert.equal(table, "section_source_files", "source uploads must not change active course_sections content");
    return {
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: null, error: state.missingTable ? { code: "PGRST205" } : null }),
      insert: async value => { state.writes.push(value); return { error: null }; },
      update: value => { state.writes.push(value); return { eq: async () => ({ error: null }) }; },
    };
  } };
  const naming = load("lib/sectionSourceFiles.ts", {});
  const route = load("app/api/admin/sections/[id]/sources/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": { canManageSection: async () => state.allowed },
    "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async () => ({ sections: [{ id: "section", course_id: "course", title: "Section 1" }], courses: [{ id: "course", title: "Course", folderGroupId: "folder" }], folderGroups: [{ id: "folder", name: "Folder" }] }) },
    "@/lib/supabase/server": { getSupabaseAdmin: () => db },
    "@/lib/drive/connection": { authorizedDriveClient: async () => ({}) },
    "@/lib/drive/sourceUpload": { saveDriveOriginal: async (_client, input) => { state.originals.push(input); if (state.uploadFailure) throw new Error("Provider failure"); return "drive-id"; } },
    "@/lib/sectionSourceFiles": naming,
  });
  return { state, post: (name, bytes) => route.POST({ formData: async () => new Map([
    ["file", new File([bytes], name)], ["sourceId", "12345678-1234-4123-8123-123456789abc"],
  ]) }, { params: Promise.resolve({ id: "section" }) }) };
}

test("source upload cannot write to Drive without section permission or source catalog", async () => {
  const denied = fixture({ allowed: false });
  assert.equal((await denied.post("lesson.pdf", "%PDF-1.7")).status, 403);
  assert.equal(denied.state.originals.length, 0);
  const missing = fixture({ missingTable: true });
  const result = await missing.post("lesson.pdf", "%PDF-1.7");
  assert.equal(result.status, 503);
  assert.match(result.data.message, /migration/);
  assert.equal(missing.state.originals.length, 0);
});

test("source library keeps exact TSX bytes and writes only catalog metadata", async () => {
  const f = fixture();
  const original = "// Nội dung gốc\nexport default [<h1>Bài học</h1>];";
  assert.equal((await f.post("Bài học.tsx", original)).status, 200);
  assert.equal(Buffer.from(f.state.originals[0].body).toString("utf8"), original);
  assert.ok(f.state.originals[0].name.endsWith(".tsx"));
  assert.equal(f.state.originals[0].folderId, "1J0Kudr8xTczKjujXDZ3ek7Aq2pvEz1Ir");
  assert.equal(f.state.writes.at(-1).status, "ready");
  assert.equal(f.state.writes.at(-1).drive_file_id, "drive-id");
});

test("invalid original formats and provider errors never report successful saving", async () => {
  const invalid = fixture();
  assert.equal((await invalid.post("lesson.pdf", "not a PDF")).status, 400);
  assert.equal((await invalid.post("lesson.pptx", "not a ZIP")).status, 400);
  assert.equal(invalid.state.originals.length, 0);
  const failed = fixture({ uploadFailure: true });
  assert.equal((await failed.post("lesson.tsx", "source")).status, 502);
  assert.equal(failed.state.writes.at(-1).status, "failed");
});
