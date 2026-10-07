import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), Buffer, console, Date, process });
  return exports;
}
const response = { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, headers: options.headers, cookies: { set() {} } }) } };
const request = body => ({ json: async () => body });
function route(actor, owner) {
  const query = { select() { return this; }, eq() { return this; }, in() { return this; }, maybeSingle: async () => ({ data: { created_by: owner } }), then: resolve => Promise.resolve({ data: [{ id: "section", created_by: owner }] }).then(resolve) };
  return load("app/api/admin/access/route.ts", {
    "next/server": response, "next/cache": {}, "@/lib/auth/types": {},
    "@/lib/auth/currentUser": { requireCourseManager: async () => actor },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => query }) }, "@/lib/auth/courseAccessStorage": {},
  });
}
test("unauthenticated users and teachers cannot mutate someone else's sections or global settings", async () => {
  assert.equal((await route(null).POST(request({ action: "create_course" }))).status, 403);
  for (const owner of ["other", null]) for (const action of ["rename_section", "delete_section", "delete_sections", "create_section", "delete_course", "update_course_title", "set_all_courses_unlocked", "grant_emails_bulk", "update_system_icons", "delete_courses"]) {
    const res = await route({ isAdmin: false, isTeacher: true, authUserId: "teacher" }, owner).POST(request({ action, sectionId: "section", sectionIds: ["section"], courseId: "course", courseIds: ["course"] }));
    assert.equal(res.status, 403, action);
  }
});
test("pending password change and revoked sessions cannot manage courses or sections", async () => {
  let version = 2;
  const teacherModule = load("lib/auth/teachers.ts", {
    "server-only": {}, "./session": { currentAccessSession: async () => ({ role: "teacher", accountId: "teacher", sessionVersion: 2 }) },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: "teacher", email: "teacher@example.test", status: "active", session_version: version, must_change_password: true } }) }) }) },
  });
  const access = load("lib/auth/currentUser.ts", {
    "server-only": {}, "./teachers": teacherModule,
    "@/lib/auth/session": { currentAccessSession: async () => ({ role: "teacher" }) },
    "@/lib/supabase/server": { getSupabaseAdmin() { throw new Error("No course queries allowed before first password change"); } },
    "@/lib/auth/courseAccessStorage": {}, "@/lib/auth/types": {},
  });
  assert.equal((await access.currentUserAccess()).mustChangePassword, true);
  assert.equal(await access.requireCourseManager(), null);
  assert.equal(await access.canManageSection("section"), false);
  version = 3;
  assert.equal(await teacherModule.currentTeacher(), null);
});
test("password encryption supports arbitrary passwords and binds ciphertext to the account", async () => {
  process.env.TEACHER_PASSWORD_ENCRYPTION_KEY = "test-only-key";
  const teachers = load("lib/auth/teachers.ts", { "server-only": {}, "./session": {}, "@/lib/supabase/server": {} });
  const password = " a🙂 ";
  const fields = await teachers.passwordFields(password, "teacher@example.test");
  assert.equal(await teachers.matchesPassword(password, fields.password_hash), true);
  assert.equal(await teachers.matchesPassword(password.trim(), fields.password_hash), false);
  assert.equal(teachers.decryptPassword(fields.password_ciphertext, "teacher@example.test"), password);
  assert.throws(() => teachers.decryptPassword(fields.password_ciphertext, "other@example.test"));
  assert.notEqual(fields.password_ciphertext, teachers.encryptPassword(password, "teacher@example.test"));
  assert.equal(teachers.validPassword("x"), true);
  for (let i = 0; i < 100; i++) assert.match(teachers.temporaryPassword(), /^\d{6}$/);
});
test("password reveal is admin-only, audited, and never cached", async () => {
  let admin = null; let audit;
  const accounts = load("app/api/admin/accounts/route.ts", {
    "next/server": response,
    "@/lib/auth/currentUser": { requireAdminAccess: async () => admin },
    "@/lib/auth/teachers": { decryptPassword: () => "chosen password" }, "@/lib/auth/types": {},
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: table => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: "teacher", email: "teacher@example.test", password_ciphertext: "encrypted" } }), insert: async row => { audit = row; return {}; } }) }) },
  });
  assert.equal((await accounts.POST(request({ action: "reveal_password", id: "teacher" }))).status, 403);
  admin = { email: "admin@example.test" };
  const res = await accounts.POST(request({ action: "reveal_password", id: "teacher" }));
  assert.equal(res.data.password, "chosen password");
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(audit.action, "TEACHER_PASSWORD_VIEWED");
  assert.equal(audit.password, undefined);
});
test("admin reset invalidates teacher sessions and requires another first-login password change", async () => {
  let update;
  const accounts = load("app/api/admin/accounts/route.ts", {
    "next/server": response, "@/lib/auth/currentUser": { requireAdminAccess: async () => ({ email: "admin@example.test" }) },
    "@/lib/auth/teachers": { temporaryPassword: () => "000007", validPassword: () => true, passwordFields: async () => ({ password_hash: "hash", password_ciphertext: "encrypted" }) }, "@/lib/auth/types": {},
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: "teacher", email: "teacher@example.test", session_version: 4 } }), update(row) { update = row; return this; }, single: async () => ({ data: { id: "teacher" } }) }) }) },
  });
  const res = await accounts.POST(request({ action: "reset_password", id: "teacher", random: true }));
  assert.equal(res.data.password, "000007");
  assert.equal(update.session_version, 5);
  assert.equal(update.must_change_password, true);
  assert.equal(update.password, undefined);
});
test("content uploads authorize ownership before reading or uploading any file", async () => {
  let requested;
  const upload = load("app/api/admin/sections/[id]/content/route.ts", {
    "next/server": response, "@/lib/auth/currentUser": { canManageSection: async id => { requested = id; return false; } },
    "@/lib/supabase/server": { getSupabaseAdmin() { throw new Error("Must not access storage"); } },
  });
  const res = await upload.POST({ formData() { throw new Error("Must not parse file"); } }, { params: Promise.resolve({ id: "other-section" }) });
  assert.equal(res.status, 403); assert.equal(requested, "other-section");
});
test("teacher login routes first-time accounts to password change and cannot fall through to email-only access", async () => {
  let valid = true; let cookie;
  const login = load("app/api/auth/access/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set: (...values) => { cookie = values; } } }) } },
    "@/lib/auth/teachers": { teacherByEmail: async () => ({ id: "teacher", status: "active", password_hash: "hash", session_version: 5, must_change_password: true }), matchesPassword: async () => valid },
    "@/lib/auth/adminPassword": {},
    "@/lib/auth/session": { ACCESS_SESSION_COOKIE: "session", createAccessSession: payload => payload, sessionCookieOptions: () => ({ httpOnly: true }) },
    "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "admin@example.test", isValidEmail: () => true, normalizeEmail: value => value.toLowerCase() },
    "@/lib/auth/courseAccessStorage": { isEmailAuthorized() { throw new Error("Teacher cannot fall back to learner access"); } },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, gte: async () => ({ count: 0 }), insert: async () => ({}) }) }) },
  });
  const body = { email: "teacher@example.test", adminPassword: "000007" };
  const first = await login.POST(request(body));
  assert.equal(first.data.destination, "/change-password");
  assert.equal(cookie[1].role, "teacher"); assert.equal(cookie[1].sessionVersion, 5);
  valid = false;
  const challenge = await login.POST(request({ ...body, adminPassword: "" }));
  assert.equal(challenge.status, 401);
  assert.equal(challenge.data.requireTeacherPassword, true);
  assert.equal((await login.POST(request({ ...body, adminPassword: "wrong" }))).status, 401);
});
test("teacher email discovery does not consume password attempts and lockouts still protect password verification", async () => {
  let count = 0; let audits = 0; let checks = 0; let cookies = 0;
  const login = load("app/api/auth/access/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set() { cookies++; } } }) } },
    "@/lib/auth/teachers": { teacherByEmail: async () => ({ id: "teacher", status: "active", password_hash: "hash", session_version: 1, must_change_password: false }), matchesPassword: async password => { checks++; return password === "correct"; } },
    "@/lib/auth/adminPassword": {},
    "@/lib/auth/session": { createAccessSession: payload => payload, sessionCookieOptions: () => ({}) },
    "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "admin@example.test", isValidEmail: () => true, normalizeEmail: value => value.trim().toLowerCase() },
    "@/lib/auth/courseAccessStorage": { isEmailAuthorized() { throw new Error("Teacher cannot fall back to learner access"); } },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, gte: async () => ({ count }), insert: async () => { audits++; count++; return {}; } }) }) },
  });
  const email = " Teacher@Example.Test ";
  for (let i = 0; i < 6; i++) {
    const result = await login.POST(request({ email }));
    assert.equal(result.data.requireTeacherPassword, true);
    assert.equal(result.data.success, false);
  }
  assert.equal(audits, 0); assert.equal(checks, 0); assert.equal(cookies, 0);
  for (let i = 0; i < 5; i++) assert.equal((await login.POST(request({ email, adminPassword: "wrong" }))).status, 401);
  assert.equal(audits, 5);
  assert.equal((await login.POST(request({ email }))).data.requireTeacherPassword, true);
  assert.equal((await login.POST(request({ email, adminPassword: "correct" }))).status, 429);
  assert.equal(checks, 5); assert.equal(cookies, 0);
  count = 0;
  const success = await login.POST(request({ email, adminPassword: "correct" }));
  assert.equal(success.data.destination, "/teacher"); assert.equal(cookies, 1);
});
test("password change confirms twice, accepts a one-character password and keeps the encrypted admin view synchronized", async () => {
  let update;
  const account = { id: "teacher", email: "teacher@example.test", session_version: 2, password_hash: "old" };
  const change = load("app/api/auth/change-password/route.ts", {
    "next/server": response,
    "@/lib/auth/teachers": { currentTeacher: async () => account, validPassword: value => typeof value === "string" && value.length > 0, matchesPassword: async () => false, passwordFields: async password => ({ password_hash: `hash:${password}`, password_ciphertext: `encrypted:${password}` }) },
    "@/lib/auth/session": { currentAccessSession: async () => ({ role: "teacher" }), createAccessSession: () => "session", sessionCookieOptions: () => ({}) },
    "@/lib/auth/adminPassword": {}, "@/lib/auth/types": {},
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ update(values) { update = values; return this; }, eq() { return this; }, select() { return this; }, single: async () => ({}) }) }) },
  });
  assert.equal((await change.POST(request({ password: "x", confirmPassword: "y" }))).status, 400);
  assert.equal(update, undefined);
  assert.equal((await change.POST(request({ password: "x", confirmPassword: "x" }))).status, 200);
  assert.equal(update.password_ciphertext, "encrypted:x");
  assert.equal(update.must_change_password, false); assert.equal(update.session_version, 3);
});
test("admin password change verifies the current password, confirms twice, and rotates the session", async () => {
  let saved; let cookie;
  const route = load("app/api/auth/change-password/route.ts", {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, cookies: { set: (...values) => { cookie = values; } } }) } },
    "@/lib/auth/session": { currentAccessSession: async () => ({ role: "admin" }), createAccessSession: payload => payload, sessionCookieOptions: () => ({}) },
    "@/lib/auth/adminPassword": { getAdminCredential: async () => ({ session_version: 3 }), verifyAdminPassword: async password => password === "old" },
    "@/lib/auth/teachers": { validPassword: value => typeof value === "string" && value.length > 0, hashPassword: async value => `hash:${value}` },
    "@/lib/auth/types": { FIXED_ADMIN_EMAIL: "admin@example.test" },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: () => ({ update(values) { saved = values; return this; }, eq() { return this; }, select() { return this; }, single: async () => ({}) }) }) },
  });
  assert.equal((await route.POST(request({ currentPassword: "wrong", password: "new", confirmPassword: "new" }))).status, 401);
  assert.equal((await route.POST(request({ currentPassword: "old", password: "new", confirmPassword: "different" }))).status, 400);
  assert.equal(saved, undefined);
  const result = await route.POST(request({ currentPassword: "old", password: "new", confirmPassword: "new" }));
  assert.equal(result.data.destination, "/admin/access");
  assert.equal(saved.password_hash, "hash:new"); assert.equal(saved.session_version, 4);
  assert.equal(cookie[1].sessionVersion, 4);
});
test("database admin password replaces the environment password after the first change", async () => {
  const previous = process.env.ADMIN_ACCESS_PASSWORD;
  process.env.ADMIN_ACCESS_PASSWORD = "old-configured-password";
  try {
    const auth = load("lib/auth/adminPassword.ts", {
      "server-only": {}, "@/lib/supabase/server": {},
      "./teachers": { validPassword: value => typeof value === "string" && value.length > 0, matchesPassword: async value => value === "new-password" },
    });
    assert.equal(await auth.verifyAdminPassword("old-configured-password", null), true);
    assert.equal(await auth.verifyAdminPassword("old-configured-password", { password_hash: "hash", session_version: 1 }), false);
    assert.equal(await auth.verifyAdminPassword("new-password", { password_hash: "hash", session_version: 1 }), true);
  } finally { if (previous === undefined) delete process.env.ADMIN_ACCESS_PASSWORD; else process.env.ADMIN_ACCESS_PASSWORD = previous; }
});
