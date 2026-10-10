import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);

async function page(role, query, options = {}) {
  const access = {
    isActive: true, isAdmin: role === "admin", canFacilitate: role === "facilitator", email: "user@example.test", displayName: "User",
    courses: [
      { id: "core", slug: "applied-agentic-ai", title: "Core", isUnlocked: true },
      { id: "other", slug: "analytics", title: "Analytics", isUnlocked: role !== "learner", sectionTemplates: { lesson: "eiu-business-v1" } },
    ],
    sections: [
      { id: "builtin", courseId: "core", sectionKey: "section1", position: 1, contentType: "builtin" },
      { id: "uploaded", courseId: "other", sectionKey: "lesson", position: 1, contentType: "tsx" },
    ],
  };
  if (options.hiddenCourse) access.courses.find(course => course.id === options.hiddenCourse).hidden = true;
  if (options.hiddenSection) access.sections.find(section => section.id === options.hiddenSection).hidden = true;
  const dependencies = {
    "next/headers": { cookies: async () => ({ get: () => ({ value: options.savedSection }) }) },
    "next/navigation": { redirect: url => { throw new Error(url); } },
    "@/components/LessonPortal": { __esModule: true, default: () => null },
    "@/components/NoCourseAccess": { __esModule: true, default: () => null },
    "@/lib/auth/currentUser": { currentUserAccess: async () => access },
    "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai", isLearningSection: value => ["section1", "section2"].includes(value) },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("app/learn/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name) });
  return (await exports.default({ searchParams: Promise.resolve(query) })).props;
}

test("facilitator View links open another owner's uploaded section and preserve its template selection", async () => {
  const props = await page("facilitator", { courseId: "other", sectionId: "uploaded" });
  assert.equal(props.initialCourseId, "other");
  assert.equal(props.initialSectionId, "uploaded");
  assert.equal(props.initialSection, null);
  assert.equal(props.courseFolders.find(c => c.id === "other").sections[0].templateKey, "eiu-business-v1");
});

test("View links do not grant a learner access to a locked course or select a section in the wrong course", async () => {
  const denied = await page("learner", { courseId: "other", sectionId: "uploaded" });
  assert.equal(denied.initialCourseId, undefined);
  assert.equal(denied.initialSectionId, undefined);
  const mismatched = await page("facilitator", { courseId: "core", sectionId: "uploaded" });
  assert.equal(mismatched.initialCourseId, "core");
  assert.equal(mismatched.initialSectionId, undefined);
});

test("View links still open built-in platform sections", async () => {
  const props = await page("admin", { courseId: "core", sectionId: "builtin" });
  assert.equal(props.initialSection, "section1");
});

test("learner and teaching logins start at the folder chooser despite an old active-section cookie", async () => {
  for (const role of ["learner", "facilitator"]) {
    const props = await page(role, {}, { savedSection: "section1" });
    assert.equal(props.initialSection, null);
    assert.equal(props.initialCourseId, undefined);
    assert.equal(props.initialSectionId, undefined);
    assert.ok(props.courseFolders.length);
  }
});

test("hidden content remains unavailable to learner and facilitator deep links", async () => {
  for (const role of ["learner", "facilitator"]) {
    const courseHidden = await page(role, { courseId: "core", sectionId: "builtin" }, { hiddenCourse: "core" });
    assert.equal(courseHidden.courseFolders.some(course => course.id === "core"), false);
    assert.equal(courseHidden.initialCourseId, undefined);
    const props = await page(role, { courseId: "core", sectionId: "builtin" }, { hiddenSection: "builtin" });
    assert.equal(props.courseFolders.some(course => course.sections.some(section => section.id === "builtin")), false);
    assert.equal(props.initialSection, null);
    assert.equal(props.initialSectionId, undefined);
  }
});

test("admin View links open hidden built-in and uploaded sections without changing visibility", async () => {
  for (const [courseId, sectionId, expectedBuiltin] of [["core", "builtin", "section1"], ["other", "uploaded", null]]) {
    for (const options of [{hiddenCourse:courseId}, {hiddenSection:sectionId}, {hiddenCourse:courseId, hiddenSection:sectionId}]) {
      const props = await page("admin", {courseId, sectionId}, options);
      assert.equal(props.initialCourseId, courseId);
      assert.equal(props.initialSectionId, sectionId);
      assert.equal(props.initialSection, expectedBuiltin);
      const course = props.courseFolders.find(item => item.id === courseId);
      assert.equal(Boolean(course.hidden), Boolean(options.hiddenCourse));
      assert.equal(Boolean(course.sections.find(item => item.id === sectionId).hidden), Boolean(options.hiddenSection));
    }
  }
});

test("admin catalog still hides content unless a matching section View link is provided", async () => {
  const catalog = await page("admin", {}, {hiddenCourse:"core", hiddenSection:"uploaded"});
  assert.equal(catalog.courseFolders.some(course => course.id === "core"), false);
  assert.equal(catalog.courseFolders.some(course => course.sections.some(section => section.id === "uploaded")), false);
  const mismatched = await page("admin", {courseId:"core",sectionId:"uploaded"}, {hiddenCourse:"core",hiddenSection:"uploaded"});
  assert.equal(mismatched.initialCourseId, undefined);
  assert.equal(mismatched.initialSectionId, undefined);
  assert.equal(mismatched.courseFolders.some(course => course.id === "core"), false);
});
