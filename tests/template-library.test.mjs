import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import learningIdentity from "./helpers/learning-identity.mjs";
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Date, console, require: name => dependencies[name] ?? (name === "@/lib/learningIdentity" ? learningIdentity : require(name)) });
  return exports;
}
function fixture(role = "admin") {
  const state = { templates: [{ id: "eiu-business-v1", name: "EIU", background: "/templates/eiu-business-v1/background.png" }], failWrite: false, writes: 0 };
  const actor = role ? { isActive: true, isAdmin: role === "admin", isTeacher: role === "teacher" } : null;
  const route = load("app/api/templates/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/auth/currentUser": { currentUserAccess: async () => actor, requireAdminAccess: async () => actor?.isAdmin ? actor : null },
    "@/lib/auth/courseAccessStorage": { getSlideTemplates: async () => state.templates, saveSlideTemplates: async templates => { if (state.failWrite) throw new Error("Write failed"); state.writes++; state.templates = templates; } },
  });
  return { state, get: route.GET, post: body => route.POST({ headers: { get: () => null }, json: async () => body }) };
}

test("facilitators can view layouts but cannot add/delete them; unauthenticated reads are blocked", async () => {
  const teacher = fixture("teacher");
  assert.equal((await teacher.get()).data.templates.length, 1);
  for (const action of ["create", "delete"]) assert.equal((await teacher.post({ action, id: "eiu-business-v1" })).status, 403);
  assert.equal(teacher.state.writes, 0);
  assert.equal((await fixture(null).get()).status, 401);
});

test("admin additions appear in catalog and deleted layouts stay removed", async () => {
  const f = fixture();
  const added = await f.post({ action: "create", name: "Business", background: "data:image/png;base64,YQ==" });
  assert.equal(added.status, 200);
  assert.equal((await f.get()).data.templates.length, 2);
  const id = added.data.templates[1].id;
  assert.equal((await f.post({ action: "delete", id })).status, 200);
  assert.equal((await f.post({ action: "delete", id: "eiu-business-v1" })).status, 200);
  assert.equal((await f.get()).data.templates.length, 0);
});

test("invalid layout uploads and failed persistence never report successful changes", async () => {
  const f = fixture();
  assert.equal((await f.post({ action: "create", name: "Unsafe", background: "data:image/svg+xml;base64,YQ==" })).status, 400);
  f.state.failWrite = true;
  assert.equal((await f.post({ action: "delete", id: "eiu-business-v1" })).status, 500);
  assert.equal(f.state.templates.length, 1);
});

test("hidden courses and folders are excluded from both passcode roles while admin retains them", async () => {
  let role = "passcode", credentialHash;
  const catalog = {
    folderGroups: [{ id: "visible" }, { id: "hidden", hidden: true }],
    courses: [
      { id: "shown", status: "active", folderGroupId: "visible", metadata: { passcode: "learn1234", facilitatorPasscode: "teach1234", summary: "Shown", templateKey: "custom" } },
      { id: "hidden-course", status: "active", folderGroupId: "visible", metadata: { passcode: "learn1234", facilitatorPasscode: "teach1234", hidden: true } },
      { id: "hidden-folder", status: "active", folderGroupId: "hidden", metadata: { passcode: "learn1234", facilitatorPasscode: "teach1234" } },
    ],
    sections: ["shown", "hidden-course", "hidden-folder"].map(id => ({ id: id + "-section", course_id: id, status: "active", section_key: "lecture", position: 1 })),
  };
  const storage = { getCoursesAndSectionsData: async () => catalog };
  const codes = load("lib/auth/passcodes.ts", { "server-only": {}, "./courseAccessStorage": storage, "./types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai" } });
  const access = load("lib/auth/currentUser.ts", {
    "server-only": {}, "@/lib/supabase/server": {}, "./session": { currentAccessSession: async () => ({ role, credentialHash, sessionId: "learner" }) },
    "./courseAccessStorage": storage, "./passcodes": codes, "./types": { FIXED_ADMIN_EMAIL: "admin@example.test" },
  });
  for (const code of ["learn1234", "teach1234"]) {
    credentialHash = codes.hashPasscode(code);
    const result = await access.currentUserAccess();
    assert.deepEqual(Array.from(result.courses, course => course.id), ["shown"]);
    assert.deepEqual(Array.from(result.sections, section => section.id), ["shown-section"]);
    assert.equal(result.courses[0].templateKey, "custom");
  }
  role = "admin";
  assert.equal((await access.currentUserAccess()).courses.length, 3);
});
