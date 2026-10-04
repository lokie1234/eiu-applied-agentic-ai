import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/uploadQueue.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });

test("five simultaneous section uploads run in order and continue after a timeout", async () => {
  const enqueue = exports.createUploadQueue();
  const started = [];
  let active = 0;
  let peak = 0;
  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => enqueue(async () => {
    started.push(index);
    active++;
    peak = Math.max(peak, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (index === 1) throw new DOMException("Upload timed out", "TimeoutError");
      return index;
    } finally {
      active--;
    }
  })));
  assert.deepEqual(started, [0, 1, 2, 3, 4]);
  assert.equal(peak, 1);
  assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "fulfilled", "fulfilled", "fulfilled"]);
  assert.equal(active, 0);
});
