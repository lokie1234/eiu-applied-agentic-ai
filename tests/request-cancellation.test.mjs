import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const paths = [
  "app/api/admin/access/route.ts",
  "app/api/templates/route.ts",
  "app/api/sections/[id]/content/route.ts",
  "app/api/session/section/route.ts",
];

function fixture(path, read) {
  const exports = {}, logs = [];
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } },
    "next/cache": {},
    "@/lib/auth/currentUser": { requireCourseManager: read, requireAdminAccess: read, currentUserAccess: read },
    "@/lib/auth/session": { currentAccessSession: read },
    "@/lib/auth/courseAccessStorage": { getCoursesAndSectionsData: async () => ({}), getSlideTemplates: async () => [] },
    "@/lib/auth/types": {}, "@/lib/auth/passcodes": {}, "@/lib/learningIdentity": {},
    "@/lib/supabase/server": {}, "@/lib/drive/sectionContent": {}, "@/lib/localSectionContent": {},
  };
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, console: { error: (...args) => logs.push(args) },
    require: name => dependencies[name] ?? require(name),
  });
  return { logs, run: request => (exports.GET ?? exports.POST)(request, { params: Promise.resolve({ id: "section" }) }) };
}

for (const path of paths) {
  test(`${path}: a disconnected client's wrapped Supabase abort is handled without an unhandled error`, async () => {
    const controller = new AbortController();
    const wrapped = { message: "ResponseAborted: ", details: "ResponseAborted: client disconnected", hint: "", code: "" };
    let started;
    const reading = new Promise(resolve => { started = resolve; });
    const f = fixture(path, async signal => {
      started();
      await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
      throw wrapped;
    });
    const result = f.run(new Request("http://localhost/api/test", { signal: controller.signal }));
    await reading;
    controller.abort(new Error("ResponseAborted"));
    const response = await result;
    assert.equal(response.status, 499);
    assert.match(response.headers["Cache-Control"], /no-store/);
    assert.equal(f.logs.length, 0);
  });

  test(`${path}: a live request's provider failure is still an error, even with the same message`, async () => {
    const f = fixture(path, async () => { throw { message: "ResponseAborted: ", details: "upstream failure", hint: "", code: "" }; });
    assert.equal((await f.run(new Request("http://localhost/api/test"))).status, 500);
    if (path.includes("admin/access")) assert.equal(f.logs.length, 1);
  });
}
