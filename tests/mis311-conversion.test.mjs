import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { Window } from 'happy-dom';

const root = 'course-content/mis311';
const bindings = JSON.parse(fs.readFileSync('course-content/sources.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, 'utf8'));
const source = fs.readFileSync('lib/sectionContent.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const validation = { exports: {} };
vm.runInNewContext(compiled, { exports: validation.exports, require: name => {
  if (name === 'typescript') return { default: ts };
  if (name === 'jszip') return {};
  if (name === 'node:crypto') return { createHash: crypto.createHash };
  if (name === './sectionLimits') return { MAX_SECTION_BYTES: 50 * 1024 * 1024 };
  throw Error(name);
}, Buffer, TextDecoder });

for (const [session, count] of [[1, 20], [2, 33]]) {
  test(`MIS 311 session ${session}: all ${count} original pages render with native text and embedded illustrations`, async () => {
    const window = new Window();
    const lessonModule = { exports: {} };
    const file = `${root}/Week7Session${session}.js`;
    const code = fs.readFileSync(file, 'utf8');
    await validation.exports.validateSectionContent(Buffer.from(code), `Week7Session${session}.js`);
    vm.runInNewContext(code, { module: lessonModule, document: window.document });
    const storyboard = JSON.parse(fs.readFileSync(`${root}/session${session}/storyboard.json`, 'utf8'));
    assert.equal(lessonModule.exports.slides.length, count);
    assert.equal(storyboard.pageCount, session === 1 ? 22 : count);
    assert.equal(storyboard.sourceFilename, 'MIS 311_Week 7.pptx');
    assert.equal(storyboard.sourceSlideCount, 55);
    assert.deepEqual(storyboard.sourceSlideRange, session === 1 ? [1, 22] : [23, 55]);
    assert.equal(fs.readdirSync(`${root}/session${session}`).filter(name => name.endsWith('.svg')).length, storyboard.pageCount);
    const binding = bindings.find(item => item.path === file);
    assert.equal(binding.courseId, '86cae0a3-9ada-4e31-b4d4-c83f50cafaf6');
    assert.equal(manifest[binding.sectionId].revision, crypto.createHash('sha256').update(code).digest('hex'));
    assert.equal(manifest[binding.sectionId].teachingSlides, count);
    assert.equal(manifest[binding.sectionId].learnerSlides, count);
    const displayedPages = storyboard.pages.filter(page => session !== 1 || ![2, 3].includes(page.sourceSlide));
    for (const [index, render] of lessonModule.exports.slides.entries()) {
      const page = displayedPages[index];
      assert.equal(page.sourceSlide, session === 1 ? index === 0 ? 1 : index + 3 : index + 23);
      const element = render();
      if (session === 1 && page.sourceSlide === 4) {
        assert.ok(element.querySelector('[data-mis311-org-chart]'));
        assert.equal(element.querySelectorAll('svg,image').length, 0);
        assert.equal(element.querySelector('h1').textContent, 'Company Organisation');
        assert.ok(!element.querySelector('.mis311-org-intro'));
        assert.ok(!element.textContent.includes('Company has different departments'));
        continue;
      }
      const [left, top, width, height] = element.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
      assert.ok(width > 0 && height > 0);
      assert.equal(left, Number(page.contentBounds[0].toFixed(3)));
      assert.equal(top, Number(page.contentBounds[1].toFixed(3)));
      assert.equal(element.dataset.eiuTemplate, 'system');
      assert.equal(element.style.backgroundImage, '');
      assert.ok(element.querySelector('[data-mis311-content]'));
      assert.equal(element.querySelector('[data-mis311-page]').textContent, String(index + 1));
      assert.equal(element.querySelectorAll('tspan').length, page.textSpans);
      assert.equal(element.querySelectorAll('image').length, page.illustrations);
      assert.ok(!element.innerHTML.includes('asset:'), `slide ${index + 1} resolves every illustration`);
      const text = [...element.querySelectorAll('tspan')].map(node => node.textContent).join('');
      const normalized = value => value.replace(/\s/g, '');
      assert.equal(normalized(text), normalized(page.text), `slide ${index + 1} preserves all extracted text in order`);
      for (const run of page.sourceTextRuns) {
        const unicode = run.replaceAll('\uf0e0', '→').replaceAll('\u00ad', '');
        assert.ok(normalized(text).includes(normalized(unicode)), `source slide ${page.sourceSlide} retains original PPTX text: ${run}`);
      }
      for (const image of element.querySelectorAll('image')) {
        assert.match(image.getAttribute('xlink:href') ?? image.getAttribute('href'), /^data:image\/(png|jpeg);base64,/);
      }
    }
    assert.ok(!code.includes('application/pdf'));
    assert.ok(!code.includes('data:application/pdf'));
    assert.equal(storyboard.assignedTemplate, '86101dcf-70f4-49c3-a6a9-983c77708ad2');
    assert.equal(manifest[binding.sectionId].preservesBusinessTemplate, false);
    window.happyDOM.abort();
  });
}

test('only the latest PPTX conversion remains in the course source tree', () => {
  assert.ok(!fs.existsSync('scripts/import-mis311-pdfs.py'));
  const pages = [1, 2].flatMap(session => JSON.parse(fs.readFileSync(`${root}/session${session}/storyboard.json`, 'utf8')).pages);
  assert.deepEqual(pages.map(page => page.sourceSlide), Array.from({ length: 55 }, (_, index) => index + 1));
  const used = new Set();
  for (const session of [1, 2]) for (const name of fs.readdirSync(`${root}/session${session}`).filter(name => name.endsWith('.svg'))) {
    const svg = fs.readFileSync(`${root}/session${session}/${name}`, 'utf8');
    for (const match of svg.matchAll(/asset:([a-f0-9]+\.(?:png|jpg))/g)) used.add(match[1]);
  }
  assert.deepEqual(fs.readdirSync(`${root}/assets`).sort(), [...used].sort(), 'obsolete illustrations have been removed');
  assert.ok(!fs.readdirSync(root, { recursive: true }).some(name => /\.(?:pdf|pptx)$/i.test(name)));
});

test('Section 1 moves all learning outcomes into the cover dialog with natural paragraph wrapping', () => {
  const window = new Window();
  const lessonModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session1.js`, 'utf8'), { module: lessonModule, document: window.document });
  const cover = lessonModule.exports.slides[0]();
  assert.ok(cover.querySelector('svg [data-mis311-process-background][aria-hidden="true"]'));
  window.document.body.append(cover);
  const trigger = cover.querySelector('button[aria-haspopup="dialog"]');
  assert.equal(trigger.textContent, 'Learning Outcomes');
  const dialog = cover.querySelector('dialog');
  for (const title of cover.querySelectorAll('svg text[fill="#ff0000"]')) assert.ok(title.getAttribute('transform').endsWith('translate(0 -72)'));
  const subtitles = [...cover.querySelectorAll('[data-mis311-cover-subtitle]')];
  assert.equal(subtitles.length, 3);
  assert.equal(new Set(subtitles.map(text => text.querySelector('tspan').getAttribute('y'))).size, 1);
  assert.ok(subtitles.every(text => text.getAttribute('transform').includes('scale(1.12)')));
  const source = JSON.parse(fs.readFileSync(`${root}/session1/storyboard.json`, 'utf8')).pages.find(page => page.sourceSlide === 2);
  const text = dialog.textContent.replace(/\s/g, '');
  for (const run of source.sourceTextRuns) assert.ok(text.includes(run.replace(/\s/g, '')));
  assert.equal(dialog.querySelectorAll('li').length, 3);
  for (const item of dialog.querySelectorAll('li')) assert.ok(!/[\r\n]|<br/i.test(item.innerHTML));
  trigger.click();
  assert.equal(dialog.open, true);
  dialog.querySelector('button').click();
  assert.equal(dialog.open, false);
  assert.ok(!lessonModule.exports.slides[1]().textContent.includes('Learning Outcomes'));
  window.happyDOM.abort();
});

test('organisation chart starts with only Managing Director and reveals each reporting branch independently', () => {
  const window = new Window();
  const lessonModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session1.js`, 'utf8'), { module: lessonModule, document: window.document });
  const chart = lessonModule.exports.slides[1]();
  const visible = () => [...chart.querySelectorAll('[data-org-node]')].filter(node => !node.closest('[hidden]')).map(node => node.textContent);
  const click = label => chart.querySelector(`[data-org-node="${label}"]`).click();
  assert.deepEqual(visible(), ['Managing Director']);
  click('Managing Director');
  assert.deepEqual(visible(), ['Managing Director', 'Marketing Director', 'Finance Director', 'Operations Director', 'HRM Director']);
  click('Marketing Director');
  assert.ok(visible().includes('Marketing Managers'));
  assert.ok(!visible().includes('Finance Supervisors'));
  assert.ok(!visible().includes('Sales Teams'));
  click('Marketing Managers');
  assert.ok(visible().includes('Sales Teams'));
  click('Finance Director');click('Finance Supervisors');
  click('Operations Director');click('Production Team Leaders');click('HRM Director');
  assert.equal(visible().length, 12);
  click('Managing Director');
  assert.deepEqual(visible(), ['Managing Director']);
  click('Managing Director');
  assert.equal(visible().length, 5);
  window.happyDOM.abort();
});
