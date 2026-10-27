import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => dependencies[name] ?? (
      name === "@/lib/learningIdentity" ? load("lib/learningIdentity.ts") :
      name === "@/lib/reportLearners" ? load("lib/reportLearners.ts") :
      name === "@/lib/reportScopes" ? load("lib/reportScopes.ts") :
      name === "@/lib/courseHierarchy" ? load("lib/courseHierarchy.ts") :
      name === "@/lib/auth/adminPassword" ? load("lib/auth/adminPassword.ts", { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) } }) :
      name === "@/lib/auth/types" ? load("lib/auth/types.ts") :
      require(name)
    ),
    Buffer, console, Date, process, URL, Response
  });
  return exports;
}
const response = { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set(name, value) { this.value = value; } } }) } };
const request = body => ({ json: async () => body, headers: new Headers() });

test("learner sheets combine login scopes, repeated actions and older participants without duplicates", () => {
  const { collectReportLearners } = load("lib/reportLearners.ts");
  const details = { sessionId: "one", name: "Alice", email: "alice@example.test", information: { department: "IT" } };
  const logs = [
    { action: "PASSCODE_LOGIN", created_at: "2026-10-09T01:00:00Z", details: { ...details, sectionKeys: ["section1", "section2"] } },
    { action: "QUIZ_COMPLETED", created_at: "2026-10-09T02:00:00Z", details: { ...details, section: "section2" } },
    { action: "FEEDBACK_SUBMITTED", created_at: "2026-10-09T03:00:00Z", details: { ...details, section: "section2" } },
    { action: "PASSCODE_LOGIN", details: { ...details, sessionId: "teacher", accessMode: "facilitator", sectionKeys: ["section2"] } },
  ];
  const rows = collectReportLearners([{ section: "section2", name: "Alice", email: "alice@example.test" }], logs, [{ section: "section2", name: "Bob", email: "bob@example.test", completed_at: "2026-10-08T01:00:00Z" }]);
  assert.equal(rows.length, 3); assert.equal(rows.filter(row => row.name === "Alice").length, 2);
  const section2 = rows.find(row => row.sessionId === "one" && row.section === "section2");
  assert.equal(section2.information.department, "IT"); assert.equal(section2.created_at, "2026-10-09T01:00:00Z"); assert.equal(section2.updated_at, "2026-10-09T03:00:00Z");
  assert.ok(rows.some(row => row.name === "Bob")); assert.ok(!rows.some(row => row.sessionId === "teacher"));
});

test("number fields preserve inclusive limits and reject invalid or out-of-range input", () => {
  const identity = load("lib/learningIdentity.ts");
  const policy = identity.parseIdentityPolicy({ enabled: true, fields: [{ id: "age", label: "Age", type: "number", min: 18, max: 65 }] });
  assert.equal(policy.fields[0].min, 18); assert.equal(policy.fields[0].max, 65);
  for (const value of ["18", "65", "20.5"]) assert.equal(identity.validateIdentityInformation(policy, { age: value }).values.age, value);
  for (const value of ["17", "66", "Infinity", "0x20", "NaN", "", "text", "1e999"]) assert.ok(identity.validateIdentityInformation(policy, { age: value }).error, value);
  for (const limits of [{ min: 10, max: 2 }, { min: Infinity }, { max: "65" }]) assert.equal(identity.parseIdentityPolicy({ fields: [{ id: "age", label: "Age", type: "number", ...limits }] }).fields.length, 0);
  const unlimited = identity.parseIdentityPolicy({ fields: [{ id: "value", label: "Value", type: "number" }] });
  assert.equal(identity.validateIdentityInformation(unlimited, { value: "-1.25" }).values.value, "-1.25");
});

test("learning sign-in requires configured fields, ignores spoofed identity, and excludes Teaching", async () => {
  const f = fixture();
  f.catalog.learningIdentityPolicy = { enabled: true, fields: [{ id: "name", label: "Name", type: "text" }, { id: "email", label: "Email", type: "email" }, { id: "department", label: "Department", type: "text" }] };
  const logs = [];
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, contains() { return this; }, gte: async () => ({ count: 0 }), insert(row) { logs.push(row); return this; }, single: async () => ({ data: { id: logs.length } }) }) };
  const auth = load("app/api/auth/access/route.ts", { "next/server": response, "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "@/lib/auth/courseAccessStorage": f.storage, "@/lib/auth/passcodes": f.codes, "@/lib/auth/session": { ACCESS_SESSION_COOKIE: "session", createAccessSession: body => body, sessionCookieOptions: () => ({}) } });
  const required = await auth.POST(request({ passcode: "CL01234", role: "admin" }));
  assert.equal(required.data.requiresInformation, true); assert.equal(required.cookies.value, undefined); assert.equal(logs.length, 0);
  assert.equal((await auth.POST(request({ passcode: "CL01234", information: { name: "Alice", email: "bad", department: "IT" } }))).status, 400);
  assert.equal((await auth.POST(request({ passcode: "CL01234", information: { name: "Alice", email: "alice@example.test" } }))).status, 400);
  const signed = await auth.POST(request({ passcode: "CL01234", sessionId: "spoofed", information: { name: " Alice ", email: "Alice@Example.test", department: "IT", admin: "true" } }));
  assert.equal(signed.data.success, true); assert.equal(signed.cookies.value.identityLogId, 1);
  assert.notEqual(signed.cookies.value.sessionId, "spoofed"); assert.equal(signed.cookies.value.role, "passcode");
  assert.equal(logs[0].details.name, "Alice"); assert.equal(logs[0].details.email, "alice@example.test"); assert.equal(logs[0].details.information.department, "IT"); assert.equal(logs[0].details.information.admin, undefined);
  assert.equal((await auth.POST(request({ passcode: "CT01234" }))).data.success, true);
  f.catalog.learningIdentityPolicy.enabled = false;
  assert.equal((await auth.POST(request({ passcode: "CL01234" }))).data.success, true);
});

test("the signed session loads its stored identity and cannot use another session's profile", async () => {
  const f = fixture();
  const session = { role: "passcode", credentialHash: f.codes.hashPasscode("CL01234"), sessionId: "session-one", identityLogId: 1 };
  const identity = { sessionId: "session-one", name: "Alice", email: "alice@example.test", information: { department: "IT" } };
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { details: identity } }) }) };
  const access = load("lib/auth/currentUser.ts", { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "./session": { currentAccessSession: async () => session }, "./courseAccessStorage": f.storage, "./passcodes": f.codes, "./types": { FIXED_ADMIN_EMAIL: "admin@example.test" } });
  const user = await access.currentUserAccess();
  assert.equal(user.displayName, "Alice"); assert.equal(user.email, "alice@example.test"); assert.equal(user.learnerIdentity.information.department, "IT"); assert.equal(user.isAdmin, false);
  identity.sessionId = "other-session";
  assert.equal(await access.currentUserAccess(), null);
});

test("submitted activity retains the original session, extra information and record ID", async () => {
  let saved;
  const activity = load("lib/learnerActivity.ts", { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ insert: async row => { saved = row; return {}; } }) }) } });
  for (const action of ["IDEA_SUBMITTED", "SHOWCASE_SUBMITTED", "QUIZ_COMPLETED", "FEEDBACK_SUBMITTED"]) {
    await activity.recordLearnerActivity({ sessionId: "one", name: "Alice", email: "alice@example.test", information: { department: "IT" } }, action, "section2", "record-one");
    assert.equal(saved.action, action); assert.equal(saved.details.sessionId, "one"); assert.equal(saved.details.recordId, "record-one"); assert.equal(saved.details.information.department, "IT");
  }
});

test("submission endpoints use server identity for both the record and its activity", async () => {
  for (const [route, action, section, body] of [
    ["ideas", "IDEA_SUBMITTED", "section1", { idea: "New app" }],
    ["showcase", "SHOWCASE_SUBMITTED", "section2", { url: "https://example.test/app" }],
    ["quiz-results", "QUIZ_COMPLETED", "section2", { score: 10, total: 10, answers: Array.from({ length: 10 }, () => ({ question: "Q", selected: "A", correct: "A", isCorrect: true })) }],
    ["quiz-feedback", "FEEDBACK_SUBMITTED", "section2", { feedback: "Useful lesson" }],
  ]) {
    let record, activity;
    const identity = { sessionId: "learner-session", name: "Alice", email: "alice@example.test", information: { department: "IT" } };
    const db = { from: () => ({ insert(row) { record = row; return this; }, select() { return this; }, single: async () => ({ data: { ...record, id: "saved-record", shared_at: new Date().toISOString() } }) }) };
    const endpoint = load(`app/api/${route}/route.ts`, { "next/server": response, "@/lib/quizProgress": { readQuizProgress: async () => null }, "@/lib/auth/currentUser": { currentUserAccess: async () => ({ isActive: true }) }, "@/lib/currentRole": { currentRole: async () => section }, "@/lib/currentLearnerProfile": { currentLearnerProfile: async () => ({ name: identity.name, email: identity.email, section, identity }) }, "@/lib/sectionSession": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "@/lib/learnerActivity": { recordLearnerActivity: async (...args) => { activity = args; } } });
    const result = await endpoint.POST(request({ ...body, section, name: "Fake", email: "fake@example.test", information: { department: "Fake" } }));
    assert.equal(result.data.success, true, route); assert.equal(record.name, "Alice"); assert.equal(record.email, "alice@example.test");
    if (route === "quiz-results") { assert.equal(result.data.learner.name, "Alice"); assert.equal(result.data.learner.email, "alice@example.test"); assert.equal(result.data.learner.information.department, "IT"); }
    assert.equal(activity[0].information.department, "IT"); assert.equal(activity[1], action); assert.equal(activity[2], section); assert.equal(activity[3], "saved-record");
  }
});

test("activity report removes identifiers and email outside learner sheets and formats local times", async () => {
  const ExcelJS = require("exceljs");
  const records = { section_state: [{ section: "section2" }], feedback: [{ id: "record-one", section: "section2", name: "Alice", email: "alice@example.test", feedback: "Useful" }], access_audit_logs: [{ action: "FEEDBACK_SUBMITTED", created_at: "2026-10-09T12:08:09.536Z", details: { sessionId: "session-one", section: "section2", recordId: "record-one", name: "Alice", email: "alice@example.test", information: { department: "IT" }, fields: [{ id: "department", label: "Department" }] } }] };
  const db = { from: table => ({ select() { return this; }, order() { return this; }, range: async () => ({ data: records[table] || [] }) }) };
  const report = load("app/api/admin/report/route.ts", { exceljs: { default: ExcelJS }, "@/lib/currentRole": { currentRole: async () => "admin" }, "@/lib/supabase/server": { getSupabaseAdmin: () => db } });
  const response = await report.GET(new Request("http://localhost/api/admin/report?section=section2"));
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const sheet = workbook.getWorksheet("Learner activity");
  assert.equal(sheet.getCell("A2").value, "Alice"); assert.equal(sheet.getCell("D2").value, "Department: IT");
  assert.equal(sheet.getCell("E2").value, "09/10/2026 19:08:09");
  assert.equal(workbook.getWorksheet("S2 - Feedback").getCell("A2").value, "Alice");
  const learners = workbook.getWorksheet("S2 - Hoc vien");
  assert.equal(learners.getCell("A2").value, "Alice"); assert.equal(learners.getCell("B2").value, "alice@example.test"); assert.equal(learners.getCell("C2").value, "Department: IT");
  for (const worksheet of workbook.worksheets) {
    const headers = worksheet.getRow(1).values.join("|");
    assert.doesNotMatch(headers, /Session ID|Record ID|UTC/);
    if (!worksheet.name.endsWith("Hoc vien")) assert.doesNotMatch(headers, /Email/);
  }
});
function fixture() {
  const catalog = {
    folderGroups: [{ id: "f1", name: "First", accessCodes: { learner: "FL1234", facilitator: "FT1234" } }, { id: "f2", name: "Other" }],
    courses: ["c1", "c2", "c3"].map((id, index) => ({ id, slug: index ? id : "applied-agentic-ai", status: "active", folderGroupId: index === 2 ? "f2" : "f1", metadata: { summary: "Course", passcode: `CL${index}1234`, facilitatorPasscode: `CT${index}1234`, sectionAccessCodes: index ? {} : { s1: { learner: "SL1234", facilitator: "ST1234" } } } })),
    sections: ["s1", "s2", "s3", "s4"].map((id, index) => ({ id, status: "active", course_id: index < 2 ? "c1" : index === 2 ? "c2" : "c3", section_key: index ? "section2" : "section1" })),
  };
  const storage = {
    getCoursesAndSectionsData: async () => catalog,
    updateCourseMetadata: async (id, update) => { const course = catalog.courses.find(c => c.id === id); course.metadata = update(course.metadata); },
    saveFolderGroups: async groups => { catalog.folderGroups = groups; },
  };
  const codes = load("lib/auth/passcodes.ts", { "server-only": {}, "./courseAccessStorage": storage, "./types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai" } });
  return { catalog, codes, storage, resolve: code => codes.resolvePasscode(catalog, codes.hashPasscode(code)) };
}

test("folder and course codes grant their access type to all descendant sections", () => {
  const f = fixture();
  for (const [code, ids, teaching] of [["FL1234", "s1,s2,s3", false], ["FT1234", "s1,s2,s3", true], ["CL01234", "s1,s2", false], ["CT01234", "s1,s2", true]]) {
    const result = f.resolve(code);
    assert.equal(result.sections.map(s => s.id).join(","), ids);
    assert.ok(result.sections.every(s => s.canFacilitate === teaching));
  }
  assert.equal(f.resolve("incorrect"), null);
  assert.equal(f.resolve("SL1234"), null);
  assert.equal(f.resolve("ST1234"), null);
});

test("hidden, draft and archived content is excluded even with a valid parent code", () => {
  const f = fixture(); f.catalog.courses[1].metadata.hidden = true; f.catalog.sections[1].status = "draft";
  assert.equal(f.resolve("FT1234").sections.map(s => s.id).join(","), "s1");
  f.catalog.folderGroups[0].hidden = true;
  assert.equal(f.resolve("FT1234"), null);
});

test("changing or clearing a code revokes it, preserves the other code and rejects cross-scope duplicates", async () => {
  const f = fixture();
  await f.codes.saveAccessPasscode({ kind: "course", id: "c1" }, "facilitator", "NEW1234");
  assert.equal(f.resolve("CT01234"), null);
  assert.ok(f.resolve("NEW1234").sections[0].canFacilitate);
  assert.ok(f.resolve("CL01234"));
  await assert.rejects(f.codes.saveAccessPasscode({ kind: "course", id: "c2" }, "learner", "NEW1234"), /already used/);
  await f.codes.saveAccessPasscode({ kind: "course", id: "c1" }, "facilitator", "");
  assert.equal(f.resolve("NEW1234"), null);
  const generated = await f.codes.saveAccessPasscode({ kind: "folder", id: "f1" }, "facilitator", null);
  assert.match(generated, /^\d{6}$/);
  assert.equal(f.resolve("FT1234"), null);
  assert.equal(f.resolve(generated).sections.length, 3);
  await assert.rejects(f.codes.saveAccessPasscode({ kind: "section", id: "missing" }, "learner", "1234"), /no longer exists/);
});

test("ambiguous old codes cannot elevate a learner into a facilitator", () => {
  const f = fixture(); f.catalog.courses[1].metadata.facilitatorPasscode = "CL01234";
  assert.equal(f.resolve("CL01234"), null);
});

test("hiding a section removes it from folder and course access", () => {
  const f = fixture(); f.catalog.courses[0].metadata.hiddenSectionIds = ["s1"];
  assert.equal(f.resolve("CL01234").sections.map(s => s.id).join(","), "s2");
  for (const code of ["FL1234", "FT1234", "CL01234", "CT01234"])
    assert.equal(f.resolve(code).sections.some(section => section.id === "s1"), false);
  f.catalog.courses[0].metadata.hiddenSectionIds = [];
  assert.equal(f.resolve("CT01234").sections[0].id, "s1");
});

test("admin section visibility changes preserve access codes and invalidate the learning page", async () => {
  const f = fixture(); let actor = { isAdmin: true }; let invalidations = 0;
  const admin = load("app/api/admin/access/route.ts", {
    "next/server": response, "next/cache": { revalidatePath: path => { assert.equal(path, "/learn"); invalidations++; } },
    "@/lib/auth/currentUser": { requireCourseManager: async () => actor },
    "@/lib/auth/types": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => ({}) },
    "@/lib/auth/courseAccessStorage": f.storage, "@/lib/auth/passcodes": f.codes,
  });
  assert.equal((await admin.POST(request({ action: "set_section_hidden", sectionId: "s1", hidden: true }))).status, 200);
  assert.equal(f.resolve("CT01234").sections.some(s => s.id === "s1"), false);
  assert.equal(f.catalog.courses[0].metadata.facilitatorPasscode, "CT01234");
  assert.equal((await admin.POST(request({ action: "set_section_hidden", sectionId: "s1", hidden: false }))).status, 200);
  assert.ok(f.resolve("CT01234")); assert.equal(invalidations, 2);
  assert.equal((await admin.POST(request({ action: "set_section_hidden", sectionId: "missing", hidden: true }))).status, 404);
  actor = null;
  assert.equal((await admin.POST(request({ action: "set_section_hidden", sectionId: "s1", hidden: true }))).status, 403);
});

test("facilitators cannot access administration or modify course content, and revoked sessions stop resolving", async () => {
  const f = fixture(); const session = { role: "passcode", credentialHash: f.codes.hashPasscode("CT01234"), sessionId: "first-learner" };
  const access = load("lib/auth/currentUser.ts", { "server-only": {}, "@/lib/supabase/server": {}, "./session": { currentAccessSession: async () => session }, "./courseAccessStorage": f.storage, "./passcodes": f.codes, "./types": { FIXED_ADMIN_EMAIL: "admin@example.test" } });
  const user = await access.currentUserAccess();
  assert.equal(user.isAdmin, false); assert.equal(user.canFacilitate, true);
  assert.equal(user.sections.length, 2); assert.equal(user.courses[0].passcode, undefined);
  assert.equal(await access.requireAdminAccess(), null);
  assert.equal(await access.requireCourseManager(), null);
  assert.equal(await access.canManageSection("s1"), false);
  const admin = load("app/api/admin/access/route.ts", { "next/server": response, "next/cache": {}, "@/lib/auth/currentUser": access, "@/lib/auth/types": {}, "@/lib/supabase/server": { getSupabaseAdmin() { throw Error("Forbidden storage"); } }, "@/lib/auth/courseAccessStorage": {}, "@/lib/auth/passcodes": {} });
  for (const action of ["set_access_passcode", "create_course", "create_section", "delete_course", "set_course_hidden"])
    assert.equal((await admin.POST(request({ action }))).status, 403);
  f.catalog.courses[0].metadata.facilitatorPasscode = "rotated";
  assert.equal(await access.currentUserAccess(), null);
});

test("only teaching permission in Applied Agentic AI grants access to its shared interactions", async () => {
  const user = { isActive: true, isAdmin: false, courses: [{ id: "core", slug: "applied-agentic-ai" }, { id: "other", slug: "other" }], sections: [{ courseId: "core", sectionKey: "section1", canFacilitate: true }, { courseId: "other", sectionKey: "section2", canFacilitate: true }] };
  const roles = load("lib/currentRole.ts", { "server-only": {}, "next/headers": {}, "@/lib/auth/currentUser": { currentUserAccess: async () => user }, "@/lib/auth/types": { APPLIED_AGENTIC_AI_SLUG: "applied-agentic-ai", isLearningSection: s => ["section1", "section2"].includes(s) } });
  assert.equal(await roles.canFacilitateSection("section1"), true);
  assert.equal(await roles.canFacilitateSection("section2"), false);
  let writes = 0;
  const quiz = load("app/api/quiz-control/route.ts", { "next/server": response, "@/lib/auth/currentUser": { currentUserAccess: async () => user }, "@/lib/currentLearnerProfile": {}, "@/lib/quizProgress": {}, "@/lib/currentRole": roles, "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ upsert: async () => { writes++; return {}; } }) }) } });
  assert.equal((await quiz.POST(request({ section: "section2" }))).status, 403);
  assert.equal(writes, 0);
  assert.equal((await quiz.POST(request({ section: "section1" }))).status, 200);
  assert.equal(writes, 1);
  user.sections[0].canFacilitate = false;
  assert.equal((await quiz.POST(request({ section: "section1" }))).status, 403);
});

test("signed sessions reject old username, teacher and password admin tokens", async () => {
  const previous = process.env.PASSCODE_SESSION_SECRET; process.env.PASSCODE_SESSION_SECRET = "test-only-passcode-session-key";
  let cookie;
  try {
    const session = load("lib/auth/session.ts", { "server-only": {}, "next/headers": { cookies: async () => ({ get: () => ({ value: cookie }) }) }, "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { session_version: 0 } }) }) }) } });
    const sign = body => { const payload = Buffer.from(JSON.stringify({ ...body, expiresAt: Date.now() + 10000 })).toString("base64url"); return `${payload}.${createHmac("sha256", process.env.PASSCODE_SESSION_SECRET).update(payload).digest("base64url")}`; };
    for (const role of ["email", "teacher", "admin"]) { cookie = sign({ role }); assert.equal(await session.currentAccessSession(), null); }
    cookie = session.createAccessSession({ role: "admin", authMethod: "google" }); assert.equal((await session.currentAccessSession()).role, "admin");
    cookie = session.createAccessSession({ role: "admin", authMethod: "password" }); assert.equal((await session.currentAccessSession()).role, "admin");
    cookie = sign({ role: "passcode", credentialHash: "a".repeat(64), sessionId: "a2135578-52ec-4e53-8b8f-f3369e606348" });
    assert.equal((await session.currentAccessSession()).role, "passcode");
    cookie += "tamper"; assert.equal(await session.currentAccessSession(), null);
  } finally { if (previous === undefined) delete process.env.PASSCODE_SESSION_SECRET; else process.env.PASSCODE_SESSION_SECRET = previous; }
});

test("passcode login rejects usernames, rate-limits failures and gives each learner a distinct identity", async () => {
  const f = fixture(); let failures = 0; let audit;
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, contains() { return this; }, gte: async () => ({ count: failures }), insert(row) { audit = row; if (row.action === "PASSCODE_LOGIN_FAILED") failures++; return this; }, single: async () => ({ data: { id: 1 } }) }) };
  const auth = load("app/api/auth/access/route.ts", { "next/server": response, "@/lib/supabase/server": { getSupabaseAdmin: () => db }, "@/lib/auth/courseAccessStorage": f.storage, "@/lib/auth/passcodes": f.codes, "@/lib/auth/session": { ACCESS_SESSION_COOKIE: "session", createAccessSession: body => body, sessionCookieOptions: () => ({}) } });
  assert.equal((await auth.POST(request({ email: "old@example.test" }))).status, 400);
  const first = await auth.POST(request({ passcode: "CL01234" }));
  const second = await auth.POST(request({ passcode: "CL01234" }));
  assert.equal(first.status, 200); assert.equal(first.data.destination, "/learn");
  assert.notEqual(first.cookies.value.sessionId, second.cookies.value.sessionId);
  assert.equal(first.cookies.value.passcode, undefined); assert.equal(first.cookies.value.role, "passcode");
  assert.equal((await auth.POST(request({ passcode: "BAD1234" }))).status, 401);
  assert.equal(audit.details.passcode, undefined);
  failures = 10; assert.equal((await auth.POST(request({ passcode: "CL01234" }))).status, 429);
});


test("global codes bypass local locks, preserve roles and exclude hidden content", async () => {
  const f = fixture();
  f.catalog.globalAccessCodes = { learner: "GL1234", facilitator: "GT1234" };
  assert.equal(f.resolve("GL1234").sections.length, 4);
  assert.ok(f.resolve("GL1234").sections.every(s => !s.canFacilitate));
  assert.ok(f.resolve("GT1234").sections.every(s => s.canFacilitate));
  f.catalog.folderGroups[1].hidden = true;
  f.catalog.courses[0].metadata.hiddenSectionIds = ["s1"];
  assert.equal(f.resolve("GT1234").sections.map(s => s.id).join(","), "s2,s3");
  await assert.rejects(f.codes.saveAccessPasscode({ kind: "global", id: "all" }, "learner", "CT01234"), /already used/);
  await f.codes.saveAccessPasscode({ kind: "global", id: "all" }, "learner", "NEWGLOBAL");
  assert.equal(f.catalog.courses[0].metadata.globalAccessCodes.learner, "NEWGLOBAL");
});

test("free access inherits parent Learning locks and never grants Teaching", () => {
  const f = fixture();
  assert.equal(f.codes.resolveFreeAccess(f.catalog), null);
  f.catalog.courses[2].metadata.passcode = "";
  let free = f.codes.resolveFreeAccess(f.catalog);
  assert.equal(free.sections.map(s => s.id).join(","), "s4");
  assert.ok(free.sections.every(s => !s.canFacilitate));
  const teaching = f.resolve("CT01234");
  assert.equal(teaching.sections.find(s => s.id === "s4").canFacilitate, false);
  assert.equal(f.resolve("BADCODE"), null);
  f.catalog.courses[0].metadata.passcode = "";
  f.catalog.courses[0].metadata.sectionAccessCodes = {};
  assert.equal(f.codes.resolveFreeAccess(f.catalog).sections.length, 1);
  f.catalog.folderGroups[0].accessCodes.learner = "";
  assert.equal(f.codes.resolveFreeAccess(f.catalog).sections.map(s => s.id).join(","), "s1,s2,s4");
  f.catalog.courses[2].metadata.passcode = "LOCK1234";
  assert.equal(f.codes.resolveFreeAccess(f.catalog).sections.some(s => s.id === "s4"), false);
});

test("free entrance creates separate learner sessions and cannot expose locked courses", async () => {
  const f = fixture();
  const auth = load("app/api/auth/access/route.ts", {
    "next/server": response, "@/lib/supabase/server": { getSupabaseAdmin: () => { throw Error("No audit needed for free entrance"); } },
    "@/lib/auth/courseAccessStorage": f.storage, "@/lib/auth/passcodes": f.codes,
    "@/lib/auth/session": { ACCESS_SESSION_COOKIE: "test", createAccessSession: value => value, sessionCookieOptions: () => ({}) },
  });
  assert.equal((await auth.POST(request({ freeAccess: true }))).status, 403);
  f.catalog.courses[2].metadata.passcode = "";
  const first = await auth.POST(request({ freeAccess: true }));
  const second = await auth.POST(request({ freeAccess: true }));
  assert.equal(first.status, 200);
  assert.equal(first.cookies.value.role, "guest");
  assert.notEqual(first.cookies.value.sessionId, second.cookies.value.sessionId);
  const session = first.cookies.value;
  const access = load("lib/auth/currentUser.ts", { "server-only": {}, "@/lib/supabase/server": {}, "./session": { currentAccessSession: async () => session }, "./courseAccessStorage": f.storage, "./passcodes": f.codes, "./types": { FIXED_ADMIN_EMAIL: "admin@example.test" } });
  assert.equal((await access.currentUserAccess()).sections.map(s => s.id).join(","), "s4");
  assert.equal((await access.currentUserAccess()).canFacilitate, false);
  assert.equal(await access.requireAdminAccess(), null);
  f.catalog.courses[2].metadata.passcode = "LOCK1234";
  assert.equal(await access.currentUserAccess(), null);
});


test("bulk generation requires explicit unhide consent and gives each scope and mode a unique code", async () => {
  const f = fixture();
  f.catalog.folderGroups[0].hidden = true;
  f.catalog.courses[0].metadata.hidden = true;
  f.catalog.courses[0].metadata.hiddenSectionIds = ["s1"];
  const targets = [{kind:"folder",id:"f1"},{kind:"course",id:"c1"}];
  await assert.rejects(f.codes.saveAccessPasscodes(targets,["learner","facilitator"],null), /confirmation/);
  assert.equal(f.catalog.folderGroups[0].hidden,true);
  assert.equal(f.catalog.courses[0].metadata.passcode,"CL01234");
  const codes = await f.codes.saveAccessPasscodes(targets,["learner","facilitator"],null,true);
  assert.equal(new Set(codes.map(row => row.code)).size,4);
  assert.equal(f.catalog.folderGroups[0].hidden,false);
  assert.equal(f.catalog.courses[0].metadata.hidden,false);
  assert.equal(f.catalog.courses[0].metadata.hiddenSectionIds.length,0);
  assert.equal(f.resolve(codes.find(row=>row.kind==="folder" && row.mode==="learner").code).sections.length,3);
  assert.equal(f.resolve(codes.find(row=>row.kind==="course" && row.mode==="facilitator").code).sections.length,2);
});

test("bulk clear touches only selected access types and never unhides content", async () => {
  const f = fixture(); f.catalog.folderGroups[0].hidden=true;
  await f.codes.saveAccessPasscodes([{kind:"folder",id:"f1"},{kind:"course",id:"c1"}],["learner"],"");
  assert.equal(f.catalog.folderGroups[0].accessCodes.learner,"");
  assert.equal(f.catalog.folderGroups[0].accessCodes.facilitator,"FT1234");
  assert.equal(f.catalog.courses[0].metadata.passcode,"");
  assert.equal(f.catalog.courses[0].metadata.facilitatorPasscode,"CT01234");
  assert.equal(f.catalog.courses[1].metadata.passcode,"CL11234");
  assert.equal(f.catalog.folderGroups[0].hidden,true);
});

test("course generation unhides its parent and sections but leaves sibling courses hidden", async () => {
  const f = fixture();f.catalog.folderGroups[0].hidden=true;f.catalog.courses[1].metadata.hidden=true;
  f.catalog.courses[0].metadata.hiddenSectionIds=["s1"];
  f.catalog.sections[1].status="draft";
  await f.codes.saveAccessPasscode({kind:"course",id:"c1"},"learner",null,true);
  assert.equal(f.catalog.folderGroups[0].hidden,false);
  assert.equal(f.catalog.courses[0].metadata.hiddenSectionIds.length,0);
  assert.equal(f.catalog.courses[1].metadata.hidden,true);
  assert.equal(f.catalog.sections[1].status,"draft");
});

test("bulk validation rejects section scopes and invalid scopes before any write", async () => {
  const f=fixture();
  await assert.rejects(f.codes.saveAccessPasscodes([{kind:"folder",id:"f1"},{kind:"section",id:"s1"}],["learner"],null,true),/Section passcodes/);
  await assert.rejects(f.codes.saveAccessPasscodes([{kind:"folder",id:"f1"},{kind:"course",id:"missing"}],["learner"],"",true),/no longer exists/);
  assert.equal(f.catalog.folderGroups[0].accessCodes.learner,"FL1234");
});


test("bulk API is admin-only, rejects section codes and requires consent before hidden writes", async () => {
 const f=fixture();let actor={isAdmin:true};
 const admin=load("app/api/admin/access/route.ts",{"next/server":response,"next/cache":{revalidatePath(){}},"@/lib/auth/currentUser":{requireCourseManager:async()=>actor},"@/lib/auth/types":{},"@/lib/supabase/server":{getSupabaseAdmin:()=>({})},"@/lib/auth/courseAccessStorage":f.storage,"@/lib/auth/passcodes":f.codes});
 const body={action:"bulk_access_passcodes",operation:"generate",targets:[{kind:"folder",id:"f1"},{kind:"course",id:"c1"}],modes:["learner","facilitator"]};
 f.catalog.folderGroups[0].hidden=true;
 assert.equal((await admin.POST(request(body))).status,409);
 assert.equal(f.catalog.folderGroups[0].hidden,true);
 assert.equal(f.catalog.courses[0].metadata.passcode,"CL01234");
 assert.equal((await admin.POST(request({...body,unhide:true}))).status,200);
 assert.equal(f.catalog.folderGroups[0].hidden,false);
 assert.equal((await admin.POST(request({action:"set_access_passcode",kind:"section",id:"s1",mode:"learner",generate:true}))).status,400);
 actor=null;assert.equal((await admin.POST(request({...body,unhide:true}))).status,403);
});

test("bulk persistence failure reports partial progress instead of claiming success", async () => {
 const f=fixture();f.storage.updateCourseMetadata=async()=>{throw Error("Simulated write failure");};
 await assert.rejects(f.codes.saveAccessPasscodes([{kind:"folder",id:"f1"},{kind:"course",id:"c1"}],["learner"],null),/Some changes were saved/);
 assert.notEqual(f.catalog.folderGroups[0].accessCodes.learner,"FL1234");
 assert.equal(f.catalog.courses[0].metadata.passcode,"CL01234");
});

test("admin access password signs in directly to admin workspace", async () => {
  const f = fixture();
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, contains() { return this; }, gte: async () => ({ count: 0 }), insert() { return this; } }) };
  const prev = process.env.ADMIN_ACCESS_PASSWORD;
  process.env.ADMIN_ACCESS_PASSWORD = "110320";
  try {
    const auth = load("app/api/auth/access/route.ts", {
      "next/server": response,
      "@/lib/supabase/server": { getSupabaseAdmin: () => db },
      "@/lib/auth/courseAccessStorage": f.storage,
      "@/lib/auth/passcodes": f.codes,
      "@/lib/auth/session": { ACCESS_SESSION_COOKIE: "session", createAccessSession: body => body, sessionCookieOptions: () => ({}) },
      "@/lib/auth/adminPassword": { getAdminCredential: async () => null, verifyAdminPassword: candidate => candidate === "110320" },
      "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "son.lam@eiu.edu.vn" },
    });
    const result = await auth.POST(request({ passcode: "110320" }));
    assert.equal(result.data.success, true);
    assert.equal(result.data.destination, "/admin/access");
    assert.equal(result.cookies.value.role, "admin");
        assert.equal(result.cookies.value.authMethod, "password");

    const access = load("lib/auth/currentUser.ts", {
      "server-only": {},
      "@/lib/supabase/server": {},
      "./session": { currentAccessSession: async () => ({ role: "admin", authMethod: "password" }) },
      "./courseAccessStorage": f.storage,
      "./passcodes": f.codes,
      "./types": { FIXED_ADMIN_EMAIL: "son.lam@eiu.edu.vn" }
    });
    const admin = await access.requireAdminAccess();
    assert.equal(admin.driveEnabled, false);

    const googleAccess = load("lib/auth/currentUser.ts", {
      "server-only": {},
      "@/lib/supabase/server": {},
      "./session": { currentAccessSession: async () => ({ role: "admin", authMethod: "google" }) },
      "./courseAccessStorage": f.storage,
      "./passcodes": f.codes,
      "./types": { FIXED_ADMIN_EMAIL: "son.lam@eiu.edu.vn" }
    });
    assert.equal((await googleAccess.requireAdminAccess()).driveEnabled, true);
  } finally {
    process.env.ADMIN_ACCESS_PASSWORD = prev;
  }
});
