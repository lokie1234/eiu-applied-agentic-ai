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
      const data = (table === "courses" ? state.courses : []).filter(row => filters.every(filter => filter(row)));
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
