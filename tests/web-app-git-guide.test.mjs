import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Window } from "happy-dom";

const source = fs.readFileSync("course-content/web-app-development/Section1.tsx", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, jsxFactory: "h", jsxFragmentFactory: "Fragment",
} }).outputText;
const documentExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/tsxDocument.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: documentExports });

function render(page) {
  const window = new Window();
  window.document.body.innerHTML = '<div id="root"></div>';
  const html = documentExports.createTsxDocument(compiled, page);
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document: window.document, Node: window.Node, window, parent: { postMessage() {} },
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
  }, { timeout: 3000 });
  assert.equal(window.document.querySelector("#error"), null, `Slide ${page} must render`);
  return window;
}

test("Git guide opens every step, retains its buttons and uses embedded icons", async () => {
  for (let page = 14; page < 40; page++) {
    const window = render(page), document = window.document;
    try {
      assert.ok(document.querySelector(".gitIntroSlide"));
      const buttons = [...document.querySelectorAll(".gitChoice")];
      assert.ok(buttons.length >= 2 && buttons.length <= 4);
      if (page === 25) {
        const download = document.querySelector(".gitGuideLink");
        assert.equal(download.getAttribute("href"), "/downloads/eiu-advertising-starter.zip");
        assert.equal(download.getAttribute("download"), "eiu-advertising-starter.zip");
      }
      for (const [index, button] of buttons.entries()) {
        button.click();
        assert.equal(button.getAttribute("aria-pressed"), "true");
        assert.equal(document.querySelectorAll('.gitChoice[aria-pressed="true"]').length, 1);
        assert.equal(document.querySelectorAll(".gitChoice")[index], button);
        assert.ok(document.querySelector(".gitStepDetail h2").textContent);
      }
      assert.ok([...document.querySelectorAll(".gitMark img")].every(image => image.src.startsWith("data:")));
    } finally { await window.happyDOM.close(); }
  }
});

test("signup uses Google and Git authentication needs no GitHub extension", async () => {
  const signup = render(19), signin = render(21), web = render(23), publish = render(35);
  try {
    assert.equal(signup.document.querySelector(".gitGuideLink").href, "https://github.com/signup");
    assert.equal(signup.document.querySelector(".gitGuideLink").target, "_blank");
    assert.match(signup.document.querySelector(".gitStepDetail").textContent, /Continue with Google/);
    assert.match(signin.document.querySelector(".gitGuideLink").href, /caching-your-github-credentials-in-git/);
    assert.match(signin.document.querySelector(".gitStepDetail").textContent, /không cài extension GitHub/);
    assert.equal(web.document.querySelector(".gitGuideLink").href, "https://github.com/new");
    assert.match(publish.document.querySelector(".gitStepDetail").textContent, /Không bật README/);
    publish.document.querySelectorAll(".gitChoice")[2].click();
    assert.match(publish.document.querySelector(".gitSceneCode").textContent, /git push -u origin main/);
    assert.match(source, /git --version/);
    assert.match(source, /Git from the command line and also from 3rd-party software/);
    assert.match(source, /prefers-reduced-motion/);
  } finally { for (const window of [signup, signin, web, publish]) await window.happyDOM.close(); }
});

test("Git lessons use centered feature layout, concise headings and self-contained instructions", async () => {
  const slides = JSON.parse(fs.readFileSync('course-content/web-app-development/storyboard.json', 'utf8')).slides;
  for (let page = 14; page <= 39; page++) {
    const data = slides.find(s => s.section === 1 && s.number === page);
    assert.doesNotMatch(JSON.stringify(data.cards), /\bslides?\b/i);
    const window = render(page);
    try {
      const focusedTools = {14: ['Git'], 15: ['GitHub'], 16: ['Git', 'VS Code'], 17: ['Git', 'VS Code'], 18: ['Git', 'VS Code'], 19: ['GitHub']};
      assert.deepEqual([...window.document.querySelectorAll('.gitToolTag strong')].map(el => el.textContent), focusedTools[page] || ['Git', 'VS Code', 'GitHub']);
      for (const button of window.document.querySelectorAll('.gitChoice')) {
        button.click();
        assert.ok(window.document.querySelector('.gitFacts'));
        assert.ok(window.document.querySelectorAll('.gitFact').length >= 1);
        assert.ok(window.document.querySelector('.gitStepDetail h2').textContent.length <= 30);
        assert.equal(window.document.querySelectorAll('.gitToolTag[data-active="true"]').length, 1);
      }
    } finally { await window.happyDOM.close(); }
  }
});

test("terminal guide includes installation checks and complete Git command workflows", async () => {
  const expected = new Map([
    [18, ['git --version', 'where.exe git', 'git credential-manager --version']],
    [20, ['git config --global user.name', 'git config --global init.defaultBranch', 'git config --global --get user.email']],
    [24, ['git clone https://github.com/USERNAME/webapp-web.git', 'cd webapp-web', 'git remote -v']],
    [34, ['git init -b main', 'git add .', 'git commit -m']],
    [35, ['git remote add origin', 'git push -u origin main']],
    [37, ['git diff', 'git diff --cached --stat', 'git push -u origin feature/landing-refresh']],
    [38, ['git status', 'git pull --ff-only origin main', 'git log -3 --oneline']],
  ]);
  for (const [page, commands] of expected) {
    const window = render(page);
    try {
      let content = '';
      for (const button of window.document.querySelectorAll('.gitChoice')) {
        button.click();
        content += window.document.querySelector('.gitDetail').textContent + '\n';
      }
      for (const command of commands) assert.ok(content.includes(command), `Slide ${page}: ${command}`);
      assert.doesNotMatch(content, /Publish to GitHub|Initialize Repository|GitHub\.vscode-pull-request-github/);
    } finally { await window.happyDOM.close(); }
  }
});

test("final self-check provides feedback and remains registered for live display", async () => {
  const window = render(40);
  try {
    const buttons = [...window.document.querySelectorAll(".choices button")];
    assert.equal(buttons.length, 2);
    buttons[0].click();
    assert.match(window.document.querySelector(".feedback").textContent, /Commit|đúng|Đúng/);
    const bindings = JSON.parse(fs.readFileSync("course-content/sources.json", "utf8"));
    assert.ok(bindings.some(binding => binding.courseId === "a857595d-def0-4543-9216-a680c6abfe26" && binding.sectionId === "47c1183e-a26e-4c5d-9937-88ec5a755a32" && binding.path === "course-content/web-app-development/Section1.tsx"));
  } finally { await window.happyDOM.close(); }
});

test("narrative uses the ZIP project once and finishes with the complete self-check", () => {
  const slides = JSON.parse(fs.readFileSync("course-content/web-app-development/storyboard.json", "utf8")).slides.filter(s => s.section === 1);
  assert.equal(slides.length, 40);
  const modes = slides.slice(13).map(s => s.visual);
  for (const mode of ["starter", "initialize", "publish", "push-code", "quiz"]) {
    assert.equal(modes.filter(value => value === `git-intro-${mode}`).length, 1, mode);
  }
  assert.ok(modes.indexOf("git-intro-signin") < modes.indexOf("git-intro-web-create"));
  assert.ok(modes.indexOf("git-intro-build") < modes.indexOf("git-intro-initialize"));
  assert.ok(modes.indexOf("git-intro-branch-choice") < modes.indexOf("git-intro-push-code"));
  assert.equal(slides.at(-1).visual, "git-intro-quiz");
  assert.ok(!slides.some(s => s.title === "Thực hành · hoàn thành cả hai cách"));
});
