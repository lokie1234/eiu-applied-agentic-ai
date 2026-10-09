import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Window } from "happy-dom";

function load(path, globals = {}, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, ...globals, require: name => dependencies[name] });
  return exports;
}

test("refresh URL keeps the course, section, and slide; returning to each section restores its own position", async () => {
  const window = new Window({ url: "http://localhost/learn" });
  const deck = load("lib/deckLocation.ts", { window });
  deck.rememberDeckSelection("course", "section1"); deck.rememberSlide(22);
  assert.equal(new URL(window.location.href).searchParams.get("slide"), "22");
  assert.equal(load("lib/deckLocation.ts", { window }).restoredSlide(40), 22);
  deck.rememberDeckSelection("course", "section2", true); deck.rememberSlide(31);
  assert.equal(new URL(window.location.href).searchParams.get("view"), "file");
  deck.rememberDeckSelection("course", "section1");
  assert.equal(deck.restoredSlide(40), 22);
  assert.equal(new URL(window.location.href).searchParams.get("view"), null);
  assert.equal(deck.restoredSlide(10), 10);
  deck.rememberDeckSelection(); assert.equal(window.location.search, "");
  await window.happyDOM.close();
});

test("quiz restoration uses the signed session and section, checks the result still exists, and restores feedback", async () => {
  const calls = [];
  let missing = false;
  const db = { from(table) {
    const query = { table, filters: {} }; calls.push(query);
    return { select() { return this; }, eq(key, value) { query.filters[key] = value; return this; }, contains(key, value) { query.filters[key] = value; return this; }, order() { return this; }, limit() { return this; }, async maybeSingle() {
      return { data: table === "quiz_results" ? missing ? null : { score: 8, total: 10, answers: [], completed_at: "now" } : query.filters.action === "QUIZ_COMPLETED" ? { details: { recordId: "record" } } : { id: 1 } };
    } };
  } };
  const { readQuizProgress } = load("lib/quizProgress.ts", {}, { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin: () => db } });
  const identity = { sessionId: "signed-session", name: "Alice", email: "alice@example.test", information: {} };
  const result = await readQuizProgress(identity, "section2");
  assert.equal(result.score, 8); assert.equal(result.feedbackSubmitted, true);
  assert.equal(calls[0].filters.details.sessionId, "signed-session"); assert.equal(calls[0].filters.details.section, "section2");
  assert.equal(calls[1].filters.id, "record"); assert.equal(calls[1].filters.section, "section2");
  missing = true; assert.equal(await readQuizProgress(identity, "section2"), null);
});

test("quiz endpoint denies another section and returns an existing result without inserting another attempt", async () => {
  const previous = { score: 8, total: 10, answers: [], feedbackSubmitted: true };
  let inserts = 0;
  const route = load("app/api/quiz-results/route.ts", { console, Date }, {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } },
    "@/lib/currentRole": { currentRole: async () => "section2" },
    "@/lib/currentLearnerProfile": { currentLearnerProfile: async () => ({ section: "section2", identity: { sessionId: "signed" } }) },
    "@/lib/quizProgress": { readQuizProgress: async () => previous },
    "@/lib/supabase/server": { getSupabaseAdmin: () => { inserts++; throw new Error("Must not insert"); } },
    "@/lib/learnerActivity": { recordLearnerActivity() { throw new Error("Must not log again"); } },
  });
  assert.equal((await route.GET({ url: "http://localhost/api/quiz-results?section=section1" })).status, 403);
  assert.equal((await route.GET({ url: "http://localhost/api/quiz-results?section=section2" })).data.result.score, 8);
  const result = await route.POST({ json: async () => ({ section: "section2", score: 10, total: 10, answers: Array.from({ length: 10 }, () => ({ question: "Q", selected: "A", correct: "A", isCorrect: true })) }) });
  assert.equal(result.data.score, 8); assert.equal(inserts, 0);
});
