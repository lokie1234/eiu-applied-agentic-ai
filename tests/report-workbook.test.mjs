import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import ExcelJS from "exceljs";
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/reports/workbook.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Intl, require: () => ({ default: ExcelJS }) });
const scope = { courseId: "course-uuid", courseTitle: "Web Development", sectionId: "section-uuid", sectionTitle: "Section 1", section: "section1" };
const person = { ...scope, sessionId: "one", name: "Alice", email: "alice@example.test", created_at: "2026-10-28T03:00:00Z", updated_at: "2026-10-28T04:00:00Z" };
const base = () => ({ scopes: [scope], learners: [person], ideas: [], showcase: [], quiz: [], feedback: [], activity: [], date: "2026-10-28", exportedAt: new Date("2026-10-28T05:00:00Z") });
const headers = sheet => sheet.getRow(5).values.slice(1);
const value = (sheet, label, row = 6) => sheet.getRow(row).getCell(headers(sheet).indexOf(label) + 1).value;

test("every export has exactly two sheets, including an empty report", async () => {
  const data = base(); data.learners = [];
  assert.equal(exports.reportFilename(data), "Web-Development_Section-1_2026-10-28.xlsx");
  const book = await exports.buildReportWorkbook(data);
  assert.deepEqual(book.worksheets.map(s => s.name), ["Tổng quan", "Thống kê"]);
  assert.match(book.getWorksheet("Thống kê").getCell("A6").value, /Chưa có bản ghi/);
  assert.ok(!headers(book.getWorksheet("Thống kê")).some(header => /quiz|ý tưởng|feedback/i.test(header)));
});
test("login creates a learner row before opening a section, without an activity log", async () => {
  const data = base(); data.learners = [];
  data.activity = [{ ...person, id: "login", action: "PASSCODE_LOGIN", scopeMode: "access", scopes: [scope] }];
  const book = await exports.buildReportWorkbook(data), stats = book.getWorksheet("Thống kê");
  assert.equal(value(stats, "Họ tên"), "Alice");
  assert.equal(value(stats, "Đăng nhập lúc").toISOString(), "2026-10-28T10:00:00.000Z");
  assert.equal(stats.rowCount, 6);
  assert.ok(!headers(stats).some(header => /nhật ký|tương tác|hoạt động/i.test(header)));
});
test("granted sections appear and results stay on the correct learner and section", async () => {
  const data = base(), second = { ...scope, sectionId: "section-two", sectionTitle: "Section 2" };
  data.scopes.push(second); data.learners = [];
  data.activity = [{ ...person, action: "PASSCODE_LOGIN", scopes: [scope, second] }];
  data.quiz.push({ ...person, ...second, id: 7, score: 9, total: 10, completed_at: "2026-10-28T04:00:00Z" });
  const stats = (await exports.buildReportWorkbook(data)).getWorksheet("Thống kê");
  assert.equal(stats.rowCount, 7);
  assert.equal(value(stats, "Section", 6), "Section 1"); assert.equal(value(stats, "Điểm quiz", 6), null);
  assert.equal(value(stats, "Section", 7), "Section 2"); assert.equal(value(stats, "Điểm quiz", 7), 9);
  assert.equal(value(stats, "Tỷ lệ đúng", 7), .9);
  assert.equal(value(stats, "Hoàn thành quiz lúc", 7).toISOString(), "2026-10-28T11:00:00.000Z");
});
test("repeated submissions get numbered columns, while replayed records are deduplicated", async () => {
  const data = base(), first = { ...person, id: "idea-1", idea: "First idea", submitted_at: "2026-10-28T03:00:00Z" };
  data.ideas.push(first, { ...first }, { ...person, id: "idea-2", idea: "Second idea", submitted_at: "2026-10-28T04:00:00Z" });
  data.showcase.push({ ...person, id: "work", url: "https://example.test" });
  data.feedback.push({ ...person, id: "feedback", feedback: "Useful" });
  const stats = (await exports.buildReportWorkbook(data)).getWorksheet("Thống kê");
  assert.equal(stats.rowCount, 6);
  assert.equal(value(stats, "Ý tưởng 1"), "First idea"); assert.equal(value(stats, "Ý tưởng 2"), "Second idea");
  assert.ok(!headers(stats).includes("Ý tưởng 3"));
  assert.equal(value(stats, "Bài chia sẻ"), "https://example.test"); assert.equal(value(stats, "Feedback"), "Useful");
  assert.ok(!headers(stats).some(header => /quiz/i.test(header)));
});
test("same-name/email sessions remain distinct and profile column names stay unique", async () => {
  const data = base(); data.learners.push({ ...person, sessionId: "two" });
  data.learners[0] = { ...person, information: { a: "IT", b: "HR", c: "C" }, fields: [{ id: "a", label: "Department" }, { id: "b", label: "Department" }, { id: "c", label: "Email" }] };
  const stats = (await exports.buildReportWorkbook(data)).getWorksheet("Thống kê");
  assert.equal(stats.rowCount, 7); assert.equal(new Set(headers(stats)).size, headers(stats).length);
  assert.equal(value(stats, "Department"), "IT"); assert.equal(value(stats, "Department (2)"), "HR");
});
test("new reportable activities add fields without creating another sheet", async () => {
  const data = base();
  data.activity = [{ ...person, id: 20, action: "ACTIVITY_SUBMITTED", activityType: "poll", activityLabel: "Khảo sát", activityFields: [{ id: "choice", label: "Lựa chọn" }], values: { choice: "A" } }];
  const book = await exports.buildReportWorkbook(data);
  assert.equal(book.worksheets.length, 2); assert.equal(value(book.getWorksheet("Thống kê"), "Khảo sát - Lựa chọn"), "A");
});
test("quiz questions and raw log content are absent, and untrusted text stays text", async () => {
  const data = base(); data.activity = [{ ...person, id: 1, action: "SECTION_OPENED", log: "DO NOT EXPORT THIS LOG" }];
  data.quiz.push({ ...person, id: "q", score: 1, total: 1, answers: [{ question: "DO NOT EXPORT THIS QUESTION", selected: "B", correct: "C" }] });
  data.feedback.push({ ...person, id: "feedback", feedback: '=HYPERLINK("https://example.test")' });
  const book = await exports.buildReportWorkbook(data), all = [];
  for (const s of book.worksheets) s.eachRow(row => all.push(...row.values));
  assert.ok(!all.some(cell => String(cell).includes("DO NOT EXPORT")));
  assert.equal(typeof value(book.getWorksheet("Thống kê"), "Feedback"), "string");
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await book.xlsx.writeBuffer());
  assert.equal(loaded.worksheets.length, 2); assert.equal(value(loaded.getWorksheet("Thống kê"), "Điểm quiz"), 1);
});
