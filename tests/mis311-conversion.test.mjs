import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { Window } from 'happy-dom';
import { formerSection2Slide } from './helpers/mis311-fixture.mjs';

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

for (const [session, count] of [[1, 20], [2, 10]]) {
  test(`MIS 311 session ${session}: all ${count} displayed pages render with native text and embedded illustrations`, async () => {
    const window = new Window();
    const lessonModule = { exports: {} };
    const file = `${root}/Week7Session${session}.js`;
    const code = fs.readFileSync(file, 'utf8');
    await validation.exports.validateSectionContent(Buffer.from(code), `Week7Session${session}.js`);
    vm.runInNewContext(code, { module: lessonModule, document: window.document });
    const storyboard = JSON.parse(fs.readFileSync(`${root}/session${session}/storyboard.json`, 'utf8'));
    assert.equal(lessonModule.exports.slides.length, count);
    assert.equal(storyboard.pageCount, session === 1 ? 22 : 33);
    assert.equal(storyboard.sourceFilename, 'MIS 311_Week 7.pptx');
    assert.equal(storyboard.sourceSlideCount, 55);
    assert.deepEqual(storyboard.sourceSlideRange, session === 1 ? [1, 22] : [23, 55]);
    assert.equal(fs.readdirSync(`${root}/session${session}`).filter(name => /^page-\d+\.svg$/.test(name)).length, storyboard.pageCount);
    const binding = bindings.find(item => item.path === file);
    assert.equal(binding.courseId, '86cae0a3-9ada-4e31-b4d4-c83f50cafaf6');
    assert.equal(manifest[binding.sectionId].revision, crypto.createHash('sha256').update(code).digest('hex'));
    assert.equal(manifest[binding.sectionId].teachingSlides, count);
    assert.equal(manifest[binding.sectionId].learnerSlides, count);
    for (const [index, render] of lessonModule.exports.slides.entries()) {
      const element = render();
      if (session === 2 && index === 1) {
        assert.ok(element.querySelector('[data-mis311-rca-hub]'));
        assert.equal(element.querySelector('h1').textContent,'Root Cause Analysis');
        assert.equal(element.querySelectorAll('[data-rca-open]').length,5);
        assert.equal(element.querySelector('[data-mis311-page]').textContent, '2');
        continue;
      }
      const expectedSource = session === 1 ? index === 0 ? 1 : index + 3 : [23,null,36,...Array.from({length:17},(_,i)=>i+39).filter(n=>![40,41,42,43,44,47,48,49,54,55].includes(n))][index];
      const page = storyboard.pages.find(page=>page.sourceSlide===expectedSource);
      assert.ok(page, `displayed slide ${index+1} resolves its original source`);
      if (session === 1 && page.sourceSlide === 4) {
        assert.ok(element.querySelector('[data-mis311-org-chart]'));
        assert.equal(element.querySelectorAll('svg,image').length, 0);
        assert.equal(element.querySelector('h1').textContent, 'Company Organisation');
        assert.ok(!element.querySelector('.mis311-org-intro'));
        assert.ok(!element.textContent.includes('Company has different departments'));
        continue;
      }
      if (session === 2 && page.sourceSlide === 25) {
        assert.ok(element.querySelector('[data-mis311-comparison]'));
        assert.equal(element.querySelectorAll('svg,img,image').length, 0);
        assert.equal(element.querySelector('h1').textContent, 'Symptom Approach vs. Root Cause');
        continue;
      }
      if (session === 2 && page.sourceSlide === 27) {
        assert.ok(element.querySelector('[data-mis311-process]'));
        assert.equal(element.querySelectorAll('.mis311-process-step').length, 7);
        assert.equal(element.querySelectorAll('svg,img,image').length, 0);
        continue;
      }
      if (session === 2 && page.sourceSlide === 28) {
        assert.ok(element.querySelector('[data-mis311-tree] svg'));
        assert.equal(element.querySelectorAll('image,img').length, 0);
        assert.equal(element.querySelector('[data-tree-trigger]').textContent, 'Problem');
        continue;
      }
      if (session === 2 && page.sourceSlide === 29) {
        assert.ok(element.querySelector('[data-mis311-mapping]'));
        assert.equal(element.querySelectorAll('svg,img,image').length,0);
        assert.equal(element.querySelectorAll('.mis311-map-phase').length,3);
        continue;
      }
      if (session === 2 && page.sourceSlide === 31) {
        assert.ok(element.querySelector('[data-mis311-tools]'));
        assert.equal(element.querySelectorAll('[data-tool-key]').length,4);
        continue;
      }
      if (session === 2 && page.sourceSlide === 37) {
        assert.ok(element.querySelector('[data-mis311-exercise]'));
        assert.equal(element.querySelectorAll('svg [data-defect-group]').length,6);
        continue;
      }
      if (session === 2 && page.sourceSlide === 39) {
        assert.ok(element.querySelector('[data-mis311-vsm-hub]'));
        assert.equal(element.querySelector('h1').textContent,'Value Stream Mapping');
        continue;
      }
      if (session === 2 && page.sourceSlide === 41) {
        assert.ok(element.querySelector('[data-mis311-vsm-parts]'));
        assert.equal(element.querySelectorAll('.mis311-vsp-step').length,5);
        continue;
      }
      if (session === 2 && [44,45].includes(page.sourceSlide)) {
        assert.ok(element.querySelector('[data-mis311-vsm-followup]'));
        assert.equal(element.querySelector('h1').textContent,page.sourceSlide===44?'Importance of a VSM':'Activity');
        continue;
      }
      if (session === 2 && page.sourceSlide === 46) {assert.ok(element.querySelector('[data-mis311-conflict-hub]'));continue;}
      if (session === 2 && [47,50,51,52].includes(page.sourceSlide)) {
        assert.ok(element.querySelector('[data-mis311-conflict]'));
        assert.equal(element.querySelectorAll('image,img').length,0);
        continue;
      }
      if (session === 2 && page.sourceSlide === 53) {
        assert.ok(element.querySelector('[data-mis311-persuasion]'));
        assert.equal(element.querySelector('h1').textContent,'Psychology of persuasion');continue;
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
        const unicode = run.replaceAll('\uf0e0', '→').replaceAll('\u00ad', '').replace(/skipped\.$/, page.sourceSlide === 36 ? 'skipped).' : 'skipped.');
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


test('Section 2 matches the Section 1 cover style and omits Learning Outcomes entirely', () => {
  const window = new Window();
  const load = session => {
    const lessonModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(`${root}/Week7Session${session}.js`, 'utf8'), { module: lessonModule, document: window.document });
    return lessonModule.exports.slides;
  };
  const firstCover = load(1)[0]();
  const slides = load(2);
  const cover = slides[0]();
  assert.equal(cover.querySelector('svg').outerHTML, firstCover.querySelector('svg').outerHTML);
  assert.equal(cover.querySelectorAll('button, dialog').length, 0);
  assert.equal(slides.length, 10);
  assert.match(slides[1]().textContent, /Root Cause Analysis/);
  for (const [index, render] of slides.entries()) {
    const slide = render();
    assert.ok(!slide.textContent.includes('Learning Outcomes'));
    assert.equal(slide.querySelector('[data-mis311-page]').textContent, String(index + 1));
  }
  const attachment = JSON.parse(fs.readFileSync(`${root}/attachment.json`, 'utf8'));
  assert.equal(attachment.sections[1].slide_count, slides.length);
  window.happyDOM.abort();
});


test('RCA keeps each question and column independent and preserves revealed answers when switching questions', () => {
  const window = new Window();
  const lessonModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`, 'utf8'), { module: lessonModule, document: window.document });
  const slide = formerSection2Slide(lessonModule.exports.slides,2);
  const questions = [...slide.querySelectorAll('.mis311-rca-question')];
  const reveal = kind => slide.querySelector(`[data-reveal-kind="${kind}"]`);
  const answers = [...slide.querySelectorAll('.mis311-rca-answer')];
  assert.equal(questions.length, 3);
  assert.equal(slide.querySelectorAll('.mis311-rca-panel').length, 2);
  assert.ok(answers.every(node => node.hidden));
  assert.equal(slide.querySelectorAll('.mis311-rca-reset').length, 0);
  assert.equal(slide.querySelectorAll('img,image').length,0);assert.equal(slide.querySelectorAll('[data-open-tree] svg').length,1);
  assert.ok(!slide.textContent.includes('If we do a poor job'));
  slide.querySelectorAll('.mis311-rca-body')[1].click();
  assert.equal(answers[0].hidden, true);
  assert.equal(answers[1].hidden, false);
  questions[1].click();
  assert.ok(answers.every(node => node.hidden));
  reveal('symptom').click();
  assert.equal(answers[0].hidden, false);
  assert.equal(answers[1].hidden, true);
  questions[0].click();
  assert.equal(answers[0].hidden, true);
  assert.equal(answers[1].hidden, false);
  for (const question of questions) {
    question.click(); reveal('symptom').click(); reveal('rootCause').click();
  }
  for (const question of questions) {
    question.click(); assert.ok(answers.every(node => !node.hidden));
  }
  assert.equal(slide.querySelector('[role=status]'), null);
  assert.ok(!/Click|Choose|revealed|\d\s*\/\s*[26]/i.test(slide.textContent));
  assert.equal(questions[2].getAttribute('aria-pressed'), 'true');
  window.happyDOM.abort();
});

test('Section 2 slide 5 preserves every process instruction as ordered flowchart bullets', () => {
  const window = new Window();
  const lessonModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`, 'utf8'), { module: lessonModule, document: window.document });
  const slide = formerSection2Slide(lessonModule.exports.slides,4);
  const source = JSON.parse(fs.readFileSync(`${root}/session2/storyboard.json`, 'utf8')).pages.find(page => page.sourceSlide === 27);
  const cards = [...slide.querySelectorAll('.mis311-process-flow > li')];
  assert.equal(cards.length, 7);
  assert.deepEqual(cards.map(card => card.querySelector('.mis311-process-number').textContent), ['1','2','3','4','5','6','7']);
  const normalized = value => value.replace(/\s/g, '');
  const text = normalized([...slide.querySelectorAll('.mis311-process-step ul')].map(list => list.textContent).join(''));
  for (const run of source.sourceTextRuns.slice(1)) assert.ok(text.includes(normalized(run)), run);
  assert.equal(slide.querySelector('h1').textContent, 'General process for performing root cause analysis (RCA)');
  assert.ok(cards.every(card => card.querySelector('h2') && card.querySelectorAll('ul > li').length > 0));
  assert.equal(slide.querySelectorAll('.mis311-process-arrow[aria-hidden=true]').length, 6);
  assert.equal(slide.closest('.slide').querySelector('[data-mis311-page]').textContent, '2');
  assert.equal(slide.querySelector('[data-mis311-content]').style.overflow, 'auto');
  assert.equal(slide.style.backgroundImage, '');
  window.happyDOM.abort();
});


test('the SVG tree reveals symptoms on the first click and causes only on the second click', () => {
  const window = new Window();
  const lesson = { exports: {} };
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`, 'utf8'), { module: lesson, document: window.document });
  const slide = formerSection2Slide(lesson.exports.slides,3);
  const content = slide.querySelector('[data-mis311-tree]');
  const trigger = slide.querySelector('[data-tree-trigger]');
  assert.equal(trigger.textContent, 'Problem');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.ok([...slide.querySelectorAll('.mis311-tree-phase')].every(group => group.getAttribute('aria-hidden') === 'true'));
  assert.equal(slide.querySelectorAll('svg image,img').length, 0);
  trigger.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(content.dataset.open, 'true');
  assert.equal(content.dataset.restored, undefined);
  assert.equal(content.dataset.step, '1');
  assert.equal(slide.querySelector('[data-tree-phase=leaves]').getAttribute('aria-hidden'), null);
  assert.equal(slide.querySelector('[data-tree-phase=symptom-explanation]').getAttribute('aria-hidden'), null);
  assert.equal(slide.querySelector('[data-tree-phase=roots]').getAttribute('aria-hidden'), 'true');
  assert.equal(slide.querySelector('[data-tree-phase=cause-explanation]').getAttribute('aria-hidden'), 'true');
  assert.equal(trigger.getAttribute('aria-disabled'), 'false');
  assert.equal(slide.querySelectorAll('.mis311-tree-notes p').length, 2);
  assert.equal(slide.querySelectorAll('.mis311-tree-notes br,svg foreignObject').length, 0);
  assert.match(slide.textContent, /Above the surface/);
  assert.match(slide.textContent, /Dig deeper and/);
  trigger.dispatchEvent(new window.Event('click'));
  assert.equal(content.dataset.open, 'true');
  assert.equal(content.dataset.step, '2');
  assert.ok([...slide.querySelectorAll('.mis311-tree-phase')].every(group => !group.hasAttribute('aria-hidden')));
  assert.equal(trigger.getAttribute('aria-disabled'), 'true');
  window.happyDOM.abort();
});


test('slide 5 starts with a centered title, shows one step per click and only then shows the overview', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,4);const content=slide.querySelector('[data-mis311-process]');
  const cards=[...slide.querySelectorAll('.mis311-process-step')];const flow=slide.querySelector('.mis311-process-flow');
  assert.equal(content.dataset.mode,'intro');assert.equal(flow.hidden,true);
  for(let step=1;step<=7;step++){
    if(step===1)content.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));else content.click();
    assert.equal(content.dataset.mode,'focus');assert.equal(content.dataset.processStep,String(step));
    assert.equal(flow.hidden,false);assert.deepEqual(cards.map((card,index)=>!card.hidden?index+1:null).filter(Boolean),[step]);
  }
  content.click();assert.equal(content.dataset.mode,'overview');assert.ok(cards.every(card=>!card.hidden));
  content.click();assert.equal(content.dataset.processStep,'8');assert.equal(content.getAttribute('role'),'group');
  window.happyDOM.abort();
});


test('the RCA topic hub retains the system template and four full-title resource buttons', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const cover=lesson.exports.slides[1]();assert.equal(cover.querySelector('h1').textContent,'Root Cause Analysis');
  assert.equal(cover.style.backgroundImage,'');assert.equal(cover.dataset.eiuTemplate,'system');
  assert.deepEqual([...cover.querySelectorAll('[data-rca-open]')].map(button=>button.textContent),['Symptom Approach vs. Root Cause','General process for performing root cause analysis (RCA)','Cause Mapping & MECE','Tools for RCA','Exercise']);
  assert.equal(cover.querySelectorAll('.mis311-rca-hub-pane').length,0,'resource DOM is lazy');window.happyDOM.abort();
});


test('Section 2 slide 3 frames all seven practices and closes the final parenthesis', () => {
  const window=new Window(),lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(root+'/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=lesson.exports.slides[2]();
  const cards=[...slide.querySelectorAll('[data-best-practice]')];
  assert.equal(cards.length,7);
  for(const [index,card] of cards.entries()){
    assert.ok(card.querySelector('rect'));
    assert.equal(card.querySelector('text').textContent,String(index+1));
  }
  assert.match(cards[6].textContent,/equal \(but some steps can’t be skipped\)\./);
  assert.equal(slide.querySelector('[data-mis311-page]').textContent,'3');
  window.happyDOM.abort();
});

test('RCA uses one simple coffee example with consistent timings and no explanatory annotations', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(root+'/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,5);
  assert.equal(slide.querySelector('h1').textContent,'Cause Mapping & MECE');
  assert.deepEqual([...slide.querySelectorAll('.mis311-map-layout h2')].map(node=>node.textContent),['MECE','Cause Mapping']);
  assert.equal(slide.querySelector('.mis311-map-subtitle,.mis311-map-scope,.mis311-map-context'),null);
  assert.deepEqual([...slide.querySelectorAll('.mis311-map-phase h3')].map(node=>node.textContent),['Define','Analyze','Prevent']);
  assert.deepEqual([...slide.querySelectorAll('.mis311-map-tag')].map(node=>node.textContent),['No overlap','No gaps']);
  const config=JSON.parse(fs.readFileSync(root+'/session2/presentation.json','utf8'));
  const example=config.causeMapping.workedExample;
  assert.equal(example.title,'A slow coffee');
  assert.equal(example.context,undefined);
  assert.ok(example.steps.every(step=>!step.intro));
  const buckets=example.steps[1].buckets;
  assert.deepEqual(buckets.map(bucket=>bucket.count),[1,8,1]);
  assert.equal(buckets.reduce((sum,bucket)=>sum+bucket.count,0),10);
  assert.match(example.steps[2].chain.join(' '),/No opening checklist.*Milk not ready.*6 minutes.*10-minute/);
  assert.deepEqual(example.steps[2].bullets,['Make coffee: 2 minutes','Fetch milk: 6 minutes']);
  assert.deepEqual(example.steps[3].buckets.map(bucket=>bucket.count),[1,2,1]);
  assert.equal(example.steps[3].buckets.reduce((sum,bucket)=>sum+bucket.count,0),4);
  assert.match(example.steps[3].title,/milk check before opening/);
  assert.ok(!slide.textContent.includes('Late dispatch'));
  assert.deepEqual(config.causeMapping.mergedSourceSlides,[29,30]);
  assert.ok(config.hiddenSourceSlides.includes(30));assert.equal(lesson.exports.slides.length,10);
  window.happyDOM.abort();
});

test('one RCA worked example supports four accessible steps, nested Escape, focus return and termination', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(root+'/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const rootSlide=lesson.exports.slides[1]();window.document.body.append(rootSlide);
  const hubTrigger=rootSlide.querySelector('[data-rca-open=mapping]');hubTrigger.click();
  const slide=rootSlide.querySelector('[data-rca-hub-pane=mapping]');
  const trigger=slide.querySelector('[data-example-kind]'),dialog=slide.querySelector('dialog');
  assert.equal(slide.querySelectorAll('[data-example-kind]').length,1);
  trigger.click();assert.equal(dialog.open,true);
  const tabs=[...dialog.querySelectorAll('[role=tab]')],panels=[...dialog.querySelectorAll('[role=tabpanel]')];
  assert.equal(tabs.length,4);
  for(let i=0;i<tabs.length;i++){
    tabs[i].click();assert.equal(tabs[i].getAttribute('aria-selected'),'true');
    assert.equal(panels.filter(panel=>!panel.hidden).length,1);assert.equal(panels[i].hidden,false);
    assert.equal(window.document.getElementById(tabs[i].getAttribute('aria-controls')),panels[i]);
  }
  tabs[3].dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  assert.equal(window.document.activeElement,tabs[0]);assert.equal(panels[0].hidden,false);
  tabs[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
  assert.equal(window.document.activeElement,tabs[3]);
  tabs[3].dispatchEvent(new window.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));
  tabs[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
  assert.equal(window.document.activeElement,tabs[3]);
  tabs[2].click();assert.equal(dialog.querySelectorAll('.mis311-map-causal>li').length,4);
  assert.equal(dialog.querySelector('.mis311-map-and'),null);
  assert.match(panels[2].textContent,/Milk not ready/);
  dialog.querySelector('.mis311-map-close').click();assert.equal(dialog.open,false);assert.equal(window.document.activeElement,trigger);
  trigger.click();dialog.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(dialog.open,false);assert.equal(rootSlide.querySelector('.mis311-rca-hub-dialog').open,true);
  assert.equal(window.document.activeElement,trigger);
  trigger.click();window.eiuSectionEnded=true;window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(rootSlide.querySelectorAll('dialog[open]').length,0);trigger.click();assert.equal(dialog.open,false);
  window.happyDOM.abort();
});


test('slide 7 removes reference actions and provides three native illustrative RCA charts', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,6);window.document.body.append(slide);
  const primary=slide.querySelector('#mis311-tool-details');
  assert.equal(slide.querySelectorAll('dialog').length,1);
  for(const button of slide.querySelectorAll('[data-tool-key]')){
    button.click();assert.equal(primary.open,true);
    assert.equal(primary.querySelector('[data-open-reference],[data-open-template]'),null);
    assert.ok(!/Blank template|Full reference|Enlarge diagram/.test(primary.textContent));
    primary.querySelector('[aria-label="Close tool"]').click();
    assert.equal(primary.open,false);assert.equal(window.document.activeElement,button);
  }
  slide.querySelector('[data-tool-key=charts]').click();
  const tabs=[...primary.querySelectorAll('[data-chart-key]')];
  assert.deepEqual(tabs.map(tab=>tab.textContent),['Run Chart','Histogram','Scatter Diagram']);
  for(const tab of tabs){
    tab.click();assert.equal(tab.getAttribute('aria-pressed'),'true');
    assert.equal(tabs.filter(item=>item.getAttribute('aria-pressed')==='true').length,1);
    assert.equal(primary.querySelector('[data-active-chart]').dataset.activeChart,tab.dataset.chartKey);
    const svg=primary.querySelector('svg');assert.match(svg.getAttribute('aria-label'),/Illustrative data/);
    assert.equal(svg.querySelectorAll('[data-chart-mark]').length,tab.dataset.chartKey==='histogram'?7:8);
    assert.equal(primary.querySelectorAll('img,image').length,0);
    assert.equal(primary.querySelectorAll('.mis311-rca-chart-notes p').length,2);
  }
  assert.match(primary.textContent,/not proof of causation/);
  assert.match(formerSection2Slide(lesson.exports.slides,7).textContent,/7 Best Practices to remember/);
  window.happyDOM.abort();
});

test('5 Whys keeps all six statements while Fishbone switches one diagram at a time', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,6);window.document.body.append(slide);
  const primary=slide.querySelector('#mis311-tool-details');
  slide.querySelector('[data-tool-key=fiveWhys]').click();
  const cards=[...primary.querySelectorAll('.mis311-why-card')];assert.equal(cards.length,6);
  assert.equal(cards[0].querySelector('p').textContent,'The vehicle will not start');
  assert.equal(cards[5].querySelector('p').textContent,'The vehicle was not maintained according to the recommended maintenance schedule.');
  const next=primary.querySelector('[aria-label="Next why"]'),previous=primary.querySelector('[aria-label="Previous why"]');
  assert.equal(previous.disabled,true);
  for(let index=1;index<6;index++){next.click();assert.equal(cards[index].dataset.current,'true');}
  assert.equal(next.disabled,true);previous.click();assert.equal(cards[4].dataset.current,'true');
  assert.equal(primary.querySelector('[data-open-template]'),null);
  primary.querySelector('button[aria-label="Close tool"]').click();
  slide.querySelector('[data-tool-key=fishbone]').click();
  assert.equal(primary.querySelectorAll('[data-original-source-slide]').length,1);
  assert.equal(primary.querySelector('[data-original-source-slide]').dataset.originalSourceSlide,'32');
  primary.querySelector('[data-fishbone-source="33"]').click();
  assert.equal(primary.querySelectorAll('[data-original-source-slide]').length,1);
  assert.equal(primary.querySelector('[data-original-source-slide]').dataset.originalSourceSlide,'33');
  window.happyDOM.abort();
});

test('the merged original slides 13-14 retain Objective, Scenario and all 13 causes with independent group reveals', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,8);
  const content=slide.querySelector('[data-mis311-exercise]');for(let click=0;click<5;click++)content.click();
  const source=JSON.parse(fs.readFileSync(`${root}/session2/storyboard.json`,'utf8')).pages.find(page=>page.sourceSlide===37);
  for(const run of source.sourceTextRuns)assert.ok(slide.textContent.includes(run.trim().replace('Management has asked you','The manager has asked you')),run);
  const svgButtons=[...slide.querySelectorAll('svg [data-defect-group]')];
  const mobileButtons=[...slide.querySelectorAll('button[data-defect-group]')];
  const causes=[...slide.querySelectorAll('.mis311-defect-causes')];
  assert.deepEqual(svgButtons.map(button=>button.getAttribute('aria-label')),['People','Materials','Environment','Process','Machines','Management']);
  assert.equal(slide.querySelectorAll('.mis311-defect-causes text').length,13);
  assert.ok(causes.every(group=>group.hasAttribute('hidden')));
  svgButtons[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal(causes[0].hasAttribute('hidden'),false);
  assert.ok(causes.slice(1).every(group=>group.hasAttribute('hidden')));
  assert.equal(mobileButtons[0].getAttribute('aria-expanded'),'true');
  mobileButtons[3].click();assert.equal(causes[3].hasAttribute('hidden'),false);assert.equal(causes[1].hasAttribute('hidden'),true);
  for(const button of svgButtons)button.dispatchEvent(new window.Event('click'));
  assert.ok(causes.every(group=>!group.hasAttribute('hidden')));
  const expected=['Low Experience','High Turnover','Inadequate Training','Frequent Supplier Changes','Inferior Materials','Dust or Humidity Issues','Uncontrolled Temperature','Lack of Standards','Inconsistent Quality Checks','Outdated Equipment','Frequent Breakdowns','Lack of Oversight','Limited QA Resources'];
  assert.deepEqual([...slide.querySelectorAll('.mis311-defect-causes text')].map(node=>node.textContent),expected);
  assert.match(formerSection2Slide(lesson.exports.slides,9).textContent,/Value Stream Mapping/);
  window.happyDOM.abort();
});


test('the Pareto primary figure preserves its source mask and clips away the duplicate title and notes', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,6);window.document.body.append(slide);
  slide.querySelector('[data-tool-key=pareto]').click();
  const primary=slide.querySelector('#mis311-tool-details');
  const figure=primary.querySelector('.mis311-pareto-layout svg');
  assert.equal(figure.getAttribute('viewBox'),'47.593 128.12702 484.03 371.87');
  assert.ok(figure.querySelector('mask image'));
  assert.equal(figure.querySelectorAll('image').length,2);
  assert.ok(figure.querySelector('clipPath[id^="mis311-pareto-crop-"] rect'));
  assert.equal(primary.querySelectorAll('.mis311-pareto-notes li').length,2);
  window.happyDOM.abort();
});


test('slide 9 stages the title, Objective, Scenario, axis and categories over five clicks', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,8),content=slide.querySelector('[data-mis311-exercise]'),story=slide.querySelector('.mis311-defect-story'),diagram=slide.querySelector('.mis311-defect-diagram'),heading=slide.querySelector('.mis311-defect-diagram-title');
  const groups=[...slide.querySelectorAll('svg [data-defect-group]')];
  assert.equal(content.dataset.exerciseMode,'intro');assert.equal(story.hidden,true);assert.equal(diagram.hidden,true);assert.equal(heading.hidden,true);
  content.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal(content.dataset.exerciseMode,'objective');assert.equal(story.children[0].hidden,false);assert.equal(story.children[1].hidden,true);
  content.click();assert.equal(content.dataset.exerciseMode,'scenario');assert.equal(story.children[0].hidden,true);assert.equal(story.children[1].hidden,false);
  content.click();assert.equal(content.dataset.exerciseMode,'assembled');assert.ok([...story.children].every(node=>!node.hidden));assert.equal(diagram.hidden,true);
  content.click();assert.equal(content.dataset.exerciseMode,'axis');assert.equal(heading.hidden,false);assert.equal(diagram.hidden,false);assert.ok(groups.every(group=>group.hasAttribute('hidden')));
  assert.equal(slide.querySelectorAll('.mis311-defect-diagram-title').length,1);assert.ok(slide.querySelector('[data-defect-axis] .mis311-defect-spine'));
  content.click();assert.equal(content.dataset.exerciseMode,'interactive');assert.ok(groups.every(group=>!group.hasAttribute('hidden')));
  assert.ok([...slide.querySelectorAll('.mis311-defect-causes')].every(group=>group.hasAttribute('hidden')));
  groups[0].dispatchEvent(new window.MouseEvent('click',{bubbles:true}));assert.equal(content.dataset.exerciseStage,'5');assert.equal(slide.querySelector('.mis311-defect-causes').hasAttribute('hidden'),false);
  content.click();assert.equal(content.dataset.exerciseStage,'5');
  window.happyDOM.abort();
});


test('slide 4 groups the VSM definition before the enlarged example and preserves car annotations', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,9);window.document.body.append(slide);
  const help=slide.querySelector('[data-rca-open=definition]'),dialog=slide.querySelector('dialog');
  assert.equal(help.textContent,'What is it ?');assert.equal(dialog.open,false);
  help.click();assert.equal(dialog.open,true);
  const config=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8')).valueStreamIntro;
  const paragraphs=[...dialog.querySelectorAll('.mis311-vsm-copy p')].map(p=>p.textContent);
  assert.deepEqual(paragraphs,[config.definition]);
  assert.deepEqual([...dialog.querySelector('.mis311-vsm-body').children].map(node=>node.className),['mis311-vsm-copy','mis311-vsm-example']);
  assert.equal(dialog.querySelector('header,h2'),null);
  assert.equal(dialog.getAttribute('aria-describedby'),dialog.querySelector('.mis311-vsm-copy p').id);
  assert.equal(dialog.querySelector('strong').textContent,'\u201cbirds eye view\u201d');
  assert.equal(dialog.querySelector('img,figcaption'),null);
  assert.equal(dialog.querySelector('[data-vsm-aerial] image').getAttribute('href'),`data:image/jpeg;base64,${fs.readFileSync(`${root}/assets/${config.exampleAsset}`).toString('base64')}`);
  assert.ok(!dialog.textContent.includes('This means that'));
  const example=dialog.querySelector('.mis311-vsm-example');
  const rings=[...example.querySelectorAll('[data-vsm-car-ring]')];
  assert.equal(rings.length,4);assert.ok(rings.every(ring=>ring.hasAttribute('hidden')));
  example.click();assert.equal(example.getAttribute('aria-pressed'),'true');assert.ok(rings.every(ring=>!ring.hasAttribute('hidden')));
  for(const [index,ring] of rings.entries()){
    const cx=Number(ring.getAttribute('cx')),cy=Number(ring.getAttribute('cy')),rx=Number(ring.getAttribute('rx')),ry=Number(ring.getAttribute('ry'));
    // Car extents measured from the source illustration, with space for wheels and stroke.
    const center=[50,158,266,374][index];
    for(const px of [center-13,center+13])for(const py of [220,269])assert.ok(((px-cx)/(rx-1))**2+((py-cy)/(ry-1))**2<1);
  }
  assert.equal(slide.querySelector('.mis311-rca-hub-art').getAttribute('aria-hidden'),'true');
  dialog.querySelector('[aria-label="Return to Value Stream Mapping"]').click();assert.equal(dialog.open,false);assert.equal(window.document.activeElement,help);
  help.click();assert.equal(dialog.open,true);
  assert.ok(formerSection2Slide(lesson.exports.slides,10).querySelector('[data-mis311-vsm-parts]'));
  window.happyDOM.abort();
});


test('the former slide 12 uses title-only flow steps and embeds all symbols and the example beside them', () => {
  const window=new Window();window.happyDOM.setWindowSize({width:1280,height:720});const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,10);window.document.body.append(slide);
  const config=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8')).valueStreamParts;
  const rows=[...slide.querySelectorAll('.mis311-vsp-step')];assert.equal(rows.length,5);
  assert.deepEqual(rows.map(row=>row.querySelector('h2').textContent),config.steps.map(step=>step.title));
  assert.equal(slide.querySelectorAll('.mis311-vsp-step p,dialog').length,0);
  assert.ok(!slide.textContent.includes('It is always good to put a number'));
  assert.equal(rows[2].querySelector('[data-step-icon]').dataset.stepIcon,'arrow');
  assert.equal(rows[3].querySelector('[data-step-icon]').dataset.stepIcon,'star');
  assert.equal(rows[4].querySelector('[data-step-icon]'),null);
  const arrows=[...slide.querySelectorAll('.mis311-vsp-flow-arrow')];assert.equal(arrows.length,4);
  assert.deepEqual(arrows.map(arrow=>arrow.style.getPropertyValue('--flow-index')),['0','1','2','3']);
  const symbols=slide.querySelector('[data-vsm-details=symbols]'),example=slide.querySelector('[data-vsm-details=example]'),panel=slide.querySelector('.mis311-vsp-panel');
  assert.equal(symbols.getAttribute('aria-pressed'),'true');assert.equal(panel.dataset.kind,'symbols');
  const names=[],descriptions=[];const pages=[...panel.querySelectorAll('[data-symbol-page-button]')];assert.equal(pages.length,9);
  for(const page of pages){page.click();assert.equal(page.getAttribute('aria-current'),'page');const cards=[...panel.querySelectorAll('[data-symbol-name]')];assert.equal(cards.length,4);for(const card of cards){names.push(card.querySelector('h3').textContent);if(card.querySelector('p'))descriptions.push(card.querySelector('p').textContent);assert.ok(card.querySelector('clipPath rect'));assert.match(card.querySelector('image').getAttribute('href'),/^data:image\/png;base64,/);}}
  assert.deepEqual(names,config.symbols.map(symbol=>symbol.name));assert.equal(new Set(names).size,36);
  assert.deepEqual(descriptions,config.symbols.filter(symbol=>symbol.description).map(symbol=>symbol.description));
  example.click();assert.equal(panel.dataset.kind,'example');assert.equal(example.getAttribute('aria-pressed'),'true');assert.equal(symbols.getAttribute('aria-pressed'),'false');
  const views=[...panel.querySelectorAll('[data-example-view-button]')];assert.equal(views.length,3);
  for(const tab of views){tab.click();assert.equal(tab.getAttribute('aria-pressed'),'true');assert.equal(panel.querySelector('figure').dataset.exampleView,tab.dataset.exampleViewButton);assert.equal(panel.querySelector('image').getAttribute('href'),`data:image/png;base64,${fs.readFileSync(`${root}/assets/${config.exampleAsset}`).toString('base64')}`);}
  views[0].click();assert.equal(panel.querySelector('svg').getAttribute('viewBox'),'0 0 980 503');
  symbols.click();assert.equal(panel.dataset.kind,'symbols');assert.equal(panel.querySelectorAll('[data-symbol-name]').length,4);
  assert.match(formerSection2Slide(lesson.exports.slides,11).textContent,/Importance of a VSM/);window.happyDOM.abort();
});

test('the inline symbol gallery adapts its page size on narrow screens and retains every symbol', () => {
  const window=new Window();window.happyDOM.setWindowSize({width:390,height:844});const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=formerSection2Slide(lesson.exports.slides,10);window.document.body.append(slide);
  const panel=slide.querySelector('.mis311-vsp-panel'),names=[];const pages=[...panel.querySelectorAll('[data-symbol-page-button]')];assert.equal(pages.length,18);
  for(const page of pages){page.click();const cards=[...panel.querySelectorAll('[data-symbol-name]')];assert.equal(cards.length,2);names.push(...cards.map(card=>card.dataset.symbolName));}
  assert.equal(new Set(names).size,36);
  slide.querySelector('[data-vsm-details=example]').click();
  const list=[...panel.querySelectorAll('.mis311-vsp-example-mobile li')];assert.equal(list.length,6);assert.ok(list.every(item=>item.textContent.includes('\u2192')));
  assert.match(list[5].textContent,/Notification/);window.happyDOM.abort();
});


test('slides 12 and 13 reflow VSM benefits and the complete activity into matching native layouts', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const config=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8')).valueStreamFollowup;
  const benefits=formerSection2Slide(lesson.exports.slides,11),activity=formerSection2Slide(lesson.exports.slides,12);
  assert.equal(benefits.querySelector('[data-mis311-vsm-followup]').dataset.mis311VsmFollowup,'importance');
  assert.deepEqual([...benefits.querySelectorAll('.mis311-vsf-benefit p')].map(node=>node.textContent),config[0].benefits.map(item=>item.before+item.emphasis+item.after));
  assert.equal(benefits.querySelectorAll('.mis311-vsf-benefit strong').length,4);
  assert.equal(activity.querySelector('.mis311-vsf-instruction').textContent,config[1].instruction);
  assert.deepEqual([...activity.querySelectorAll('.mis311-vsf-scenario')].map(node=>node.textContent),config[1].examples);
  assert.deepEqual([...activity.querySelectorAll('.mis311-vsf-question>p:first-child')].map(node=>node.textContent),config[1].questions);
  assert.equal(activity.querySelector('.mis311-vsf-waste-definition').textContent,config[1].wasteDefinition);
  assert.deepEqual([...activity.querySelectorAll('.mis311-vsf-wastes li')].map(node=>node.textContent),['Transportation','Inventory','Motion','Waiting','Over processing','Overproduction','Defects']);
  for(const slide of [benefits,activity]){assert.equal(slide.closest('.slide').dataset.eiuTemplate,'system');assert.equal(slide.style.backgroundImage,'');assert.equal(slide.querySelectorAll('img,image,input,textarea,button').length,0);for(const icon of slide.querySelectorAll('svg'))assert.equal(icon.getAttribute('aria-hidden'),'true');}
  assert.equal(activity.querySelector('[data-mis311-page]').textContent,'5');window.happyDOM.abort();
});


test('Conflict Resolution uses a matching topic cover and redraws all five TKI modes as native SVG', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const cover=formerSection2Slide(lesson.exports.slides,13),model=formerSection2Slide(lesson.exports.slides,14);
  assert.equal(cover.querySelector('h1').textContent,'Conflict Resolution');assert.ok(cover.querySelector('.mis311-rca-hub-art'));assert.equal(cover.style.backgroundImage,'');
  const config=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8')).conflictSections[1];
  const chart=model.querySelector('.mis311-tki-chart');assert.equal(chart.querySelectorAll('[data-tki-mode]').length,5);assert.equal(chart.querySelectorAll('image').length,0);
  for(const mode of config.modes){const group=chart.querySelector(`[data-tki-mode="${mode.name}"]`);assert.ok(group);const text=group.textContent;assert.ok(text.includes(mode.name.toUpperCase()));assert.ok(text.includes(mode.outcome));assert.ok(text.replace(/\s/g,'').includes(mode.phrase.replace(/\s/g,'')));}
  assert.match(chart.textContent,/ASSERTIVENESS/);assert.match(chart.textContent,/COOPERATIVENESS/);
  assert.equal(model.querySelectorAll('.mis311-tki-mobile-modes section').length,5);window.happyDOM.abort();
});

test('the conflict hub keeps every instruction and example in separate paged resources', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=lesson.exports.slides[5]();window.document.body.append(slide);
  const config=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8')).conflictSections[1],dialog=slide.querySelector('dialog');
  for(const kind of ['steps','example']){
    const key=kind==='steps'?'how':'example',trigger=slide.querySelector(`[data-rca-open=${key}]`);trigger.click();assert.equal(dialog.open,true);
    const pane=slide.querySelector(`[data-rca-hub-pane=${key}]`);assert.equal(pane.querySelector('h1').textContent,kind==='steps'?config.howTitle:config.problem);
    const header=pane.querySelector('.mis311-tki-resource-header');
    assert.equal(header.firstElementChild,pane.querySelector('h1'));
    assert.equal(header.lastElementChild,pane.querySelector('.mis311-tki-pages'));
    if(kind==='steps'){
      assert.equal(trigger.textContent,'How to use TKI');
      assert.equal(pane.querySelector('h1').textContent,'How to Use TKI in 3 Steps');
      assert.equal(pane.querySelector('[data-tki-worked-step]'),null);
    }
    const tabs=[...pane.querySelectorAll('[data-tki-page-button]')];assert.equal(tabs.length,3);
    for(const [index,tab] of tabs.entries()){tab.click();assert.equal(tab.getAttribute('aria-current'),'step');
      if(kind==='steps'){assert.equal(pane.querySelector('h3').textContent,config.steps[index].title);if(index===1)assert.deepEqual([...pane.querySelectorAll('.mis311-tki-choices li')].map(item=>item.textContent),config.steps[index].choices);else assert.equal(pane.querySelector('.mis311-tki-step-text').textContent,config.steps[index].text);}
      else{assert.equal(pane.querySelector('.mis311-tki-problem').textContent,config.problem);assert.equal(pane.querySelectorAll('.mis311-tki-problem').length,1);assert.equal(pane.querySelector('.mis311-tki-detail-view .mis311-tki-problem'),null);assert.equal(pane.querySelector('h3').textContent,config.cases[index].condition);assert.equal(pane.querySelector('strong').textContent,`Use ${config.cases[index].style}`);assert.equal(pane.querySelector('.mis311-tki-case p').textContent,config.cases[index].quote);assert.equal(pane.querySelector('.mis311-tki-conclusion').textContent,config.conclusion);}
    }
    dialog.querySelector('[aria-label="Return to Conflict Resolution"]').click();assert.equal(dialog.open,false);assert.equal(window.document.activeElement,trigger);
  }
  window.happyDOM.abort();
});

test('former slides 18-19 retain the scenario, discussion and reflection after the merge renumbers them', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const config=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8')).conflictSections;
  const discussion=formerSection2Slide(lesson.exports.slides,15),reflection=formerSection2Slide(lesson.exports.slides,16);
  assert.equal(discussion.querySelector('.mis311-tki-scenario').textContent,config[2].scenario);
  assert.deepEqual([...discussion.querySelectorAll('.mis311-tki-discussion li')].map(item=>item.textContent),config[2].questions);
  assert.deepEqual([...reflection.querySelectorAll('.mis311-tki-reflection p')].map(item=>item.textContent),config[3].questions);
  assert.equal(reflection.querySelector('h2').textContent,config[3].subtitle);
  assert.equal(discussion.querySelector('[data-mis311-page]').textContent,'7');assert.equal(reflection.querySelector('[data-mis311-page]').textContent,'8');
  for(const slide of [discussion,reflection]){assert.equal(slide.querySelectorAll('input,textarea,button').length,0);assert.equal(slide.dataset.eiuTemplate,'system');}
  window.happyDOM.abort();
});


test('suggested answers cover six principles across three resistance groups and return to the same case page', () => {
  const window=new Window(),lesson={exports:{}};
  window.eiuLessonTeaching=true;
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const slide=lesson.exports.slides[9]();window.document.body.append(slide);
  slide.querySelector('[data-persuasion-open=case]').click();
  const parent=slide.querySelector('#mis311-persuasion-details');
  assert.equal(parent.querySelector('[data-persuasion-answers]'),null);
  parent.querySelector('[data-persuasion-page-button="3"]').click();
  const trigger=parent.querySelector('[data-persuasion-answers]');trigger.click();
  const answers=parent.querySelector('#mis311-persuasion-answers');assert.equal(answers.open,true);
  assert.equal(answers.querySelectorAll('.mis311-pers-answer').length,3);
  assert.deepEqual([...answers.querySelectorAll('strong')].map(n=>n.textContent.replace(': ','')).sort(),['Authority','Consistency','Liking','Reciprocity','Scarcity','Social Proof'].sort());
  assert.match(answers.textContent,/If training places are limited/);
  answers.querySelector('[aria-label="Return to case study"]').click();
  assert.equal(answers.open,false);assert.equal(parent.open,true);assert.equal(window.document.activeElement,trigger);
  assert.equal(parent.querySelector('.mis311-pers-view').dataset.persuasionPage,'3');
  trigger.click();assert.equal(parent.querySelectorAll('#mis311-persuasion-answers').length,1);
  parent.close();assert.equal(answers.open,false);
  slide.querySelector('[data-persuasion-open=case]').click();parent.querySelector('[data-persuasion-page-button="3"]').click();
  window.eiuSectionEnded=true;parent.querySelector('[data-persuasion-answers]').click();assert.equal(answers.open,false);
  window.happyDOM.abort();
});

test('Learning Access never renders suggested answers; only the explicit Admin/Teaching flag enables them', () => {
  for(const teaching of [undefined,false,true]){
    const window=new Window(),lesson={exports:{}};window.eiuLessonTeaching=teaching;
    vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
    const slide=lesson.exports.slides[9]();window.document.body.append(slide);
    slide.querySelector('[data-persuasion-open=case]').click();slide.querySelector('[data-persuasion-page-button="3"]').click();
    assert.equal(slide.querySelectorAll('.mis311-pers-resistance li').length,3);
    const trigger=slide.querySelector('[data-persuasion-answers]');assert.equal(Boolean(trigger),teaching===true);
    if(trigger){window.eiuLessonTeaching=false;trigger.click();assert.equal(slide.querySelector('#mis311-persuasion-answers'),null,'an old teaching button cannot open answers after role removal');}
    assert.equal(slide.querySelector('.mis311-pers-answer'),null);
    assert.ok(!slide.textContent.includes('Offer Power BI training'));
    window.happyDOM.abort();
  }
});

test('slide 18 keeps all four conflict tips and slide 19 merges the six principles and complete case study', () => {
  const window=new Window();const lesson={exports:{}};
  vm.runInNewContext(fs.readFileSync(`${root}/Week7Session2.js`,'utf8'),{module:lesson,document:window.document});
  const presentation=JSON.parse(fs.readFileSync(`${root}/session2/presentation.json`,'utf8'));
  const tips=formerSection2Slide(lesson.exports.slides,17);assert.deepEqual([...tips.querySelectorAll('.mis311-tki-tips p')].map(node=>node.textContent),presentation.conflictSections.find(item=>item.kind==='tips').tips);
  const slide=formerSection2Slide(lesson.exports.slides,18);window.document.body.append(slide);const dialog=slide.querySelector('dialog'),config=presentation.persuasion;
  for(const kind of ['principles','case']){
    const trigger=slide.querySelector(`[data-persuasion-open=${kind}]`);trigger.click();assert.equal(dialog.open,true);
    const pages=[...dialog.querySelectorAll('[data-persuasion-page-button]')];assert.equal(pages.length,kind==='principles'?6:3);
    for(const [index,page] of pages.entries()){page.click();assert.equal(page.getAttribute('aria-current'),'page');
      if(kind==='principles'){assert.equal(dialog.querySelector('h3').textContent,config.principles[index].name);assert.equal(dialog.querySelector('.mis311-pers-principle p').textContent,config.principles[index].definition);}
      else if(index<2){if(index===0)assert.equal(dialog.querySelector('h3').textContent,config.caseTitle);assert.equal(dialog.querySelector('.mis311-pers-background p').textContent,config.backgroundParts[index]);}
      else{assert.deepEqual([...dialog.querySelectorAll('.mis311-pers-resistance li')].map(node=>node.textContent),config.resistance);assert.equal(dialog.querySelector('.mis311-pers-task-text').textContent,config.activity);}
    }
    dialog.querySelector('[aria-label="Close persuasion details"]').click();assert.equal(dialog.open,false);assert.equal(window.document.activeElement,trigger);
  }
  assert.equal(slide.querySelectorAll('img,image,input,textarea').length,0);window.happyDOM.abort();
});
