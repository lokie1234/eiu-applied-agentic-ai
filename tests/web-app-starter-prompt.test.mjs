import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Window } from 'happy-dom';

const documents = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/tsxDocument.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: documents });
const source = fs.readFileSync('course-content/web-app-development/Section1.js', 'utf8');
const slides = JSON.parse(fs.readFileSync('course-content/web-app-development/storyboard.json', 'utf8')).slides;
const starter = slides.find(s => s.section === 1 && s.visual === 'git-intro-starter');

function render(page, clipboard, frames) {
  const window = new Window();
  let randomSeed = 42;
  const testMath = Object.create(Math);
  testMath.random = () => ((randomSeed = (1664525 * randomSeed + 1013904223) >>> 0) / 4294967296);
  if (frames) window.requestAnimationFrame = callback => frames.push(callback);
  window.document.body.innerHTML = '<div id="root"></div>';
  vm.runInNewContext(documents.createTsxDocument(source, page, "", "", "", true).match(/<script>([\s\S]*?)<\/script>/)[1], {
    window, document: window.document, navigator: { clipboard }, Node: window.Node, URL: window.URL,
    parent: { postMessage() {} }, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    ...(frames ? { Math: testMath } : {}),
  });
  assert.equal(window.document.querySelector('#error'), null);
  return window;
}

test('starter copies the current website description and preserves all other prompt instructions', async () => {
  const copies = [];
  const window = render(starter.number, { writeText: async text => copies.push(text) });
  try {
    const doc = window.document;
    const input = doc.querySelector('.starterContextInput');
    assert.equal(input.spellcheck, false);
    assert.equal(input.getAttribute('spellcheck'), 'false');
    const original = input.value;
    const button = doc.querySelector('.starterPromptPanel .copyControl');
    button.click();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(copies[0], starter.prompt);
    for (const value of ['Website đặt lịch khám, có form chọn ngày và bác sĩ', 'Cửa hàng "Hoa & Lá"\nCó giỏ hàng và form đặt hoa']) {
      input.value = value;
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      button.click();
      await window.happyDOM.whenAsyncComplete();
      assert.equal(copies.at(-1), starter.prompt.replace(original, value));
    }
    assert.equal(doc.querySelector('.starterHero'), null);
    const names = [...doc.querySelectorAll('.starterToolIcon img')].map(img => img.alt);
    assert.deepEqual(names.slice(0, 4), ['VS Code', 'Claude', 'Codex', 'Antigravity']);
    assert.deepEqual(names.slice(4), ['GitHub Copilot', 'Cline', 'Gemini Code Assist', 'Amazon Q', 'Continue', 'Augment', 'Kilo Code', 'Qodo', 'Bito', 'CodeGeeX', 'Tabby', 'CodeGPT']);
    doc.querySelector('.starterDownloadTrigger').click();
    const dialog = doc.querySelector('[role="dialog"]');
    assert.equal(dialog.querySelector('a[download]').getAttribute('href'), '/downloads/eiu-advertising-starter.zip');
    dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(doc.querySelector('[role="dialog"]'), null);
  } finally {
    await window.happyDOM.close();
  }
});

test('icons have no visible names, launch on hover, and fall back inside their area', async () => {
  const frames = [];
  const window = render(starter.number, {}, frames);
  try {
    await window.happyDOM.whenAsyncComplete();
    const icons = [...window.document.querySelectorAll('.starterToolIcon')];
    assert.equal(icons.length, 16);
    assert.ok(icons.every(icon => icon.textContent === ''));
    let time = 0;
    const advance = count => {
      for (let i = 0; i < count && frames.length; i++) {
        time += 16;
        const pending = frames.splice(0);
        pending.forEach(callback => callback(time));
      }
    };
    const y = icon => Number(icon.style.transform.match(/translate\([^,]+,([^p]+)px/)[1]);
    advance(600);
    const icon = icons.reduce((lowest, current) => y(current) > y(lowest) ? current : lowest);
    const restingY = y(icon);
    icon.dispatchEvent(new window.Event('pointerenter'));
    advance(3);
    const airborneY = y(icon);
    assert.ok(airborneY < restingY, 'hover throws the icon upwards');
    advance(600);
    assert.ok(y(icon) > airborneY, 'gravity brings the icon down again');
    assert.ok(icons.every(icon => y(icon) >= 0 && y(icon) <= 52));
    assert.equal(frames.length, 0, 'animation stops after the icons settle');
  } finally {
    await window.happyDOM.close();
  }
});

test('existing command copy still uses the original command text', async () => {
  const copies = [];
  const slide = slides.find(s => s.section === 1 && s.visual === 'git-intro-dev');
  const window = render(slide.number, { writeText: async text => copies.push(text) });
  try {
    window.document.querySelector('.localCommand .copyControl').click();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(copies[0], slide.cards[0].code);
  } finally {
    await window.happyDOM.close();
  }
});

test('AI editing lesson uses bullets and copies the entire edited prompt', async () => {
  const slide = slides.find(s => s.section === 1 && s.visual === 'git-intro-ai-edit');
  const copies = [];
  const window = render(slide.number, { writeText: async text => copies.push(text) });
  try {
    const doc = window.document;
    assert.equal(doc.querySelectorAll('.vibeAiStep ul').length, 3);
    assert.equal(doc.querySelectorAll('.vibeAiStep li').length, 7);
    assert.equal(doc.querySelectorAll('.vibePromptTool').length, 4);
    const editor = doc.querySelector('.vibePromptEditor');
    assert.equal(editor.readOnly, false);
    assert.equal(editor.spellcheck, false);
    assert.equal(editor.getAttribute('spellcheck'), 'false');
    assert.equal(editor.value, slide.cards[1].prompt);
    const button = doc.querySelector('.vibePromptHeader .copyControl');
    button.click();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(copies[0], slide.cards[1].prompt);
    editor.value = 'Create a booking app.\nKeep the calendar and change the entire form.';
    editor.dispatchEvent(new window.Event('input', { bubbles: true }));
    button.click();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(copies.at(-1), editor.value);
  } finally {
    await window.happyDOM.close();
  }
});

test('four transparent tool icons in the editing lesson use hover physics', async () => {
  const slide = slides.find(s => s.section === 1 && s.visual === 'git-intro-ai-edit');
  const frames = [];
  const window = render(slide.number, {}, frames);
  try {
    await window.happyDOM.whenAsyncComplete();
    const arena = window.document.querySelector('.vibePromptTools');
    const icons = [...arena.querySelectorAll('.vibePromptTool')];
    assert.equal(icons.length, 4);
    assert.equal(icons[0].querySelector('img').alt, 'Git');
    let time = 0;
    const advance = count => {
      for (let i = 0; i < count && frames.length; i++) {
        time += 16;
        frames.splice(0).forEach(callback => callback(time));
      }
    };
    advance(600);
    const icon = icons.reduce((a, b) => Number(a.style.transform.match(/,([^p]+)px/)[1]) > Number(b.style.transform.match(/,([^p]+)px/)[1]) ? a : b);
    const before = icon.style.transform;
    icon.dispatchEvent(new window.Event('pointerenter'));
    advance(3);
    assert.notEqual(icon.style.transform, before);
    advance(600);
    assert.equal(frames.length, 0);
    assert.ok(icons.every(icon => {
      const y = Number(icon.style.transform.match(/,([^p]+)px/)[1]);
      return y >= 0 && y <= 40;
    }));
  } finally {
    await window.happyDOM.close();
  }
});

test('build review keeps all instructions and copies both command blocks', async () => {
  const slide = slides.find(s => s.section === 1 && s.visual === 'git-intro-build');
  const copies = [];
  const window = render(slide.number, { writeText: async text => copies.push(text) });
  try {
    const rows = [...window.document.querySelectorAll('.buildReviewRow')];
    assert.deepEqual(rows.map(row => row.querySelector('h2').textContent), slide.cards.map(c => c.title));
    assert.deepEqual(rows.map(row => row.querySelector('p').textContent), slide.cards.map(c => c.text));
    const codes = slide.cards.filter(c => c.code).map(c => c.code);
    assert.deepEqual([...window.document.querySelectorAll('.buildReviewCommand pre')].map(p => p.textContent), codes);
    for (const button of window.document.querySelectorAll('.buildReviewCommand .copyControl')) {
      button.click();
      await window.happyDOM.whenAsyncComplete();
    }
    assert.deepEqual(copies, codes);
  } finally {
    await window.happyDOM.close();
  }
});

test('Clone editor copies the current URL and matching destination folder without spellcheck', async () => {
  const slide = slides.find(s => s.section === 1 && s.visual === 'git-intro-pull');
  const copies = [];
  const window = render(slide.number, { writeText: async text => copies.push(text) });
  try {
    const editor = window.document.querySelector('.cloneEditor');
    const [repo, folder] = editor.querySelectorAll('input');
    const input = (field, value) => { field.value = value; field.dispatchEvent(new window.Event('input', { bubbles: true })); };
    assert.equal(editor.querySelector('.editableGitStatus').textContent, '');
    assert.equal(editor.querySelector('button').disabled, true);
    assert.ok([repo, folder].every(field => field.spellcheck === false && field.getAttribute('spellcheck') === 'false'));
    input(repo, 'https://github.com/team/website.git');
    input(folder, "Client's website");
    const expected = "git clone -- 'https://github.com/team/website.git' 'Client''s website'\ncd 'Client''s website'\ngit remote -v\nnpm install\nnpm run dev";
    assert.equal(editor.querySelector('pre').textContent, expected);
    editor.querySelector('button').click();
    input(repo, '');
    await window.happyDOM.whenAsyncComplete();
    assert.equal(copies[0], expected);
    assert.equal(editor.querySelector('button').disabled, true, 'old copy cannot enable an incomplete form');
    input(repo, 'https://github.com/team/website.git');
    for (const invalid of ['../other', 'folder/name', 'CON', 'name*', 'name\x01next']) {
      input(folder, invalid);
      assert.equal(editor.querySelector('button').disabled, true, invalid);
    }
    input(folder, 'my-new-app');
    for (const invalid of ['http://github.com/team/repo', 'https://example.com/team/repo', 'https://token@github.com/team/repo', 'https://github.com/team/repo?token=secret']) {
      input(repo, invalid);
      assert.equal(editor.querySelector('button').disabled, true, invalid);
    }
    input(repo, 'https://github.com/another/project');
    editor.querySelector('button').click();
    await window.happyDOM.whenAsyncComplete();
    assert.equal(copies.at(-1), "git clone -- 'https://github.com/another/project' 'my-new-app'\ncd 'my-new-app'\ngit remote -v\nnpm install\nnpm run dev");
  } finally {
    await window.happyDOM.close();
  }
});

test('agent flow and submission finish the 30-slide admin section after Pull/Clone', async () => {
  const section = slides.filter(s => s.section === 1);
  assert.equal(section.length, 30);
  assert.equal(section[26].visual, 'git-intro-pull');
  assert.equal(section[27].visual, 'git-intro-agent-full-flow');
  assert.equal(section[28].visual, 'git-intro-localhost-share');
  assert.equal(section[29].visual, 'git-intro-submission');
  assert.deepEqual(section.map(s=>s.number), Array.from({length:30},(_,i)=>i+1));
  const window = render(28, {});
  try {
    const doc=window.document;
    assert.equal(doc.querySelectorAll('.agentFlowEndpoint').length, 2);
    assert.equal(doc.querySelectorAll('.agentFlowTask').length, 3);
    const tasks = [...doc.querySelectorAll('.agentFlowTask')];
    assert.deepEqual(tasks.map(task => task.querySelector('h3').textContent.trim()), section[27].cards.slice(1, 4).map(card => card.title));
    assert.equal(doc.querySelectorAll('.agentFlowTask p').length, 0);
    assert.equal(doc.querySelectorAll('.agentFlowArrow').length, 2);
    assert.equal(doc.querySelector('.agentFlowProduct').textContent.includes('GitHub'), true);
  } finally { await window.happyDOM.close(); }
});

test('permission overview follows AI setup and explains each tool without changing settings', async () => {
  const slide = slides.find(s => s.section === 1 && s.visual === 'git-intro-agent-permissions');
  assert.equal(slide.number, 15);
  assert.deepEqual(slide.cards.map(card => card.title), ['Codex', 'Antigravity', 'Claude Code']);
  assert.deepEqual(slide.cards.map(card => card.modes.map(mode => mode.title)), [
    ['Ask for approval', 'Approve for me · Auto-review', 'Full access', 'Custom (config.toml)'],
    ['Default', 'Request Review', 'Turbo / Turbo mode', 'Always Proceed · Windows'],
    ['Manual', 'Edit automatically', 'Plan', 'Auto', 'Bypass permissions'],
  ]);
  const window = render(slide.number, {});
  try {
    const doc = window.document;
    assert.equal(doc.querySelectorAll('.agentPermissionCard').length, 3);
    assert.equal(doc.querySelectorAll('.agentModeRow').length, 13);
    assert.equal(doc.querySelectorAll('.agentModeRow[data-wide="true"]').length, 3);
    assert.equal(doc.querySelectorAll('.agentPermissions a').length, 0);
    assert.equal(doc.querySelector('.agentPermissionAvailability'), null);
    assert.equal(doc.querySelectorAll('.agentPermissionIcon > .gitMark').length, 3);
    assert.equal(doc.querySelector('.agentPermissionBrand p, .agentPermissionLocation'), null);
    assert.ok(slide.cards.every(card => card.modes.every(mode => mode.text.length > 20)));
    assert.equal(doc.querySelector('.agentPermissions input, .agentPermissions select'), null);
    const triggers = [...doc.querySelectorAll('.agentPermissionIcon')];
    for (const [index, trigger] of triggers.entries()) {
      trigger.click();
      const dialog = doc.querySelector('[role="dialog"]');
      assert.equal(dialog.getAttribute('aria-modal'), 'true');
      assert.match(dialog.querySelector('h2').textContent, new RegExp(slide.cards[index].title));
      assert.deepEqual([...dialog.querySelectorAll('li')].map(li => li.textContent), slide.cards[index].points);
      const close = dialog.querySelector('button');
      assert.equal(doc.activeElement, close);
      close.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      assert.equal(doc.activeElement, close);
      if (index === 0) close.click();
      if (index === 1) dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (index === 2) doc.querySelector('.agentPermissionOverlay').click();
      assert.equal(doc.querySelector('[role="dialog"]'), null);
      assert.equal(doc.activeElement, trigger);
    }
  } finally {
    await window.happyDOM.close();
  }
});
