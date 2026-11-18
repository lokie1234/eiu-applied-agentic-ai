import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';

function fixture(page){
  const window=new Window();window.eiuLessonTeaching=true;window.happyDOM.setWindowSize({width:1280,height:720});
  const lesson={exports:{}};vm.runInNewContext(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),{module:lesson,document:window.document});
  const slide=lesson.exports.slides[page-1]();window.document.body.append(slide);return {window,slide};
}

test('tool views reuse their diagrams and preserve chart selection across close/reopen',()=>{
  const {window,slide}=fixture(2);
  try{
    slide.querySelector('[data-rca-open=tools]').click();
    const tool=slide.querySelector('[data-tool-key=pareto]');tool.click();
    const original=slide.querySelector('.mis311-tools-figure');slide.querySelector('[aria-label="Close tool"]').click();tool.click();
    assert.equal(slide.querySelector('.mis311-tools-figure'),original);
    slide.querySelector('[aria-label="Close tool"]').click();slide.querySelector('[data-tool-key=charts]').click();
    const buttons=[...slide.querySelectorAll('[data-chart-key]')];assert.ok(buttons.length>1);
    buttons[1].click();const chart=slide.querySelector('.mis311-rca-chart-svg');buttons[0].click();buttons[1].click();assert.equal(slide.querySelector('.mis311-rca-chart-svg'),chart);
    slide.querySelector('[aria-label="Close tool"]').click();slide.querySelector('[data-tool-key=charts]').click();assert.equal(slide.querySelector('.mis311-rca-chart-svg'),chart);
  }finally{window.happyDOM.abort();}
});

test('VSM reuses symbol crops and example artwork while retaining each selected page',()=>{
  const {window,slide}=fixture(4);
  try{
    slide.querySelector('[data-rca-open=parts]').click();
    const pages=[...slide.querySelectorAll('[data-symbol-page-button]')],first=slide.querySelector('.mis311-vsp-symbol');pages[1].click();const second=slide.querySelector('.mis311-vsp-symbol');pages[0].click();assert.equal(slide.querySelector('.mis311-vsp-symbol'),first);pages[1].click();
    slide.querySelector('[data-vsm-details=example]').click();slide.querySelector('[data-example-view-button="2"]').click();const image=slide.querySelector('.mis311-vsp-example svg');
    slide.querySelector('[data-vsm-details=symbols]').click();assert.equal(slide.querySelector('.mis311-vsp-symbol'),second);assert.equal(slide.querySelector('.mis311-vsp-symbols').dataset.symbolPage,'2');
    slide.querySelector('[data-vsm-details=example]').click();assert.equal(slide.querySelector('.mis311-vsp-example svg'),image);assert.equal(slide.querySelector('.mis311-vsp-example').dataset.exampleView,'2');
  }finally{window.happyDOM.abort();}
});

test('TKI and persuasion keep bounded page nodes and selections instead of rebuilding them',()=>{
  for(const page of [6,10]){
    const {window,slide}=fixture(page);
    try{
      slide.querySelector(page===6?'[data-rca-open=how]':'[data-persuasion-open=case]').click();
      const selector=page===6?'[data-tki-page-button]':'[data-persuasion-page-button]',view=slide.querySelector(page===6?'.mis311-tki-detail-view':'.mis311-pers-view');
      const tabs=[...slide.querySelectorAll(selector)],first=view.firstElementChild;tabs[1].click();tabs[0].click();assert.equal(view.firstElementChild,first);
      tabs[2].click();const third=view.firstElementChild;
      if(page===10){slide.querySelector('[aria-label="Close persuasion details"]').click();slide.querySelector('[data-persuasion-open=case]').click();assert.equal(view.dataset.persuasionPage,'3');assert.equal(view.firstElementChild,third);}
      let created=0;const original=window.document.createElement;window.document.createElement=function(...args){created++;return original.apply(this,args);};
      for(let i=0;i<30;i++)tabs[i%3].click();assert.equal(created,0,'warmed static pages allocate no new HTML nodes');window.document.createElement=original;
    }finally{window.happyDOM.abort();}
  }
});

test('the complete Section 2 has no unused embedded assets or broken SVG/ARIA references after every resource opens', () => {
  const window=new Window();window.eiuLessonTeaching=true;window.happyDOM.setWindowSize({width:1280,height:720});
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
          const suggested=scope.querySelector('[data-persuasion-answers]');if(suggested){suggested.click();inspect(slide);scope.querySelector('[aria-label="Return to case study"]').click();}
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
