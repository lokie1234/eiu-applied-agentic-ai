import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { Window } from 'happy-dom';

const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, document: globalThis.document, navigator: globalThis.navigator,
    require: name => overrides[name] ?? (name.endsWith('.css')
      ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }) : require(name)),
  });
  return exports;
}

test('dashboard stays bound to teaching slide 41 and learner dashboard', () => {
  const { buildSectionOneDeckItems } = load('lib/builtinDeckItems.ts');
  assert.equal(buildSectionOneDeckItems(true)[40].slide, 'realtime-dashboard');
  assert.equal(buildSectionOneDeckItems(false).filter(item => item.slide === 'realtime-dashboard').length, 1);
  assert.match(fs.readFileSync('components/section1/SectionOneHtmlSlide.tsx', 'utf8'), /<SalesDashboardEmergency\s*\/>/);
  assert.equal(buildSectionOneDeckItems(true)[26].pdfPage, 27);
  assert.equal(buildSectionOneDeckItems(true)[34].slide, 'deployment');
  assert.match(fs.readFileSync('components/section1/SectionOneHtmlSlide.tsx', 'utf8'), /<SalesDashboardEmergency files={DESIGN_DNA_FILES} \/>/);
  assert.match(fs.readFileSync('components/section1/SectionOneNativeSlide.tsx', 'utf8'), /overlay={<SalesDashboardEmergency files={LEAVE_MANAGEMENT_FILES} \/>}/);
});

for (const scenario of ['dashboard', 'leave', 'dna']) test(`${scenario} Emergency copies complete files, reports errors, traps focus and closes without deck navigation`, async () => {
  const window = new Window();
  for (const name of ['window', 'document', 'HTMLElement', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const files = load('components/section1/salesDashboardEmergencyData.ts');
  const payload = scenario === 'dashboard' ? files.SALES_DASHBOARD_FILES
    : scenario === 'leave' ? load('components/section1/leaveManagementEmergencyData.ts').LEAVE_MANAGEMENT_FILES
    : load('components/section1/designDnaEmergencyData.ts').DESIGN_DNA_FILES;
  assert.deepEqual(Array.from(payload, f => f.name), ['Code.gs', 'Index.html']);
  if (scenario === 'dashboard') assert.match(payload[0].code, /monthKey = `\$\{yyyy\}-\$\{mm\}`/);
  else assert.match(payload[0].code, /HỆ THỐNG QUẢN LÝ NGHỈ PHÉP/);
  assert.match(payload[1].code, /^<!DOCTYPE html>/);
  assert.match(payload[1].code, /<\/html>\s*$/);
  const copied = [];
  let fail = false;
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async text => {
    if (fail) throw Error('denied');
    copied.push(text);
  } } });
  const component = load('components/section1/SalesDashboardEmergency.tsx', { './salesDashboardEmergencyData': files });
  const { createRoot } = await import('react-dom/client');
  const container = window.document.createElement('div');
  window.document.body.append(container);
  const root = createRoot(container);
  const click = target => act(async () => target.click());
  const key = (target, key, shiftKey = false) => act(async () => target.dispatchEvent(new window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })));
  const dialog = () => container.querySelector('[role="dialog"]');
  let navigations = 0;
  window.addEventListener('keydown', () => navigations++);
  try {
    await act(async () => root.render(React.createElement(component.default, scenario === 'dashboard' ? {} : { files: payload })));
    const trigger = container.querySelector('button');
    await click(trigger);
    const buttons = [...dialog().querySelectorAll('button')];
    assert.equal(buttons.length, 3);
    assert.equal(window.document.activeElement, buttons[0]);
    await key(buttons[0], 'Tab', true);
    assert.equal(window.document.activeElement, buttons[2]);
    await key(buttons[2], 'Tab');
    assert.equal(window.document.activeElement, buttons[0]);
    await click(buttons[1]); await click(buttons[2]);
    assert.deepEqual(copied, Array.from(payload, f => f.code));
    assert.match(dialog().querySelector('[role="status"]').textContent, /Đã sao chép Index.html/);
    fail = true;
    await click(buttons[1]);
    assert.match(dialog().querySelector('[role="status"]').textContent, /Không thể sao chép Code.gs/);
    await key(buttons[1], 'ArrowUp');
    await key(buttons[1], 'Escape');
    assert.equal(navigations, 2); // Only the two Tab events reach the deck.
    assert.equal(dialog(), null);
    assert.equal(window.document.activeElement, trigger);
    await click(trigger);
    await act(async () => dialog().parentElement.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })));
    assert.equal(dialog(), null);
    await click(trigger);
    await click(dialog().querySelector('button'));
    assert.equal(dialog(), null);
  } finally {
    await act(async () => root.unmount());
    await window.happyDOM.close();
  }
});
