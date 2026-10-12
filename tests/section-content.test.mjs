import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import JSZip from "jszip";

const nativeRequire = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// Exercise the real handlers with the auth and storage boundaries replaced.
// No live credentials or database mutations are needed to verify fidelity.
function handlers(options = {}) {
  const state = {
    admin: true,
    section: { id: "section-id", course_id: "course-id", section_key: "custom", status: "active", content_path: null },
    access: { isActive: true, isAdmin: false, sections: [{ id: "section-id", courseId: "course-id" }], courses: [{ id: "course-id", isUnlocked: true }] },
    stored: new Map(), removed: [], afterTasks: [], supabaseUploads:0, driveUploads:0, ...options,
  };
  const storage = {
    async upload(name, bytes, metadata) {
      state.supabaseUploads++;
      state.uploadMetadata = metadata;
      state.stored.set(name, Buffer.from(bytes));
      return { error: null };
    },
    async download(name) { return { data: new Blob([state.stored.get(name)]), error: null }; },
    async remove(names) {
      state.removed.push(...names);
      names.forEach((name) => state.stored.delete(name));
      return { error: null };
    },
  };
  const supabase = {
    storage: { from: () => storage },
    from(table) {
      let update;
      return {
        select() { return this; }, eq() { return this; }, is() { return this; },
        async maybeSingle() {
          if (update) { if (!state.updateError) state.section = { ...state.section, ...update }; return { data: state.updateError ? null : state.section, error: state.updateError || null }; }
          return { data: table === "courses" ? { slug: state.courseSlug || "custom-course", title: state.courseTitle || "Custom course" } : state.section, error: null };
        },
        update(value) { update = value; return this; },
        then(resolve, reject) {
          if (!state.updateError) state.section = { ...state.section, ...update };
          return Promise.resolve({ error: state.updateError || null }).then(resolve, reject);
        },
      };
    },
  };
  function load(relativePath) {
    const filename = path.resolve(testDirectory, "..", relativePath);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const compiledModule = { exports: {} };
    const injectedRequire = (name) => {
      if (name === "next/server") return {
        ...nativeRequire(name),
        after: (callback) => state.afterTasks.push(callback),
      };
      if (name === "@/lib/auth/currentUser") return {
        requireAdminAccess: async () => state.admin ? { email: "admin@example.test" } : null,
        canManageSection: async () => state.admin,
        currentUserAccess: async () => state.access,
      };
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "server-only") return {};
      if (name === "@/course-content/sources.json") return JSON.parse(fs.readFileSync("course-content/sources.json", "utf8"));
      if (name === "@/lib/localSectionContent") return load("lib/localSectionContent.ts");
      if (name === "@/lib/sectionContent") return load("lib/sectionContent.ts");
      if (name === "@/lib/drive/sectionContent") return {
        async uploadDriveSection(input) {
          state.driveUploads++;state.uploadMetadata={contentType:input.mimeType};
          const id="drive-test-file-"+state.driveUploads;
          state.stored.set("drive:"+id,Buffer.from(input.bytes));return id;
        },
        async readDriveFile(value) {
          const key=value.startsWith("drive:") ? value : "drive:"+value;
          const bytes=state.stored.get(key);if(!bytes) throw Error("Drive unavailable");
          return {id:key.slice(6),name:state.driveName || state.section.source_filename || "slides.pdf",bytes:new Uint8Array(bytes)};
        },
      };
      if (name === "@/lib/supabase/server") return { getSupabaseAdmin: () => supabase };
      return nativeRequire(name);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(injectedRequire, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  const post = load("app/api/admin/sections/[id]/content/route.ts").POST;
  const get = load("app/api/sections/[id]/content/route.ts").GET;
  const context = () => ({ params: Promise.resolve({ id: state.section.id }) });
  return {
    state,
    flushAfter: async () => {
      for (const task of state.afterTasks.splice(0)) await task();
    },
    submit: (request) => post(request, context()),
    async upload(bytes, name, extra = {}) {
      const form = new FormData();
      form.set("file", new File([bytes], name));
      form.set("destinationId","destination-test");
      for (const [key, value] of Object.entries(extra)) form.set(key, value);
      return post(new Request("http://localhost/api/admin/sections/section-id/content", { method: "POST", body: form }), context());
    },
    download: (query = "") => get(new Request(`http://localhost/api/sections/section-id/content${query}`), context()),
  };
}

async function presentation(paddingBytes = 0) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships><Relationship Target="ppt/presentation.xml"/></Relationships>');
  zip.file("ppt/presentation.xml", '<p:presentation><p:sldIdLst/></p:presentation>');
  zip.file("ppt/slides/slide1.xml", '<p:sld><p:timing><p:audio><p:cMediaNode/></p:audio></p:timing></p:sld>');
  zip.file("ppt/slides/slide2.xml", '<p:sld><p:transition/></p:sld>');
  zip.file("ppt/slides/_rels/slide1.xml.rels", '<Relationships><Relationship Target="../media/audio1.wav"/><Relationship Target="../webextensions/webextension1.xml"/></Relationships>');
  zip.file("ppt/media/audio1.wav", Buffer.from([82, 73, 70, 70, 0, 255, 42, 99]));
  zip.file("ppt/webextensions/webextension1.xml", '<we:webextension id="sample-add-in"><we:properties/></we:webextension>');
  zip.file("customXml/item1.xml", '<vendor-data>Keep this untouched</vendor-data>');
  if (paddingBytes) zip.file("ppt/media/large-media.bin", Buffer.alloc(paddingBytes, 42), { compression: "STORE" });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("PPTX upload and download preserve every byte, media, animation, add-in parts, and Unicode filename", async () => {
  const bytes = await presentation();
  const api = handlers();
  const filename = 'Bài giảng "âm thanh".PPTX';
  const uploaded = await api.upload(bytes, filename, { slideCount: "999" });
  assert.equal(uploaded.status, 200);
  const payload = await uploaded.json();
  assert.equal(payload.contentType, "pptx");
  assert.equal(payload.slideCount, 2);
  assert.equal(payload.sourceFilename, filename);
  assert.equal(payload.contentPath, api.state.section.content_path);
  assert.equal(api.state.uploadMetadata.contentType, PPTX_MIME);
  assert.equal(api.state.supabaseUploads,0);
  assert.match(payload.contentPath,/^drive:/);
  const downloaded = await api.download();
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), PPTX_MIME);
  const disposition = downloaded.headers.get("content-disposition");
  assert.match(disposition, /^attachment;/);
  assert.equal(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]), filename);
  const result = Buffer.from(await downloaded.arrayBuffer());
  assert.deepEqual(result, bytes);
  const sha256 = (data) => createHash("sha256").update(data).digest("hex");
  assert.equal(sha256(result), sha256(bytes));
  const archive = await JSZip.loadAsync(result);
  assert.deepEqual(await archive.file("ppt/media/audio1.wav").async("nodebuffer"), Buffer.from([82, 73, 70, 70, 0, 255, 42, 99]));
  assert.match(await archive.file("ppt/slides/slide1.xml").async("string"), /<p:timing>/);
  assert.match(await archive.file("ppt/webextensions/webextension1.xml").async("string"), /sample-add-in/);
  assert.equal(await archive.file("customXml/item1.xml").async("string"), '<vendor-data>Keep this untouched</vendor-data>');
});

test("invalid and renamed non-PowerPoint ZIPs are rejected before storage", async () => {
  const zip = new JSZip();
  zip.file("document.txt", "This is not PowerPoint");
  for (const bytes of [Buffer.from("not a zip"), await zip.generateAsync({ type: "nodebuffer" })]) {
    const api = handlers();
    assert.equal((await api.upload(bytes, "invalid.pptx")).status, 400);
    assert.equal(api.state.stored.size, 0);
  }
});

test("PPTX larger than the old 10 MB proxy limit uploads and downloads unchanged", async () => {
  const bytes = await presentation(11 * 1024 * 1024);
  assert.ok(bytes.length > 10 * 1024 * 1024);
  const api = handlers();
  assert.equal((await api.upload(bytes, "large-media.pptx")).status, 200);
  const response = await api.download();
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test("truncated multipart requests return a useful 400 response without storing anything", async () => {
  const api = handlers();
  const request = new Request("http://localhost/api/admin/sections/section-id/content", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=upload-test" },
    body: '--upload-test\r\nContent-Disposition: form-data; name="file"; filename="slides.pptx"\r\n\r\ntruncated',
  });
  const response = await api.submit(request);
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /incomplete or invalid/);
  assert.equal(api.state.stored.size, 0);
});

test("PPTX rejects files over the existing 50 MB limit", async () => {
  const api = handlers();
  assert.equal((await api.upload(new Uint8Array(50 * 1024 * 1024 + 1), "large.pptx")).status, 413);
  assert.equal(api.state.stored.size, 0);
});

test("upload requires administrator access", async () => {
  const api = handlers({ admin: false });
  assert.equal((await api.upload(await presentation(), "slides.pptx")).status, 403);
  assert.equal(api.state.stored.size, 0);
});

test("built-in sections accept PPTX attachments and still reject PDF/TSX replacements", async () => {
  const api = handlers({ courseSlug: "applied-agentic-ai", section: { id: "section-id", course_id: "course-id", section_key: "section1" } });
  assert.equal((await api.upload(Buffer.from("%PDF-1.4"), "slides.pdf")).status, 400);
  assert.equal((await api.upload("export default [];", "slides.tsx")).status, 400);
  assert.equal(api.state.stored.size, 0);
  assert.equal((await api.upload(await presentation(), "slides.pptx")).status, 200);
  assert.equal(api.state.section.section_key, "section1");
  assert.equal(api.state.section.content_type, "pptx");
  assert.equal((await api.download()).status, 200);
});

test("PPTX downloads require an active session and explicit access to the requested section", async () => {
  const api = handlers();
  await api.upload(await presentation(), "slides.pptx");
  for (const [access, expected] of [
    [null, 401],
    [{ isActive: true, isAdmin: false, sections: [{ id: "sibling", courseId: "course-id" }], courses: [{ id: "course-id", isUnlocked: true }] }, 403],
    [{ isActive: false }, 401],
    [{ isActive: true, isAdmin: false, sections: [], courses: [{ id: "course-id", isUnlocked: false }] }, 403],
    [{ isActive: true, isAdmin: false, sections: [], courses: [] }, 403],
  ]) {
    api.state.access = access;
    assert.equal((await api.download()).status, expected);
  }
  api.state.access = { isActive: true, isAdmin: true, courses: [{ id: "course-id", isUnlocked: false }] };
  assert.equal((await api.download()).status, 200);
});

test("Drive replacement preserves the previous Drive file after saving section metadata", async () => {
  const api = handlers();
  const original = await presentation();
  await api.upload(original, "first.pptx");
  const previousPath = api.state.section.content_path;
  await api.upload(original, "second.pptx");
  assert.equal(api.state.removed.length, 0);
  assert.equal(api.state.section.source_filename, "second.pptx");
  await api.flushAfter();
  assert.deepEqual(api.state.removed, []);
  assert.equal(api.state.stored.size, 2);
  assert.deepEqual(api.state.stored.get(api.state.section.content_path), original);
});

test("migration removes legacy storage only after the Drive reference is saved", async () => {
  const api = handlers();
  const bytes = await presentation();
  const legacyPath="course-id/section-id/original.pptx";
  api.state.section={...api.state.section,content_path:legacyPath,content_type:"pptx",source_filename:"original.pptx"};
  api.state.stored.set(legacyPath,bytes);
  const response = await api.upload(bytes, "replacement.pptx");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.sourceFilename, "replacement.pptx");
  assert.equal(payload.contentPath, api.state.section.content_path);
  assert.equal(api.state.afterTasks.length, 1);
  assert.equal(api.state.removed.length, 0);
  await api.flushAfter();
});

test("a metadata failure retains the previous lesson and leaves the Drive upload recoverable", async () => {
  const api = handlers();
  const bytes = await presentation();
  await api.upload(bytes, "first.pptx");
  const previousPath = api.state.section.content_path;
  api.state.updateError = { message: "Simulated metadata failure" };
  assert.equal((await api.upload(bytes, "second.pptx")).status, 502);
  assert.equal(api.state.section.content_path, previousPath);
  assert.deepEqual(api.state.stored.get(previousPath), bytes);
  assert.equal(api.state.stored.size, 2);
  assert.equal(api.state.removed.length,0);
});

test("PDF still uploads and downloads unchanged, inline", async () => {
  const api = handlers();
  const bytes = Buffer.from("%PDF-1.4\nExisting PDF behavior");
  assert.equal((await api.upload(bytes, "slides.pdf")).status, 200);
  const downloaded = await api.download();
  assert.equal(downloaded.headers.get("content-type"), "application/pdf");
  assert.match(downloaded.headers.get("content-disposition"), /^inline;/);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  const attachment = await api.download("?download=1");
  assert.match(attachment.headers.get("content-disposition"), /^attachment;/);
  assert.equal(attachment.headers.get("content-type"), "application/pdf");
  assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), bytes);
});

test("TSX still compiles and downloads as JavaScript, inline", async () => {
  const api = handlers();
  assert.equal((await api.upload('export default [<div>Interactive slide</div>];', "slides.tsx")).status, 200);
  assert.equal(api.state.section.content_type, "tsx");
  const downloaded = await api.download();
  assert.equal(downloaded.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.match(downloaded.headers.get("content-disposition"), /^inline;/);
  assert.match(await downloaded.text(), /h\("div", null, "Interactive slide"\)/);
});

test("TSX keeps one original on Drive and compiles only when the deck requests it", async () => {
  const original = "// Keep original source\nexport default [<div>Original</div>];";
  const api = handlers();
  assert.equal((await api.upload(original, "original.tsx")).status, 200);
  assert.equal(api.state.stored.get(api.state.section.original_content_path).toString(), original);
  assert.equal(api.state.section.content_path, api.state.section.original_content_path);
  assert.equal(api.state.supabaseUploads,0);
  assert.equal(await (await api.download("?download=1")).text(),original);
  const previousOriginal = api.state.section.original_content_path;
  api.state.updateError = { message: "metadata failure" };
  assert.equal((await api.upload(original, "replacement.tsx")).status, 502);
  assert.equal(api.state.stored.size, 2);
  assert.equal(api.state.stored.get(previousOriginal).toString(), original);
});


test("retired Drive import and migration requests cannot change or delete web content", async () => {
 const api=handlers();const legacy="course-id/section-id/legacy.pdf",bytes=Buffer.from("%PDF-1.4\nLegacy");
 api.state.stored.set(legacy,bytes);api.state.section={...api.state.section,content_path:legacy,content_type:"pdf",source_filename:"legacy.pdf"};
 for(const action of ["link","migrate"]) {
  const response=await api.submit(new Request("http://localhost/api/admin/sections/section-id/content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,fileId:"existing-drive-file",destinationId:"destination-test"})}));
  assert.equal(response.status,410);assert.match((await response.json()).message,/no longer supported/);
  assert.equal(api.state.section.content_path,legacy);assert.equal(api.state.driveUploads,0);
 }
 await api.flushAfter();assert.ok(api.state.stored.has(legacy));assert.equal(api.state.removed.length,0);
});

test("legacy PDF sections still read from Supabase without requiring Drive",async()=>{
 const api=handlers();const path="course-id/section-id/legacy.pdf",bytes=Buffer.from("%PDF-1.4");api.state.stored.set(path,bytes);api.state.section={...api.state.section,content_path:path,content_type:"pdf",source_filename:"legacy.pdf"};
 assert.deepEqual(Buffer.from(await(await api.download()).arrayBuffer()),bytes);
});

test("Drive-backed legacy JS is served unchanged without TSX recompilation or Storage reads", async () => {
 const api=handlers(); const path="drive:runtime-file-12345";
 const bytes=Buffer.from("module.exports.default=[h('h1',{},'Existing JS')];");
 api.state.stored.set(path,bytes); api.state.section={...api.state.section,content_path:path,content_type:"tsx",source_filename:"Section 1.js"};
 const response=await api.download(); assert.equal(response.status,200);
 assert.equal(await response.text(),bytes.toString());
});


const webAppTitle = "AI-Powered Web App Development & Deployment";
for (const filename of ["Section1.tsx", "Section2.tsx"]) {
  test(filename + " displays and downloads the project TSX without accessing Drive", async () => {
    const api = handlers();
    api.state.access.courses[0] = { id: "a857595d-def0-4543-9216-a680c6abfe26", title: "Renamed course" };
    api.state.access.sections[0] = { id: filename === "Section1.tsx" ? "47c1183e-a26e-4c5d-9937-88ec5a755a32" : "2faaf285-a215-4874-a367-82c84ce46b2e", courseId: "a857595d-def0-4543-9216-a680c6abfe26" };
    api.state.section = { ...api.state.section, id: api.state.access.sections[0].id, course_id: "a857595d-def0-4543-9216-a680c6abfe26", content_type: "tsx", content_path: "drive:unavailable-old-copy", source_filename: "Renamed exported section.tsx" };
    const original = fs.readFileSync("course-content/web-app-development/" + filename, "utf8");
    const displayed = await api.download();
    assert.equal(displayed.status, 200);
    assert.equal(displayed.headers.get("x-eiu-content-source"), "project-tsx");
    assert.equal(displayed.headers.get("cache-control"), "private, no-store");
    assert.equal(await displayed.text(), ts.transpileModule(original, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: "h", jsxFragmentFactory: "Fragment", esModuleInterop: true }, fileName: "section.tsx" }).outputText);
    const downloaded = await api.download("?download=1");
    assert.equal(downloaded.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await downloaded.text(), original);
    api.state.access.sections = [];
    assert.equal((await api.download()).status, 403);
    api.state.access = null;
    assert.equal((await api.download()).status, 401);
  });
}
test("same TSX filename in another course retains its uploaded source", async () => {
  const api = handlers();
  const uploaded = "export default [h('div',{},'Other course')];";
  api.state.access.courses[0].title = "Another course";
  api.state.section = { ...api.state.section, content_type: "tsx", content_path: "course-id/section-id/Section1.js", source_filename: "Section1.tsx" };
  api.state.stored.set(api.state.section.content_path, Buffer.from(uploaded));
  const response = await api.download();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-eiu-content-source"), "uploaded");
  assert.equal(await response.text(), uploaded);
});

test("upload reports when registered project TSX remains the displayed source", async () => {
 const api = handlers({ courseTitle: "AI-Powered Web App Development & Deployment" });
 api.state.access.courses[0] = { id: "a857595d-def0-4543-9216-a680c6abfe26", title: "Renamed course" };
 api.state.access.sections[0] = { id: "47c1183e-a26e-4c5d-9937-88ec5a755a32", courseId: "a857595d-def0-4543-9216-a680c6abfe26" };
 api.state.section = { ...api.state.section, id: "47c1183e-a26e-4c5d-9937-88ec5a755a32", course_id: "a857595d-def0-4543-9216-a680c6abfe26" };
 const response = await api.upload("export default [<div>Uploaded copy</div>];", "Section1.tsx");
 assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.contentSource, "project-tsx"); assert.match(result.message, /Slides continue/);
 const slide = await api.download(); assert.equal(slide.headers.get("x-eiu-content-source"), "project-tsx"); assert.doesNotMatch(await slide.text(), /Uploaded copy/);
});
