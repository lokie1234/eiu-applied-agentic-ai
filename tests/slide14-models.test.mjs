import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { Window } from 'happy-dom';

test('slide 14 shows Auto selected and both paid models locked, matching the supplied image', async () => {
  const require = createRequire(import.meta.url);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('components/section1/SectionOneSlide14.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name.endsWith('.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
    if (name === 'next/image') return { __esModule: true, default: props => React.createElement('img', props) };
    return require(name);
  } });
  const window = new Window();
  try {
    window.document.body.innerHTML = renderToStaticMarkup(React.createElement(exports.default));
    const doc = window.document, options = [...doc.querySelectorAll('[role="option"]')];
    assert.deepEqual(options.map(row => row.querySelector('b').textContent), ['Auto', '3.1 Pro', '4 Argon']);
    assert.deepEqual(options.map(row => row.querySelector('small').textContent), ['Gemini 3 models', 'Advanced reasoning', 'Complex tasks']);
    assert.equal(options[0].getAttribute('aria-selected'), 'true');
    assert.match(options[0].textContent, /✓.*Đang chọn/);
    for (const row of options.slice(1)) {
      assert.equal(row.getAttribute('aria-selected'), 'false');
      assert.equal(row.getAttribute('aria-disabled'), 'true');
      assert.ok(row.querySelector('svg[aria-label="Bị khóa"]'));
    }
    assert.match(doc.body.textContent, /Gemini Auto/);
    assert.match(doc.body.textContent, /Thinking level/);
    assert.doesNotMatch(doc.body.textContent, /3\.5 Flash-Lite|3\.6 Flash|Recommended/);
    assert.match(doc.body.textContent, /Đăng nhập tài khoản/);
  } finally { await window.happyDOM.close(); }
});
