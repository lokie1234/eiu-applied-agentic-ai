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
    section: { id: "00000000-0000-4000-8000-000000000001", course_id: "00000000-0000-4000-8000-000000000002", section_key: "custom", status: "active", content_path: null },
    access: { isActive: true, isAdmin: false, sections: [{ id: "00000000-0000-4000-8000-000000000001", courseId: "00000000-0000-4000-8000-000000000002" }], courses: [{ id: "00000000-0000-4000-8000-000000000002", isUnlocked: true }] },
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
      if (table === "course_sections") state.sectionReads = (state.sectionReads || 0) + 1;
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
      if (name === "@/lib/localSectionContent") {
        const local=load("lib/localSectionContent.ts");
        return {...local,
          async saveLocalSectionSource(courseId,sectionId,bytes) {
            const binding=`local:course-content/imported/${courseId}/${sectionId}/${crypto.randomUUID()}.js`;
            local.localSectionSourcePath({id:courseId},{id:sectionId,content_type:'tsx',content_path:binding});
            state.stored.set(binding,Buffer.from(bytes));state.localWrites=(state.localWrites||0)+1;return binding;
          },
          async readLocalSectionSource(course,section) {
            if(section.content_path?.startsWith('local:')) {
              local.localSectionSourcePath(course,section);return state.stored.get(section.content_path) || null;
            }
            return local.readLocalSectionSource(course,section);
          },
        };
      }
      if (name === "./sectionLimits") return load("lib/sectionLimits.ts");
      if (name === "@/lib/sectionContent") return load("lib/sectionContent.ts");
      if (name === "@/lib/drive/sectionContent") return {
        async uploadDriveSection(input) {
          state.driveUploads++;state.uploadMetadata={contentType:input.mimeType};
          const id="drive-test-file-"+state.driveUploads;
          state.stored.set("drive:"+id,Buffer.from(input.bytes));return id;
        },
        async readDriveFile(value) {
          const normalized=value.replace("drive:override:","drive:");
          const key=normalized.startsWith("drive:") ? normalized : "drive:"+normalized;
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
      return post(new Request("http://localhost/api/admin/sections/section-id/content", { method: "POST", headers: { Origin: "http://localhost" }, body: form }), context());
    },
    download: (query = "") => get(new Request(`http://localhost/api/sections/section-id/content${query}`), context()),
  };
}

test("admin downloads the built-in JS snapshot without Drive, including sections with PPTX attachments", async () => {
  for (const sectionKey of ["section1", "section2"]) {
    const api = handlers({ access: { isActive: true, isAdmin: true,
      sections: [{ id: "00000000-0000-4000-8000-000000000001", courseId: "00000000-0000-4000-8000-000000000002", sectionKey }],
      courses: [{ id: "00000000-0000-4000-8000-000000000002", slug: "applied-agentic-ai" }],
    } });
    const response = await api.download("?download=1&builtin=1");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), new RegExp(`attachment; filename="${sectionKey}\\.js"`));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(`lib/drive/builtin-decks/${sectionKey}.js`));
    assert.equal(api.state.driveUploads, 0);
    api.state.access.isAdmin = false;
    assert.equal((await api.download("?builtin=1")).status, 403);
    api.state.access.isAdmin = true;
    api.state.access.courses[0].slug = "another-course";
    assert.equal((await api.download("?builtin=1")).status, 404);
    api.state.access.courses[0].slug = "applied-agentic-ai";
    api.state.access.sections[0].sectionKey = "../../private";
    assert.equal((await api.download("?builtin=1")).status, 404);
  }
});

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
    headers: { Origin: "http://localhost", "content-type": "multipart/form-data; boundary=upload-test" },
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
  const api = handlers({ courseSlug: "applied-agentic-ai", section: { id: "00000000-0000-4000-8000-000000000001", course_id: "00000000-0000-4000-8000-000000000002", section_key: "section1" } });
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
    [{ isActive: true, isAdmin: false, sections: [{ id: "sibling", courseId: "00000000-0000-4000-8000-000000000002" }], courses: [{ id: "00000000-0000-4000-8000-000000000002", isUnlocked: true }] }, 403],
    [{ isActive: false }, 401],
    [{ isActive: true, isAdmin: false, sections: [], courses: [{ id: "00000000-0000-4000-8000-000000000002", isUnlocked: false }] }, 403],
    [{ isActive: true, isAdmin: false, sections: [], courses: [] }, 403],
  ]) {
    api.state.access = access;
    assert.equal((await api.download()).status, expected);
  }
  api.state.access = { isActive: true, isAdmin: true, courses: [{ id: "00000000-0000-4000-8000-000000000002", isUnlocked: false }] };
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
  const legacyPath=`${api.state.section.course_id}/${api.state.section.id}/original.pptx`;
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
  assert.equal((await api.upload(bytes, "second.pptx")).status, 409);
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

test("JS uploads and downloads directly without compilation, inline", async () => {
  const api = handlers();
  assert.equal((await api.upload('exports.default = [h("div", null, "Interactive slide")];', "slides.js")).status, 200);
  assert.equal(api.state.section.content_type, "tsx");
  const downloaded = await api.download();
  assert.equal(downloaded.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.match(downloaded.headers.get("content-disposition"), /^inline;/);
  assert.match(await downloaded.text(), /h\("div", null, "Interactive slide"\)/);
});

test("JS imports preserve exact runtime bytes locally without Drive or a TSX intermediate", async () => {
  const original = "// Keep original source\nexports.default = [h('div', null, 'Original')];";
  const api = handlers();
  assert.equal((await api.upload(original, "original.js")).status, 200);
  assert.equal(api.state.stored.get(api.state.section.content_path).toString(), original);
  assert.equal(api.state.section.original_content_path, null);
  assert.equal(api.state.supabaseUploads,0);assert.equal(api.state.driveUploads,0);assert.equal(api.state.localWrites,1);
  assert.equal(await (await api.download("?download=1")).text(),original);
  const previousOriginal = api.state.section.content_path;
  api.state.updateError = { message: "metadata failure" };
  assert.equal((await api.upload(original, "replacement.js")).status, 409);
  assert.equal(api.state.stored.size, 2);
  assert.equal(api.state.stored.get(previousOriginal).toString(), original);
});


test("retired Drive import and migration requests cannot change or delete web content", async () => {
 const api=handlers();const legacy="course-id/section-id/legacy.pdf",bytes=Buffer.from("%PDF-1.4\nLegacy");
 api.state.stored.set(legacy,bytes);api.state.section={...api.state.section,content_path:legacy,content_type:"pdf",source_filename:"legacy.pdf"};
 for(const action of ["link","migrate"]) {
  const response=await api.submit(new Request("http://localhost/api/admin/sections/section-id/content",{method:"POST",headers:{Origin:"http://localhost","Content-Type":"application/json"},body:JSON.stringify({action,fileId:"existing-drive-file",destinationId:"destination-test"})}));
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
test("authorized repository lessons avoid a second section lookup without caching permission or bytes", async () => {
  const api = handlers();
  const courseId = "a857595d-def0-4543-9216-a680c6abfe26", id = "47c1183e-a26e-4c5d-9937-88ec5a755a32";
  api.state.access.courses = [{ id: courseId }];
  api.state.access.sections = [{ id, courseId, contentType:"tsx", sourceFilename:"Section1.js" }];
  api.state.section.id = id;
  const before = api.state.sectionReads || 0;
  const response = await api.download();
  assert.equal(response.status,200);
  assert.equal(api.state.sectionReads || 0,before,"the freshly authorized catalog is sufficient for a registered local lesson");
  assert.equal(await response.text(),fs.readFileSync("course-content/web-app-development/Section1.js","utf8"));
  api.state.access.sections[0].hidden = true;
  assert.equal((await api.download()).status,403,"visibility is rechecked on each request");
  api.state.access = null;
  assert.equal((await api.download()).status,401,"completed content is never reused across revoked sessions");
});
for (const filename of ["Section1.js", "Section2.js"]) {
  test(filename + " displays and downloads compiled JS without accessing Drive", async () => {
    const api = handlers();
    api.state.access.courses[0] = { id: "a857595d-def0-4543-9216-a680c6abfe26", title: "Renamed course" };
    api.state.access.sections[0] = { id: filename === "Section1.js" ? "47c1183e-a26e-4c5d-9937-88ec5a755a32" : "2faaf285-a215-4874-a367-82c84ce46b2e", courseId: "a857595d-def0-4543-9216-a680c6abfe26" };
    api.state.section = { ...api.state.section, id: api.state.access.sections[0].id, course_id: "a857595d-def0-4543-9216-a680c6abfe26", content_type: "tsx", content_path: "drive:unavailable-old-copy", source_filename: "Renamed exported section.tsx" };
    const original = fs.readFileSync("course-content/web-app-development/" + filename, "utf8");
    const displayed = await api.download();
    assert.equal(displayed.status, 200);
    assert.equal(displayed.headers.get("x-eiu-content-source"), "project-js");
    assert.equal(displayed.headers.get("cache-control"), "private, no-store");
    const compiled = original;
    assert.equal(await displayed.text(), compiled);
    const downloaded = await api.download("?download=1");
    assert.equal(downloaded.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.match(downloaded.headers.get("content-disposition"), /\.js/);
    assert.equal(await downloaded.text(), compiled);
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

test("upload connects imported JS as the displayed and downloadable project source", async () => {
 const api = handlers({ courseTitle: "AI-Powered Web App Development & Deployment" });
 api.state.access.courses[0] = { id: "a857595d-def0-4543-9216-a680c6abfe26", title: "Renamed course" };
 api.state.access.sections[0] = { id: "47c1183e-a26e-4c5d-9937-88ec5a755a32", courseId: "a857595d-def0-4543-9216-a680c6abfe26" };
 api.state.section = { ...api.state.section, id: "47c1183e-a26e-4c5d-9937-88ec5a755a32", course_id: "a857595d-def0-4543-9216-a680c6abfe26" };
 const response = await api.upload("exports.default = [h('div', null, 'Uploaded copy')];", "Section1.js");
 assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.contentSource, "project-js"); assert.match(result.message, /imported into the project/);
 const slide = await api.download(); assert.equal(slide.headers.get("x-eiu-content-source"), "project-js"); assert.equal(await slide.text(), "exports.default = [h('div', null, 'Uploaded copy')];");
});


test("PC upload replaces registered project JS and displays the uploaded bytes", async () => {
 const api = handlers();
 const courseId = "a857595d-def0-4543-9216-a680c6abfe26", sectionId = "47c1183e-a26e-4c5d-9937-88ec5a755a32";
 api.state.access.courses[0] = { id: courseId };
 api.state.access.sections[0] = { id: sectionId, courseId };
 api.state.section = { ...api.state.section, id: sectionId, course_id: courseId };
 const source = "exports.default = [h('div', null, 'PC replacement')];";
 const response = await api.upload(source, "replacement.js", { replaceLesson: "1" });
 assert.equal(response.status, 200);
 assert.equal((await response.json()).contentSource, "project-js");
 assert.match(api.state.section.content_path, /^local:course-content\/imported\//);
 const displayed = await api.download();
 assert.equal(displayed.status, 200);
 assert.equal(await displayed.text(), source);
});

test("upload rejects cross-origin requests and oversized bodies before saving", async () => {
 const api = handlers();
 const url = "http://localhost/api/admin/sections/section-id/content";
 assert.equal((await api.submit(new Request(url, { method: "POST", headers: { Origin: "https://other.test" } }))).status, 403);
 assert.equal((await api.submit(new Request(url, { method: "POST", headers: { Origin: "http://localhost", "content-length": String(52 * 1024 * 1024) } }))).status, 413);
 assert.equal(api.state.driveUploads, 0);
});

test("concurrent upload is rejected and the guard is released after invalid input", async () => {
 const api = handlers();
 const request = new Request("http://localhost/api/admin/sections/section-id/content", { method: "POST", headers: { Origin: "http://localhost" } });
 let release;
 let started;
 const reading = new Promise(resolve => { started = resolve; });
 Object.defineProperty(request, "formData", { value: () => { started(); return new Promise(resolve => { release = resolve; }); } });
 const first = api.submit(request);
 await reading;
 const duplicate = await api.upload("%PDF-1.4", "slides.pdf");
 assert.equal(duplicate.status, 429);
 assert.equal(api.state.driveUploads, 0);
 release(new FormData());
 assert.equal((await first).status, 400);
 assert.equal((await api.upload("%PDF-1.4", "slides.pdf")).status, 200);
});
