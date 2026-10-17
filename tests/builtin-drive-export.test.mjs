import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Buffer, Uint8Array, URL, process, require: name => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}

test("both built-in JS decks validate independently and embed all image and font assets", () => {
  const { validateInteractiveJs } = load("lib/sectionContent.ts", {});
  for (const [section, count] of [[1, 38], [2, 37]]) {
    const source = fs.readFileSync(`lib/drive/builtin-decks/section${section}.js`, "utf8");
    const slides = JSON.parse(source.match(/const slides = ([\s\S]*?);\r?\nfunction render/)[1]);
    assert.equal(slides.length, count);
    validateInteractiveJs(source);
    const inspect = node => {
      if (typeof node === "string") return;
      if (node.tag === "img") assert.match(node.props.src, /^data:/);
      node.children.forEach(inspect);
    };
    slides.forEach(inspect);
    const css = JSON.parse(source.match(/^const css = (.*);$/m)[1]);
    assert.ok(!/url\(["']?(?:https?:|\/)/.test(css), "CSS assets must be embedded for the sandbox");
    if (section === 2) { assert.match(source, /17\/11\/2026/); assert.match(source, /Skills/); }
  }
});

test("saving built-in slides checks the course, exports compiled JS and leaves the web lesson intact", async () => {
  let course = { slug: "applied-agentic-ai", title: "Agentic AI" };
  const section = { id: "s1", course_id: "c1", section_key: "section1", title: "From Prompt to Web App", position: 1 };
  const uploads = [];
  const api = load("lib/drive/builtinExport.ts", {
    "server-only": {},
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: table => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: table === "courses" ? course : section }) }) }) },
    "@/lib/sectionSourceFiles": load("lib/sectionSourceFiles.ts", {}),
    "@/lib/sectionContent": load("lib/sectionContent.ts", {}),
    "./sourceUpload": { saveDriveOriginal: async (_client, input) => { uploads.push(input); return "file123"; } },
  });
  assert.equal(await api.saveBuiltinSection({}, { sectionId: "s1", folderId: "destination123" }), "file123");
  assert.equal(uploads[0].folderId, "destination123");
  assert.equal(uploads[0].name, "Section 1 — From Prompt to Web App.js");
  const { compileTsx } = load("lib/sectionContent.ts", {});
  assert.equal(Buffer.from(uploads[0].body).toString(), fs.readFileSync("lib/drive/builtin-decks/section1.js", "utf8"));
  section.position = 3; section.title = "Tên mới trên web";
  await api.saveBuiltinSection({}, { sectionId: "s1", folderId: "destination123" });
  assert.equal(uploads[1].name, "Section 3 — Tên mới trên web.js");
  course = { slug: "other-course", title: "Other course" };
  await assert.rejects(api.saveBuiltinSection({}, { sectionId: "s1", folderId: "destination123" }), /Built-in course not found/);
  assert.equal(uploads.length, 2);
});

test("the built-in save endpoint uses the verified destination and returns its Drive file", async () => {
  const saves = [];
  const route = load("app/api/admin/drive/export/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": { requireAdminAccess: async () => ({ email: "admin@example.test" }) },
    "@/lib/drive/connection": { driveConfig: () => ({ redirectUri: "https://example.test/api/admin/drive/callback" }), authorizedDriveClient: async () => ({}) },
    "@/lib/drive/destinations": { selectedDestination: async id => { assert.equal(id, "d1"); return { folder_id: "folder123" }; }, verifyDriveFolder: async (_client, folder) => assert.equal(folder, "folder123") },
    "@/lib/drive/export": {},
    "@/lib/drive/builtinExport": { saveBuiltinSection: async (_client, input) => { saves.push(input); return "file123"; } },
  });
  const result = await route.POST({ headers: new Headers({ origin: "https://example.test" }), json: async () => ({ action: "save_builtin", destinationId: "d1", sectionId: "s1" }) });
  assert.equal(result.status, 200);
  assert.equal(result.data.fileId, "file123");
  assert.equal(saves[0].sectionId, "s1");
  assert.equal(saves[0].folderId, "folder123");
});

test("saving an unchanged deck again refreshes the Drive filename after a web rename", async () => {
  const requests = [];
  const api = load("lib/drive/sourceUpload.ts", { "server-only": {} });
  const input = { sourceId: "01234567-89ab-cdef-0123-456789abcdef", sectionId: "s1", folderId: "folder123", name: "Section 2 — Tên mới.tsx", mimeType: "text/plain", sha256: "same-content", body: new Uint8Array([1]) };
  const client = { request: async request => {
    requests.push(request);
    return { data: { files: [{ id: "file123", name: "Old title.tsx", appProperties: { eiuSha256: input.sha256, eiuSectionId: input.sectionId } }] } };
  } };
  assert.equal(await api.saveDriveOriginal(client, input), "file123");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].method, "PATCH");
  assert.equal(requests[1].data.name, input.name);
  assert.ok(!requests.some(request => request.method === "POST"), "rename reuses the existing file");
});
