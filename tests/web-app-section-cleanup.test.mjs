import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const pruneStyles=require('../scripts/prune-web-app-styles.cjs');

test('section CSS cleanup retains dynamic classes, pseudo selectors and cascade order',()=>{
  const source='const course={note:"unused"}; const assets={unused:"data:image/png;base64,AAAA"}; const css=`.unused{color:red}.card{color:red}.card{color:blue}.card{color:red}.icon-active{color:green}.card:not(.disabled){opacity:1}@media(prefers-reduced-motion:reduce){.card{animation:none}}`; function render(s){return <div className={"card "+"icon-"+s.mode}/>;}';
  const result=pruneStyles(source);
  assert.doesNotMatch(result,/\.unused\{/);
  assert.match(result,/\.icon-active\{color:green\}/);
  assert.match(result,/\.card:not\(\.disabled\)/);
  assert.match(result,/prefers-reduced-motion/);
  assert.ok(result.indexOf('.card{color:blue}')<result.lastIndexOf('.card{color:red}'),'last rule keeps its original precedence');
});

test('Section 1 retains the canonical embedded assets and removes unused authoring fields',()=>{
  const source=fs.readFileSync('course-content/web-app-development/Section1.js','utf8');
  assert.ok(Buffer.byteLength(source)<1_420_000,'standalone section stays below the original 1,473,791 bytes');
  assert.equal((source.match(/const assets = /g)||[]).length,1);
  assert.match(source,/data:font\/woff2;base64,/);
  assert.match(source,/"VS Code workspace": "data:image\//);
  assert.doesNotMatch(source,/"objective":|"verify":|flowSteps|publishVerticalCss|practicePopupCopy/);
  const renderer=fs.readFileSync('course-content/web-app-development/renderer.tsx.txt','utf8');
  assert.doesNotMatch(renderer,/data:image\/[^;]+;base64,/,'canonical image catalog is not duplicated in the editable renderer');
  assert.equal(fs.existsSync('course-content/web-app-development/renderer.section1.tsx.txt'),false,'Section 1 has one canonical renderer');
  assert.ok(fs.existsSync('course-content/web-app-development/renderer.section2.tsx.txt'),'Section 2 keeps its own renderer');
  assert.doesNotMatch(renderer,/flowSteps|publishVerticalCss|practicePopupCopy/,'retired Section 1 rendering paths are removed from the editable source too');
});
