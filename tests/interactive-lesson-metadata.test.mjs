import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/interactiveLessonMetadata.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, { exports, require });
const { interactiveLessonCounts } = exports;

test("static counts match both compiled course runtimes, including admin-only slides", () => {
  for (const file of ["Section1.js", "Section2.js"]) {
    const source = fs.readFileSync(`course-content/web-app-development/${file}`, "utf8");
    const sandboxedModule = { exports: {} };
    vm.runInNewContext(source, { module: sandboxedModule, exports: sandboxedModule.exports });
    const slides = sandboxedModule.exports.default;
    const counts = interactiveLessonCounts(source);
    assert.equal(counts.teachingSlides, slides.length);
    assert.equal(counts.learnerSlides, slides.filter(slide => !slide.adminOnly).length);
  }
});

test("metadata parsing never executes uploaded scripts and invalidates on source changes", () => {
  const source = 'throw Error("Must not execute"); const course={"slides":[{},{}]}; exports.default=course.slides.map(s=>()=>slide(s));';
  assert.equal(interactiveLessonCounts(source).teachingSlides, 2);
  assert.equal(interactiveLessonCounts(source.replace('[{},{}]', '[{}]')).teachingSlides, 1);
  assert.equal(interactiveLessonCounts("exports.default = () => { throw Error('Unknown factory'); };"), null);
  assert.equal(interactiveLessonCounts('const course = dangerous(); exports.default=course.slides.map(s=>()=>slide(s));'), null);
});
