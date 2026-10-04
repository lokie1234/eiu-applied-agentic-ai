import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { Window } from "happy-dom";

const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../lib/pptxTableLayout.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports });

test("overflowing table retains its position and width and reveals the final row at any zoom", () => {
  const window = new Window();
  const slide = window.document.createElement("div");
  slide.innerHTML = '<div style="position:absolute;left:100px;top:80px;width:600px;height:240px;overflow:hidden"><table style="height:100%"><tbody><tr><td>Final row</td></tr></tbody></table></div>';
  const wrapper = slide.firstElementChild;
  const table = wrapper.firstElementChild;
  Object.defineProperty(table, "offsetHeight", { value: 280 });
  Object.defineProperty(table, "scrollHeight", { value: 280 });
  for (const zoom of [0.5, 1, 1.5]) {
    slide.style.transform = `scale(${zoom})`;
    exports.fitPptxTables(slide);
    assert.equal(wrapper.style.height, "280px");
    assert.equal(wrapper.style.left, "100px");
    assert.equal(wrapper.style.top, "80px");
    assert.equal(wrapper.style.width, "600px");
    assert.equal(table.textContent, "Final row");
  }
  table.style.height = "100%";
  wrapper.style.height = "300px";
  exports.fitPptxTables(slide);
  assert.equal(wrapper.style.height, "300px");
  assert.equal(table.style.height, "100%");
});
