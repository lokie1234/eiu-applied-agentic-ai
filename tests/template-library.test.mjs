import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Date, console, require: name => dependencies[name] ?? require(name) });
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

test("teachers can view layouts but cannot add/delete them; unauthenticated reads are blocked", async () => {
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

test("hidden courses/folders disappear from teacher and learner access while admins retain them", async () => {
  let role = "teacher";
  const courses = [
    { id: "shown", title: "Visible", status: "active", description: JSON.stringify({ summary: "Shown", folderGroupId: "visible", templateKey: "custom" }) },
    { id: "hidden-course", title: "Hidden", status: "active", description: JSON.stringify({ hidden: true, folderGroupId: "visible" }) },
    { id: "hidden-folder", title: "Hidden folder course", status: "active", description: JSON.stringify({ folderGroupId: "hidden" }) },
  ];
  const sections = courses.map(c => ({ id: c.id + "-section", course_id: c.id, section_key: "lecture", position: 1 }));
  const db = { from: table => ({ select() { return this; }, eq() { return this; }, order() { return this; }, then: resolve => Promise.resolve({ data: table === "courses" ? courses : sections }).then(resolve) }) };
  const access = load("lib/auth/currentUser.ts", {
    "server-only": {}, "./teachers": { currentTeacher: async () => ({ id: "teacher", email: "teacher@example.test", must_change_password: false }), teacherByEmail: async () => null },
    "@/lib/auth/session": { currentAccessSession: async () => ({ role, email: "learner@example.test" }) },
    "@/lib/supabase/server": { getSupabaseAdmin: () => db },
    "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "admin@example.test" },
    "@/lib/auth/courseAccessStorage": { parseCourseMetadata: raw => JSON.parse(raw), getUserUnlockedCourses: async () => [], getCoursesAndSectionsData: async () => ({ folderGroups: [{ id: "visible" }, { id: "hidden", hidden: true }] }) },
  });
  for (role of ["teacher", "learner"]) {
    const result = await access.currentUserAccess();
    assert.deepEqual(Array.from(result.courses, course => course.id), ["shown"]);
    assert.deepEqual(Array.from(result.sections, section => section.id), ["shown-section"]);
    assert.equal(result.courses[0].templateKey, "custom");
  }
  role = "admin";
  assert.equal((await access.currentUserAccess()).courses.length, 3);
});
