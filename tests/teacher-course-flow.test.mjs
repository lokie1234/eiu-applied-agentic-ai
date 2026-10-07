import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function fixture() {
  const state = {
    actor: { isAdmin: false, isTeacher: true, authUserId: "teacher-a", email: "a@example.test" },
    tables: { courses: [{ id: "admin-course", slug: "admin-course", title: "Admin course", created_by: null, status: "active" }, { id: "other-course", slug: "other-course", title: "Other course", created_by: "teacher-b", status: "active" }], course_sections: [] },
    sequence: 0, insertError: null, passcodes: [], templateError: false,
    folders: [{ id: "fg-ai-agentic", name: "AI & Agentic", order: 1, createdBy: "teacher-a" }],
  };
  const db = {
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    from(table) {
      state.tables[table] ??= [];
      let mode = "read", values, countOnly = false, descending = false, orderBy;
      const filters = [];
      function result() {
        if (mode === "insert") {
          if (state.insertError) return { error: state.insertError };
          const rows = (Array.isArray(values) ? values : [values]).map(row => ({ id: `new-${++state.sequence}`, ...row }));
          state.tables[table].push(...rows); mode = "read";
          return { data: rows, error: null };
        }
        let rows = state.tables[table].filter(row => filters.every(filter => filter(row)));
        if (orderBy) rows.sort((a, b) => (a[orderBy] > b[orderBy] ? 1 : a[orderBy] < b[orderBy] ? -1 : 0) * (descending ? -1 : 1));
        if (mode === "update") rows.forEach(row => Object.assign(row, values));
        if (mode === "delete") state.tables[table] = state.tables[table].filter(row => !rows.includes(row));
        return { data: rows, count: countOnly ? rows.length : undefined, error: null };
      }
      return {
        select(_, options) { countOnly = options?.head ?? false; return this; },
        eq(key, value) { filters.push(row => row[key] === value); return this; },
        in(key, values) { filters.push(row => values.includes(row[key])); return this; },
        or(expression) { const owner = expression.split("created_by.neq.")[1]; filters.push(row => !row.created_by || row.created_by !== owner); return this; },
        order(key, options) { orderBy = key; descending = options?.ascending === false; return this; },
        limit() { return this; },
        insert(rows) { mode = "insert"; values = rows; return this; },
        update(row) { mode = "update"; values = row; return this; },
        delete() { mode = "delete"; return this; },
        maybeSingle: async () => { const res = result(); return { ...res, data: res.data?.[0] ?? null }; },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
    },
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "admin-course" },
    "@/lib/auth/currentUser": { requireCourseManager: async () => state.actor },
    "@/lib/supabase/server": { getSupabaseAdmin: () => db },
    "@/lib/auth/courseAccessStorage": {
      parseCourseMetadata: (raw, summary) => raw ? JSON.parse(raw) : { summary },
      serializeCourseMetadata: value => JSON.stringify(value),
      setSectionPasscode: async (...args) => state.passcodes.push(args),
      setSectionTemplate: async (id, keys, enabled) => {
        if (state.templateError) throw new Error("Template save failed");
        const course = state.tables.courses.find(c => c.id === id);
        const meta = JSON.parse(course.description ?? "{}");
        meta.sectionTemplates ??= {};
        for (const key of keys) if (enabled) meta.sectionTemplates[key] = "eiu-business-v1";
        course.description = JSON.stringify(meta);
      },
      getCoursesAndSectionsData: async () => ({ courses: state.tables.courses.map(c => ({ ...c, folderGroupId: JSON.parse(c.description ?? "{}").folderGroupId ?? "fg-ai-agentic" })), sections: state.tables.course_sections, folderGroups: state.folders }),
      updateCourseSystemIcons: async (id, systemIcons) => {
        const course = state.tables.courses.find(c => c.id === id);
        course.description = JSON.stringify({ ...JSON.parse(course.description ?? "{}"), systemIcons });
      },
      updateFolderGroup: async (id, name, description) => Object.assign(state.folders.find(g => g.id === id), { name, description }),
      deleteFolderGroup: async id => { state.folders = state.folders.filter(g => g.id !== id); },
      createFolderGroup: async (name, description, createdBy) => {
        const folder = { id: "fg-new", name, description, createdBy, order: state.folders.length + 1 };
        state.folders.push(folder); return folder;
      },
      setCourseFolderGroup: async (courseId, folderGroupId, folderGroupName) => {
        const course = state.tables.courses.find(c => c.id === courseId);
        course.description = JSON.stringify({ ...JSON.parse(course.description ?? "{}"), folderGroupId, folderGroupName });
      },
      getAllAuthorizedEmails: async () => [],
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("app/api/admin/access/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, console: { error() {} }, require: name => dependencies[name] ?? require(name) });
  return { state, get: () => exports.GET(), post: body => exports.POST({ json: async () => body }) };
}

test("teacher creates a course and sections with server-assigned ownership and manages their lifecycle", async () => {
  const f = fixture();
  const created = await f.post({ action: "create_course", title: " MIS 311 ", created_by: "teacher-b" });
  assert.equal(created.status, 200);
  const id = created.data.createdCourseIds[0];
  const course = f.state.tables.courses.find(c => c.id === id);
  assert.equal(course.created_by, "teacher-a"); assert.equal(course.title, "MIS 311");
  assert.equal(created.data.courses.find(c => c.id === id).canEdit, true);
  assert.equal(created.data.courses.find(c => c.id === "other-course").canEdit, false);
  const sections = await f.post({ action: "create_section", courseId: id, titles: ["Intro", "Practice"], created_by: "teacher-b" });
  assert.equal(sections.status, 200);
  assert.equal(sections.data.sections.length, 2);
  assert.ok(f.state.tables.course_sections.every(s => s.created_by === "teacher-a" && s.course_id === id));
  assert.equal(f.state.passcodes.length, 2);
  const [first, second] = sections.data.sections;
  assert.equal((await f.post({ action: "rename_section", sectionId: first.id, title: "Introduction" })).status, 200);
  assert.equal((await f.post({ action: "reorder_sections", courseId: id, sectionIds: [second.id, first.id] })).status, 200);
  assert.equal(f.state.tables.course_sections.find(s => s.id === second.id).position, 1);
  assert.equal((await f.post({ action: "set_course_language", courseId: id, languageLabel: "en" })).status, 200);
  assert.equal(course.language_label, "en");
  assert.equal((await f.post({ action: "delete_section", sectionId: first.id })).status, 200);
  assert.equal((await f.post({ action: "delete_course", courseId: id })).status, 200);
  assert.equal(f.state.tables.course_sections.length, 0);
  assert.equal(f.state.tables.courses.length, 2);
});

test("teachers cannot modify another teacher's course, sections or global access", async () => {
  const f = fixture();
  f.state.tables.course_sections.push({ id: "foreign-section", course_id: "other-course", created_by: "teacher-b", status: "active" });
  for (const action of ["create_section", "update_course_title", "set_course_language", "delete_course", "reorder_sections", "rename_section", "delete_section", "delete_sections", "grant_emails_bulk", "delete_courses"])
    assert.equal((await f.post({ action, courseId: "other-course", courseIds: ["other-course"], sectionId: "foreign-section", sectionIds: ["foreign-section"], title: "Changed", languageLabel: "vi" })).status, 403, action);
  assert.equal(f.state.tables.courses.find(c => c.id === "other-course").title, "Other course");
});

test("legacy ownership foreign keys produce an actionable error and no successful creation", async () => {
  const f = fixture();
  f.state.insertError = { code: "23503", message: 'violates foreign key constraint "courses_created_by_fkey"', details: "created_by is not present in staff_accounts" };
  const result = await f.post({ action: "create_course", title: "MIS 311" });
  assert.equal(result.status, 409);
  assert.equal(result.data.errorCode, "COURSE_OWNERSHIP_NOT_CONFIGURED");
  assert.equal(result.data.success, false);
  assert.equal(f.state.tables.courses.length, 2);
});

test("admin-created courses keep admin ownership and return the newly created IDs", async () => {
  const f = fixture(); f.state.actor = { isAdmin: true, authUserId: "admin", email: "admin@example.test" };
  const result = await f.post({ action: "create_course", title: "Admin new course" });
  assert.equal(result.status, 200);
  assert.equal(result.data.createdCourseIds.length, 1);
  assert.equal(f.state.tables.courses.find(c => c.id === result.data.createdCourseIds[0]).created_by, null);
});

test("teacher creates an owned folder, adds an owned course and moves it between real folders", async () => {
  const f = fixture();
  const folder = await f.post({ action: "create_folder_group", name: " Business Analytics ", description: "Teaching materials" });
  assert.equal(folder.status, 200);
  assert.equal(folder.data.createdFolderGroupId, "fg-new");
  assert.equal(folder.data.folderGroups.find(g => g.id === "fg-new").name, "Business Analytics");
  const created = await f.post({ action: "create_course", title: "MIS 311", folderGroupId: "fg-new", folderGroupName: "Forged name" });
  assert.equal(created.status, 200);
  const id = created.data.createdCourseIds[0];
  const course = created.data.courses.find(c => c.id === id);
  assert.equal(course.folderGroupId, "fg-new"); assert.equal(course.folderGroupName, "Business Analytics");
  assert.equal(course.canEdit, true);
  assert.equal((await f.post({ action: "set_course_folder_group", courseId: id, folderGroupId: "fg-ai-agentic" })).status, 200);
  const saved = f.state.tables.courses.find(c => c.id === id);
  assert.equal(JSON.parse(saved.description).folderGroupId, "fg-ai-agentic");
  assert.equal(saved.created_by, "teacher-a");
  assert.equal((await f.post({ action: "set_course_folder_group", courseId: "other-course", folderGroupId: "fg-new" })).status, 403);
  assert.equal((await f.post({ action: "set_course_folder_group", courseId: id, folderGroupId: "missing" })).status, 400);
  assert.equal((await f.post({ action: "create_course", title: "Invalid parent", folderGroupId: "missing" })).status, 400);
  assert.equal(folder.data.folderGroups.find(g => g.id === "fg-new").createdBy, "teacher-a");
  assert.equal((await f.post({ action: "update_folder_group", id: "fg-new", name: "Renamed" })).status, 200);
  assert.equal((await f.post({ action: "set_folder_group_unlocked", folderGroupId: "fg-new", unlocked: true })).status, 403);
  f.state.folders.push({ id: "foreign", name: "Admin folder", order: 3 });
  for (const action of ["update_folder_group", "delete_folder_group", "delete_folder_groups"])
    assert.equal((await f.post({ action, id: "foreign", name: "Renamed", folderGroupIds: ["foreign"] })).status, 403);
  assert.equal((await f.post({ action: "create_course", title: "Forbidden", folderGroupId: "foreign" })).status, 403);
  assert.equal((await f.post({ action: "set_course_folder_group", courseId: id, folderGroupId: "foreign" })).status, 403);
  assert.equal((await f.post({ action: "create_folder_group", name: " " })).status, 400);
  assert.equal((await f.post({ action: "create_folder_group", name: "x".repeat(121) })).status, 400);
});

test("teacher icon changes are scoped to owned courses and preserve access metadata", async () => {
  const f = fixture();
  const created = await f.post({ action: "create_course", title: "MIS 311" });
  const id = created.data.createdCourseIds[0];
  const raw = f.state.tables.courses.find(c => c.id === id);
  const original = JSON.parse(raw.description);
  const icon = { id: "python", name: "Python", url: "data:image/png;base64,aGVsbG8=", scale: 1 };
  const saved = await f.post({ action: "update_course_system_icons", courseId: id, systemIcons: [icon] });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.courses.find(c => c.id === id).systemIcons[0].name, "Python");
  const metadata = JSON.parse(raw.description);
  assert.deepEqual(metadata.allowedEmails, original.allowedEmails);
  assert.equal(metadata.unlocked, original.unlocked);
  assert.equal((await f.post({ action: "update_course_system_icons", courseId: "other-course", systemIcons: [icon] })).status, 403);
  assert.equal((await f.post({ action: "update_course_system_icons", courseId: id, systemIcons: [{ ...icon, url: "javascript:alert(1)" }] })).status, 400);
  assert.equal((await f.post({ action: "update_course_system_icons", courseId: id, systemIcons: [icon, icon] })).status, 400);
  assert.equal((await f.post({ action: "update_course_system_icons", courseId: id, systemIcons: [] })).status, 200);
  assert.equal(JSON.parse(raw.description).systemIcons.length, 0);
});

test("bulk course and section deletion rejects mixed ownership before any mutation", async () => {
  const f = fixture();
  const created = await f.post({ action: "create_course", titles: ["Course A", "Course B"] });
  const [a, b] = created.data.createdCourseIds;
  await f.post({ action: "create_section", courseId: a, title: "Own lesson" });
  const ownSection = f.state.tables.course_sections[0];
  f.state.tables.course_sections.push({ id: "foreign", course_id: a, created_by: "teacher-b", title: "Foreign lesson", status: "active" });
  assert.equal((await f.post({ action: "delete_sections", sectionIds: [ownSection.id, "foreign"] })).status, 403);
  assert.equal((await f.post({ action: "delete_courses", courseIds: [a, "other-course"] })).status, 403);
  assert.equal((await f.post({ action: "delete_courses", courseIds: [a, b] })).status, 403);
  assert.equal(f.state.tables.course_sections.length, 2);
  assert.ok(f.state.tables.courses.some(c => c.id === b));
  assert.equal((await f.post({ action: "delete_courses", courseIds: [b] })).status, 200);
  assert.ok(f.state.tables.courses.some(c => c.id === a));
  assert.equal((await f.post({ action: "set_all_courses_unlocked", unlocked: true })).status, 403);
  assert.equal((await f.post({ action: "set_course_passcode", courseId: a, code: "1111" })).status, 403);
});

test("teacher can reorder a complete folder of owned courses while a shared folder cannot be reordered", async () => {
  const f = fixture();
  await f.post({ action: "create_folder_group", name: "Own courses" });
  const created = await f.post({ action: "create_course", titles: ["A", "B"], folderGroupId: "fg-new" });
  const [a, b] = created.data.createdCourseIds;
  const reordered = await f.post({ action: "reorder_courses", folderGroupId: "fg-new", courseIds: [b, a] });
  assert.equal(reordered.status, 200);
  assert.equal(reordered.data.courses.findIndex(c => c.id === b) < reordered.data.courses.findIndex(c => c.id === a), true);
  assert.equal((await f.post({ action: "reorder_courses", folderGroupId: "fg-ai-agentic", courseIds: [a, "other-course"] })).status, 403);
});

for (const role of ["admin", "teacher"]) test(`${role} can opt into the template for each created section`, async () => {
  const f = fixture();
  if (role === "admin") f.state.actor = { isAdmin: true, authUserId: "admin" };
  const courseId = (await f.post({ action: "create_course", title: "Template course" })).data.createdCourseIds[0];
  assert.equal((await f.post({ action: "create_section", courseId, titles: ["A", "B"], useEiuTemplate: true })).status, 200);
  const course = f.state.tables.courses.find(c => c.id === courseId);
  const selected = JSON.parse(course.description).sectionTemplates;
  assert.equal(Object.keys(selected).length, 2);
  assert.ok(f.state.tables.course_sections.every(s => selected[s.section_key] === "eiu-business-v1"));
  assert.equal((await f.post({ action: "create_section", courseId, title: "Plain", useEiuTemplate: false })).status, 200);
  const plain = f.state.tables.course_sections.find(s => s.title === "Plain");
  assert.equal(JSON.parse(course.description).sectionTemplates[plain.section_key], undefined);
  f.state.templateError = true;
  assert.equal((await f.post({ action: "create_section", courseId, title: "Failed", useEiuTemplate: true })).status, 500);
  assert.ok(!f.state.tables.course_sections.some(s => s.title === "Failed"));
});

test("a teacher cannot mutate an owned section inside someone else's course", async () => {
  const f = fixture();
  f.state.tables.course_sections.push({ id: "moved-section", course_id: "other-course", created_by: "teacher-a", title: "Moved lesson", status: "active" });
  for (const action of ["rename_section", "delete_section", "delete_sections"]) {
    const result = await f.post({ action, sectionId: "moved-section", sectionIds: ["moved-section"], title: "Changed" });
    assert.equal(result.status, 403, action);
  }
  assert.equal((await f.get()).data.sections.find(s => s.id === "moved-section").canEdit, false);
  assert.equal(f.state.tables.course_sections[0].title, "Moved lesson");
  f.state.actor = { isAdmin: true, authUserId: "admin" };
  assert.equal((await f.post({ action: "rename_section", sectionId: "moved-section", title: "Admin edit" })).status, 200);
});

test("teacher catalog supports the shared layout without exposing access secrets", async () => {
  const f = fixture();
  f.state.tables.courses[0].description = JSON.stringify({ summary: "", passcode: "9999", allowedEmails: ["private@example.test"], sectionPasscodes: { lesson: "5678" }, unlocked: true });
  const result = await f.get();
  const shared = result.data.courses.find(c => c.id === "admin-course");
  assert.equal(shared.status, "active");
  assert.equal(shared.description, "");
  assert.equal(shared.canEdit, false);
  assert.equal(shared.metadata.summary, "");
  assert.equal(shared.passcode, undefined);
  assert.equal(shared.metadata.passcode, undefined);
  assert.equal(shared.metadata.allowedEmails, undefined);
  assert.equal(shared.metadata.sectionPasscodes, undefined);
});

test("folder ownership cannot be forged and mixed folder deletions are rejected before any write", async () => {
  const f = fixture();
  const created = await f.post({ action: "create_folder_group", name: "Own folder", createdBy: "teacher-b" });
  assert.equal(created.data.folderGroups.find(g => g.id === "fg-new").createdBy, "teacher-a");
  f.state.folders.push({ id: "foreign", name: "Foreign", createdBy: "teacher-b", order: 3 });
  const before = JSON.stringify(f.state.folders);
  assert.equal((await f.post({ action: "delete_folder_groups", folderGroupIds: ["fg-new", "foreign"] })).status, 403);
  assert.equal(JSON.stringify(f.state.folders), before);
  f.state.tables.courses.push({ id: "foreign-child", title: "Admin child", status: "active", created_by: null, description: JSON.stringify({ folderGroupId: "fg-new" }) });
  assert.equal((await f.post({ action: "delete_folder_group", id: "fg-new" })).status, 403);
  assert.ok(f.state.tables.courses.some(c => c.id === "foreign-child"));
});


test("hidden owned courses and folders cannot be modified through stale teacher requests", async () => {
  const f = fixture();
  assert.equal((await f.post({ action: "create_course", title: "Owned course", folderGroupId: "fg-ai-agentic" })).status, 200);
  const course = f.state.tables.courses.find(c => c.created_by === "teacher-a");
  assert.ok(course);
  course.description = JSON.stringify({ hidden: true, folderGroupId: "fg-ai-agentic" });
  assert.equal((await f.post({ action: "update_course_title", courseId: course.id, title: "Changed" })).status, 403);
  course.description = JSON.stringify({ folderGroupId: "fg-ai-agentic" });
  f.state.folders.find(group => group.id === "fg-ai-agentic").hidden = true;
  assert.equal((await f.post({ action: "update_course_title", courseId: course.id, title: "Changed" })).status, 403);
});
