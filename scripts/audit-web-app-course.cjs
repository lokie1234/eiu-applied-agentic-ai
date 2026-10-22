// Inspect the generated section in the same DOM sandbox used by lesson tests.
// CSS/source sizes are repeatable; DOM timings are diagnostic, not browser FPS.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Window } = require('happy-dom');

async function main() {
  const root = 'course-content/web-app-development/';
  const source = fs.readFileSync(root + 'Section1.js', 'utf8');
  const slides = JSON.parse(fs.readFileSync(root + 'storyboard.json', 'utf8')).slides.filter(s => s.section === 1);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, jsxFactory: 'h', jsxFragmentFactory: 'Fragment' } }).outputText;
  const documents = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/tsxDocument.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: documents });
  const pages = [];
  for (const slide of slides) {
    const window = new Window(), document = window.document;
    try {
      document.body.innerHTML = '<div id="root"></div>';
      const script = documents.createTsxDocument(compiled, slide.number, "", "", "", true).match(/<script>([\s\S]*?)<\/script>/)[1];
      const started = performance.now();
      vm.runInNewContext(script, { window, document, Node: window.Node, URL: window.URL, parent: { postMessage() {} }, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) }, { timeout: 5000 });
      if (document.querySelector('#error')) throw Error(document.querySelector('#error').textContent);
      for (const img of document.querySelectorAll('img')) if (!img.src.startsWith('data:image/')) throw Error('Non-embedded image on slide ' + slide.number);
      pages.push({ slide: slide.number, cssBytes: [...document.querySelectorAll('style')].reduce((sum, node) => sum + Buffer.byteLength(node.textContent), 0), elements: document.querySelectorAll('*').length, sandboxMs: Math.round(performance.now() - started) });
    } finally { await window.happyDOM.close(); }
  }
  const result = { sourceBytes: Buffer.byteLength(source), compiledBytes: Buffer.byteLength(compiled), slides: pages.length, meanCssBytes: Math.round(pages.reduce((n, p) => n + p.cssBytes, 0) / pages.length), pages };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
