import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';

test('the complete Section 2 has no unused embedded assets or broken SVG/ARIA references after every resource opens', () => {
  const window=new Window();window.happyDOM.setWindowSize({width:1280,height:720});
  const code=fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),lesson={exports:{}};
  const context=vm.createContext({module:lesson,document:window.document});vm.runInContext(code,context);
  const assets=vm.runInContext('assets',context),pages=vm.runInContext('pages',context),used=new Set();
  for(const [name,url] of Object.entries(assets)){const mime=name.endsWith('.jpg')?'jpeg':'png';assert.equal(url,`data:image/${mime};base64,${fs.readFileSync(`course-content/mis311/assets/${name}`).toString('base64')}`,'live images keep their exact original bytes');}
  assert.equal(lesson.exports.slides.length,10);assert.ok(Buffer.byteLength(code)<600_000,'keep the standalone lesson below its audited budget');
  assert.deepEqual(Array.from(pages[1].rootCauseHub.tools.pages,page=>page.sourceSlide),[35],'only the live Pareto original is shipped');
  assert.ok(!/\b(?:fetch|XMLHttpRequest|setInterval|setTimeout)\s*\(/.test(code),'presentation interactions do not add network calls or polling');
  function inspect(slide){
    const ids=[...slide.querySelectorAll('[id]')].map(node=>node.id);assert.equal(new Set(ids).size,ids.length,'SVG masks, dialogs and labels have unique IDs');
    for(const node of slide.querySelectorAll('img,image'))used.add(node.getAttribute('src')||node.getAttribute('href')||node.getAttribute('xlink:href'));
    assert.ok(!slide.innerHTML.includes('asset:'),'all source image references resolve');
    for(const node of slide.querySelectorAll('*')){
      for(const attr of node.attributes){
        if(['aria-controls','aria-labelledby','aria-describedby'].includes(attr.name))for(const id of attr.value.split(/\s+/))assert.ok(window.document.getElementById(id),`missing ARIA target ${id}`);
        for(const match of attr.value.matchAll(/url\(#([^)]*)\)/g))assert.ok(window.document.getElementById(match[1]),`missing SVG target ${match[1]}`);
      }
    }
  }
  function close(slide){for(const dialog of slide.querySelectorAll('dialog[open]'))dialog.close();}
  try{
    for(const render of lesson.exports.slides){
      const slide=render();window.document.body.replaceChildren(slide);inspect(slide);
      const scopes=[];
      for(const hubButton of slide.querySelectorAll('[data-rca-open]')){hubButton.click();scopes.push(slide.querySelector(`[data-rca-hub-pane=${hubButton.dataset.rcaOpen}]`));inspect(slide);}
      if(!scopes.length)scopes.push(slide);
      for(const scope of scopes){
        for(const trigger of scope.querySelectorAll('[data-tool-key],[data-example-kind],[data-tki-open],[data-persuasion-open],.mis311-vsm-help')){
          trigger.click();inspect(slide);
          for(const selector of ['[data-fishbone-source]','[data-chart-key]','[data-tki-page-button]','[data-persuasion-page-button]'])for(const tab of scope.querySelectorAll(selector)){tab.click();inspect(slide);}
          close(scope);
        }
        for(const trigger of scope.querySelectorAll('[data-vsm-details]')){trigger.click();inspect(slide);for(const selector of ['[data-symbol-page-button]','[data-example-view-button]'])for(const tab of scope.querySelectorAll(selector)){tab.click();inspect(slide);}}
      }
      close(slide);
    }
    assert.deepEqual(Object.keys(assets).filter(name=>!used.has(assets[name])),[],'every embedded image is reachable in a live slide or resource');
    assert.equal(Object.keys(assets).length,5);
  }finally{window.happyDOM.abort();}
});
