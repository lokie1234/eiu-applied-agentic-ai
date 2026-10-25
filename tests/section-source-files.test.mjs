import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const code = ts.transpileModule(fs.readFileSync("lib/sectionSourceFiles.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports });
const input = {
  folderName: "Chương trình AI", courseTitle: "Agentic AI",
  sectionTitle: "Section 1: Tổng quan", originalFilename: "Bài gốc.TSX",
  sourceId: "source-12345678", uploadedAt: new Date("2026-10-07T08:00:00Z"),
};

test("routes all original types into the supplied folders and preserves TSX", () => {
  const ids = {
    tsx: "1J0Kudr8xTczKjujXDZ3ek7Aq2pvEz1Ir",
    pdf: "1EgGdT63Och3qucdtY7yTwzZlOfxWiNPM",
    pptx: "1M6MLl542jzThnN0SpNPHAUAeZa0Ejcvv",
  };
  for (const [type, id] of Object.entries(ids)) {
    const file = exports.describeSectionSource({ ...input, originalFilename: `Bài gốc.${type.toUpperCase()}` });
    assert.equal(file.driveFolderId, id);
    assert.ok(file.name.endsWith(`.${type}`));
    assert.ok(file.name.includes("Chương trình AI — Agentic AI — Section 1 Tổng quan"));
  }
});

test("readable names omit timestamps and IDs while preserving safe labels", () => {
  const first = exports.describeSectionSource(input).name;
  assert.equal(exports.describeSectionSource(input).name, first);
  assert.equal(exports.describeSectionSource({ ...input, sourceId: "source-87654321" }).name, first);
  assert.ok(!first.includes(input.sourceId));
  assert.equal(exports.driveDocumentName("My slides.pdf", first, "pptx"), "My slides.pptx");
  const sanitized = exports.describeSectionSource({ ...input, folderName: "Folder/child\\name\n" }).name;
  assert.ok(!/[\/\\\n]/.test(sanitized));
});

test("JS originals keep their extension and use the compatible interactive category", () => {
  const file = exports.describeSectionSource({ ...input, originalFilename: "Lesson.JS" });
  assert.equal(exports.sectionSourceType("Lesson.JS"), "tsx");
  assert.equal(file.type, "tsx");
  assert.equal(file.driveFolderId, exports.SECTION_SOURCE_DESTINATIONS.tsx);
  assert.ok(file.name.endsWith(".js"));
});

test("unsupported types, invalid identifiers and dates fail before upload", () => {
  assert.throws(() => exports.describeSectionSource({ ...input, originalFilename: "file.exe" }));
  assert.throws(() => exports.describeSectionSource({ ...input, sourceId: "../unsafe" }));
  assert.throws(() => exports.describeSectionSource({ ...input, uploadedAt: new Date("invalid") }));
});
