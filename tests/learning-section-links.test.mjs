import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);

async function page(role, query) {
  const access = {
    isActive: true, isAdmin: role === "admin", isTeacher: role === "teacher", email: "user@example.test", displayName: "User",
    courses: [
      { id: "core", slug: "applied-agentic-ai", title: "Core", isUnlocked: true },
      { id: "other", slug: "analytics", title: "Analytics", isUnlocked: role !== "learner", sectionTemplates: { lesson: "eiu-business-v1" } },
    ],
    sections: [
      { id: "builtin", courseId: "core", sectionKey: "section1", position: 1, contentType: "builtin" },
      { id: "uploaded", courseId: "other", sectionKey: "lesson", position: 1, contentType: "tsx" },
    ],
  };
  const dependencies = {
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
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

test("teacher View links open another owner's uploaded section and preserve its template selection", async () => {
  const props = await page("teacher", { courseId: "other", sectionId: "uploaded" });
  assert.equal(props.initialCourseId, "other");
  assert.equal(props.initialSectionId, "uploaded");
  assert.equal(props.initialSection, null);
  assert.equal(props.courseFolders.find(c => c.id === "other").sections[0].templateKey, "eiu-business-v1");
});

test("View links do not grant a learner access to a locked course or select a section in the wrong course", async () => {
  const denied = await page("learner", { courseId: "other", sectionId: "uploaded" });
  assert.equal(denied.initialCourseId, undefined);
  assert.equal(denied.initialSectionId, undefined);
  const mismatched = await page("teacher", { courseId: "core", sectionId: "uploaded" });
  assert.equal(mismatched.initialCourseId, "core");
  assert.equal(mismatched.initialSectionId, undefined);
});

test("View links still open built-in platform sections", async () => {
  const props = await page("admin", { courseId: "core", sectionId: "builtin" });
  assert.equal(props.initialSection, "section1");
});
