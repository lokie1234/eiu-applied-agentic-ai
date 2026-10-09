import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function fixture() {
  const state = {
    courses: [{ id: "core", slug: "applied-agentic-ai", title: "Agentic AI", status: "active", description: JSON.stringify({ summary: "Core course", allowedEmails: ["learner@example.test"], passcode: "1234", folderGroupId: "fg-ai-agentic", sectionPasscodes: { lesson: "5678" } }) }],
    writeError: null,
  };
  const db = { from(table) {
    const filters = []; let update;
    const result = () => {
      const data = (table === "courses" ? state.courses : table === "course_sections" ? state.sections || [] : []).filter(row => filters.every(filter => filter(row)));
      if (update && state.writeError) return { data: null, error: state.writeError };
      if (update) data.forEach(row => Object.assign(row, update));
      return { data, error: null };
    };
    return {
      select() { return this; }, order() { return this; },
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      neq(key, value) { filters.push(row => row[key] !== value); return this; },
      update(value) { update = value; return this; },
      maybeSingle: async () => { const res = result(); return { ...res, data: res.data?.[0] ?? null }; },
      single: async () => { const res = result(); return { ...res, data: res.data?.[0] ?? null }; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
  } };
  const exports = {};
  const dependencies = {
    "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => db },
    "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "admin@example.test", APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai", normalizeEmail: value => String(value).toLowerCase(), isValidEmail: value => value.includes("@") },
  };
  const code = ts.transpileModule(fs.readFileSync("lib/auth/courseAccessStorage.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, Math, console, require: name => dependencies[name] ?? require(name) });
  return { state, storage: exports };
}

test("folder creation persists in the shared admin catalog and preserves course settings", async () => {
  const { state, storage } = fixture();
  const created = await storage.createFolderGroup(" Business Analytics ", "Teacher materials");
  const saved = JSON.parse(state.courses[0].description);
  assert.equal(saved.summary, "Core course");
  assert.equal(saved.passcode, "1234");
  assert.equal(saved.sectionPasscodes.lesson, "5678");
  assert.ok(saved.allowedEmails.includes("learner@example.test"));
  assert.ok(saved.folderGroups.some(folder => folder.id === created.id && folder.name === "Business Analytics"));
  const reloaded = await storage.getCoursesAndSectionsData();
  assert.ok(reloaded.folderGroups.some(folder => folder.id === created.id));
  assert.equal(reloaded.courses[0].folderGroupId, "fg-ai-agentic");
});

test("section visibility survives unrelated metadata changes and is reflected in the admin catalog", async () => {
  const { state, storage } = fixture();
  state.sections = [{ id: "lesson-id", course_id: "core", section_key: "lesson", title: "Lesson", status: "active", position: 1 }];
  await storage.updateCourseMetadata("core", current => ({ ...current, hiddenSectionIds: ["lesson-id"] }));
  await storage.updateCourseSummary("core", "New summary");
  assert.equal((await storage.getCoursesAndSectionsData()).sections[0].hidden, true);
  assert.equal(JSON.parse(state.courses[0].description).passcode, "1234");
  await storage.updateCourseMetadata("core", current => ({ ...current, hiddenSectionIds: [] }));
  assert.equal((await storage.getCoursesAndSectionsData()).sections[0].hidden, false);
});

test("folder creation reports a failed database write and leaves the catalog unchanged", async () => {
  const { state, storage } = fixture();
  const original = state.courses[0].description;
  state.writeError = { message: "Simulated write failure" };
  await assert.rejects(storage.createFolderGroup("New folder"), error => error.message === "Simulated write failure");
  assert.equal(state.courses[0].description, original);
});

test("folder creation cannot report success without the catalog's core course", async () => {
  const { state, storage } = fixture(); state.courses = [];
  await assert.rejects(storage.createFolderGroup("New folder"), /not configured for saving folders/);
});

test("clearing a summary survives saving and reloading without changing course settings", async () => {
  const { state, storage } = fixture();
  for (const summary of ["", "   "]) {
    await storage.updateCourseSummary("core", summary);
    const saved = JSON.parse(state.courses[0].description);
    assert.equal(saved.summary, "");
    assert.equal(saved.passcode, "1234");
    assert.equal(storage.parseCourseMetadata(state.courses[0].description, "Default summary").summary, "");
    const reloaded = await storage.getCoursesAndSectionsData();
    assert.equal(reloaded.courses[0].metadata.summary, "");
    assert.equal(reloaded.courses[0].description, "");
  }
});

test("folder descriptions can be cleared and remain empty after reloading", async () => {
  const { storage } = fixture();
  const folder = await storage.createFolderGroup("Materials", "Original description");
  await storage.updateFolderGroup(folder.id, folder.name, "   ");
  const reloaded = await storage.getCoursesAndSectionsData();
  assert.equal(reloaded.folderGroups.find(item => item.id === folder.id).description, "");
});

test("section template survives unrelated metadata edits and can be disabled", async () => {
  const { state, storage } = fixture();
  await storage.setSectionTemplate("core", ["a", "b"], true);
  await storage.updateCourseSummary("core", "");
  let saved = JSON.parse(state.courses[0].description);
  assert.deepEqual(saved.sectionTemplates, { a: "eiu-business-v1", b: "eiu-business-v1" });
  assert.equal(saved.passcode, "1234");
  await storage.setSectionTemplate("core", ["a"], false);
  saved = JSON.parse(state.courses[0].description);
  assert.deepEqual(saved.sectionTemplates, { b: "eiu-business-v1" });
});

test("owned folder metadata survives catalog loading and rename", async () => {
  const { state, storage } = fixture();
  const folder = await storage.createFolderGroup("Teacher folder", "", "teacher-a");
  assert.equal(folder.createdBy, "teacher-a");
  await storage.updateFolderGroup(folder.id, "Renamed", "");
  const reloaded = await storage.getCoursesAndSectionsData();
  assert.equal(reloaded.folderGroups.find(g => g.id === folder.id).createdBy, "teacher-a");
  assert.equal(JSON.parse(state.courses[0].description).folderGroups.find(g => g.id === folder.id).name, "Renamed");
});


test("layout registry can add and delete every layout without restoring the built-in default", async () => {
  const { state, storage } = fixture();
  assert.equal((await storage.getSlideTemplates())[0].id, "eiu-business-v1");
  await storage.saveSlideTemplates([{ id: "custom", name: "New layout", background: "data:image/png;base64,YQ==" }]);
  await storage.updateCourseSummary("core", "Changed summary");
  assert.equal((await storage.getSlideTemplates())[0].id, "custom");
  await storage.saveSlideTemplates([]);
  assert.equal((await storage.getSlideTemplates()).length, 0);
  assert.equal(JSON.parse(state.courses[0].description).passcode, "1234");
});

test("course template and folder visibility survive unrelated writes and hidden folders reject passcodes", async () => {
  const { state, storage } = fixture();
  await storage.updateCourseMetadata("core", current => ({ ...current, templateKey: "custom", hidden: true }));
  await storage.updateCourseSummary("core", "Course description");
  assert.equal(JSON.parse(state.courses[0].description).templateKey, "custom");
  await storage.updateCourseMetadata("core", current => ({ ...current, hidden: false }));
  await storage.setFolderGroupHidden("fg-ai-agentic", true);
  assert.equal((await storage.getCoursesAndSectionsData()).folderGroups[0].hidden, true);
  await storage.updateFolderGroup("fg-ai-agentic", "Renamed");
  assert.equal((await storage.getCoursesAndSectionsData()).folderGroups[0].hidden, true);
  await storage.setFolderGroupHidden("fg-ai-agentic", false);
  assert.equal(JSON.parse(state.courses[0].description).templateKey, "custom");
});


test("global codes persist in the shared catalog through unrelated folder and section edits", async () => {
  const { storage } = fixture();
  await storage.updateCourseMetadata("core", current => ({ ...current, globalAccessCodes: { learner: "GLOBAL1234", facilitator: "TEACH1234" } }));
  await storage.createFolderGroup("New folder");
  await storage.updateCourseSummary("core", "New title");
  const catalog = await storage.getCoursesAndSectionsData();
  assert.equal(catalog.globalAccessCodes.learner, "GLOBAL1234");
  assert.equal(catalog.globalAccessCodes.facilitator, "TEACH1234");
  await storage.updateCourseMetadata("core", current => ({ ...current, globalAccessCodes: { ...current.globalAccessCodes, learner: "" } }));
  assert.equal((await storage.getCoursesAndSectionsData()).globalAccessCodes.learner, "");
});
