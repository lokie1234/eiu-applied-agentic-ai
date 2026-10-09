import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(role = "admin") {
  const writes = [];
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/currentRole": { currentRole: async () => role },
    "@/lib/supabase/server": { getSupabaseAdmin: () => ({ from: table => ({
      delete() { writes.push({ table, action: "delete" }); return this; },
      update() { writes.push({ table, action: "update" }); return this; },
      eq: async () => ({}), neq: async () => ({}),
    }) }) },
  };
  const source = ts.transpileModule(fs.readFileSync("app/api/admin/reset/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => dependencies[name], Date, console });
  return { writes, post: password => exports.POST({ json: async () => ({ password, section: "all" }) }) };
}

test("reset rejects the old confirmation and incorrect passcodes before any database writes", async () => {
  const f = fixture();
  for (const value of ["RESET", "", "lovekjng123@@", "Lovekjng123@", " Lovekjng123@@", "Lovekjng123@@ ", 123]) {
    assert.equal((await f.post(value)).status, 401);
  }
  assert.equal(f.writes.length, 0);
});

test("the exact fixed passcode permits an administrator to reset data", async () => {
  const f = fixture();
  assert.equal((await f.post("Lovekjng123@@")).status, 200);
  assert.equal(f.writes.filter(write => write.action === "delete").length, 6);
  assert.equal(f.writes.filter(write => write.action === "update").length, 1);
});

test("a facilitator cannot reset data even with the correct passcode", async () => {
  const f = fixture("section1");
  assert.equal((await f.post("Lovekjng123@@")).status, 403);
  assert.equal(f.writes.length, 0);
});
