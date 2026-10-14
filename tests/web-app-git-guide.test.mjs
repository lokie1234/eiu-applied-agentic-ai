import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Window } from 'happy-dom';

const source = fs.readFileSync('course-content/web-app-development/Section1.tsx','utf8');
const slides = JSON.parse(fs.readFileSync('course-content/web-app-development/storyboard.json','utf8')).slides.filter(s=>s.section===1);
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'h',jsxFragmentFactory:'Fragment'}}).outputText;
const documents = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/tsxDocument.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:documents});
function render(page){
 const window = new Window();
 window.document.body.innerHTML='<div id="root"></div>';
 const script=documents.createTsxDocument(compiled,page).match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(script,{document:window.document,Node:window.Node,window,parent:{postMessage(){}},setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window)},{timeout:3000});
 const error=window.document.querySelector('#error');
 assert.ok(!error,`Slide ${page} renders: ${error?.textContent||''}`);
 return window;
}

test('section opening orbits four upright icons and shows four concise bullets',async()=>{
 const window=render(1),doc=window.document;
 try{
  const nodes=[...doc.querySelectorAll('.openingnode')];
  assert.deepEqual(nodes.map(node=>node.querySelector('strong').textContent),['VS Code','Node.js','Git','GitHub']);
  assert.ok(nodes[1].querySelector('svg'));
  const orbits=[...doc.querySelectorAll('.openingOrbit')];
  assert.equal(orbits.length,4);
  assert.deepEqual(orbits.map(orbit=>orbit.style.animationDelay),['0s','-6.25s','-12.5s','-18.75s']);
  orbits.forEach((orbit,i)=>assert.ok(orbit.classList.contains('orbit-'+i)));
  assert.equal(doc.querySelector('.openinglinks circle').getAttribute('r'),'170');
  assert.equal(doc.querySelector('.openinglinks path'),null);
  assert.match(doc.querySelector('.openingSubtitle').textContent,/Node.js/);
  assert.match(doc.querySelector('.openingcopy p').textContent,/Node.js chạy và kiểm tra/);
  assert.deepEqual([...doc.querySelectorAll('.openingroles>span')].map(item=>item.textContent),['Chỉnh sửa cùng AI','Chạy app với Node.js','Kiểm tra kết quả','Quản lý phiên bản']);
  assert.equal(doc.querySelector('.openingNodeSummary'),null);
  assert.equal(doc.querySelector('.openingroles code'),null);
 }finally{await window.happyDOM.close();}
});

test('renumbered flow keeps six steps and places Node.js beside VS Code for checking',async()=>{
 const window=render(3),doc=window.document;
 try{
  assert.ok(doc.querySelector('.processSlide'));
  assert.equal(doc.querySelector('.roleSlide'),null);
  const steps=[...doc.querySelectorAll('.fixedStep')];
  assert.equal(steps.length,6);
  assert.equal(doc.querySelectorAll('.processArrow').length,5);
  const check=steps[1];
  assert.equal(check.querySelector('h3').textContent,'Kiểm tra');
  assert.ok(check.querySelector('[aria-label="Node.js"]'));
  assert.ok(check.querySelector('img[alt="VS Code"]'));
  assert.match(check.querySelector('p').textContent,/Chạy app với Node.js/);
  assert.ok(!slides.some(s=>s.visual==='roles'||s.visual==='features'));
  assert.equal(slides[3].visual,'workspace-map');
 }finally{await window.happyDOM.close();}
});

test('workspace map opens six matching region popups with compact text headers and navy emphasis',async()=>{
 const window=render(4),doc=window.document;
 try{
  const names=[...doc.querySelectorAll('.vscodeName')];
  const targets=[...doc.querySelectorAll('.vscodeHotspot')];
  const details=slides.find(s=>s.visual==='workspace-map').regionDetails;
  assert.equal(names.length,6);assert.equal(targets.length,6);assert.equal(details.length,6);
  for(let i=0;i<6;i++){
   names[i].click();
   const dialog=doc.querySelector('.workspacePopup[role=dialog]');
   assert.ok(dialog);assert.equal(dialog.getAttribute('aria-modal'),'true');
   assert.equal(dialog.querySelector('h2').textContent,details[i].title);
   assert.equal(dialog.querySelector('header img'),null);
   assert.equal(dialog.querySelector('.workspaceSmallMagnifier'),null);
   assert.equal(dialog.querySelector('.workspacePopupNumber').textContent,String(i+1).padStart(2,'0'));
   assert.equal(dialog.querySelector('[tabindex="0"]'),null);
   const cards=[...dialog.querySelectorAll('.regionCard')];
   assert.equal(cards.length,details[i].cards.length);
   cards.forEach((card,j)=>{
    assert.equal(card.querySelector('h3').textContent,details[i].cards[j].title);
    const points=[...card.querySelectorAll('.regionBullets li')].map(li=>li.textContent);
    assert.deepEqual(points,details[i].cards[j].points);
    assert.ok(points.length>=2&&points.length<=3);
    assert.equal(card.querySelector('p'),null);
    if(card.classList.contains('regionEmphasis'))assert.match(window.getComputedStyle(card).backgroundImage,/linear-gradient/,'Emphasized cards keep navy background, including dense Menu');
   });
   assert.equal(dialog.querySelectorAll('.regionEmphasis').length,[2,2,3,2,2,6][i]);
   const close=dialog.querySelector('.workspacePopupClose');
   assert.equal(doc.activeElement,close);
   close.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
   assert.equal(doc.activeElement,close);
   close.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert.equal(doc.querySelector('.workspacePopup'),null);assert.equal(doc.activeElement,names[i]);
   targets[i].click();
   assert.equal(doc.querySelector('.workspacePopup h2').textContent,details[i].title);
   doc.querySelector('.workspacePopupOverlay').click();
   assert.equal(doc.querySelector('.workspacePopup'),null);assert.equal(doc.activeElement,targets[i]);
  }
 }finally{await window.happyDOM.close();}
});

test('all revised steps retain navigation, update details and use embedded logos',async()=>{
 for(const slide of slides.slice(7,-1)){
  const window=render(slide.number), doc=window.document;
  try{
   assert.ok(doc.querySelector('.gitIntroSlide'));
   const buttons=[...doc.querySelectorAll('.gitChoice')];
   assert.equal(buttons.length,slide.cards.length);
   for(const [i,button] of buttons.entries()){
    button.click();
    assert.equal(doc.querySelectorAll('.gitChoice')[i],button);
    assert.equal(doc.querySelectorAll('.gitChoice[aria-pressed=true]').length,1);
    assert.equal(doc.querySelector('.gitStepDetail h2').textContent,slide.cards[i].title);
    assert.equal(doc.querySelectorAll('.gitToolTag[data-active=true]').length,1);
    assert.ok([...doc.querySelectorAll('.gitMark img')].every(img=>img.src.startsWith('data:')));
   }
  }finally{await window.happyDOM.close();}
 }
});

test('Node.js/Git/GitHub overview explains their relationship and preserves all three popups',async()=>{
 const window=render(6),doc=window.document;
 try{
  const choices=[...doc.querySelectorAll('.gitOverviewChoice')];
  assert.equal(choices.length,3);
  assert.deepEqual(choices.map(choice=>choice.querySelector('h2').textContent),['Node.js','Git','GitHub']);
  assert.ok(doc.querySelector('.gitTrioFlow').textContent.includes('Pull / Clone'));
  assert.ok(doc.querySelector('.gitTrioFlow').textContent.includes('npm install'));
  assert.equal(doc.querySelectorAll('.gitTrioRoute .gitMark').length,3);
  assert.match(doc.querySelector('.gitTrioReturn').textContent,/Chiều về: GitHub → Pull \/ Clone bằng Git/);
  assert.equal(doc.querySelector('[role=dialog]'),null);
  choices[0].click();
  let dialog=doc.querySelector('[role=dialog]');
  assert.match(dialog.querySelector('h2').textContent,/Node.js/);
  assert.equal(dialog.querySelectorAll('.gitPopupCard').length,3);
  for(const phrase of ['JavaScript','package.json','node --version','npm --version','npm install','npm run dev','npm test','npm run build'])assert.ok(dialog.textContent.includes(phrase),phrase);
  assert.equal(dialog.querySelector('a').href,'https://nodejs.org/learn/getting-started/introduction-to-nodejs');
  dialog.querySelector('.gitPopupClose').click();
  assert.equal(doc.activeElement,choices[0]);
  choices[1].click();
  dialog=doc.querySelector('[role=dialog]');
  assert.equal(dialog.getAttribute('aria-modal'),'true');
  assert.equal(dialog.querySelectorAll('.gitPopupCard').length,3);
  for(const command of ['git --version','git status','git diff','git log -3 --oneline'])assert.ok(dialog.textContent.includes(command));
  assert.ok(dialog.textContent.includes('Ctrl+Shift+G'));
  const close=dialog.querySelector('button');
  assert.equal(doc.activeElement,close);
  close.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(doc.activeElement,close);
  close.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(doc.querySelector('[role=dialog]'),null);
  assert.equal(doc.activeElement,choices[1]);
  choices[2].click();
  dialog=doc.querySelector('[role=dialog]');
  assert.equal(dialog.querySelectorAll('.gitPopupCard').length,3);
  for(const phrase of ['Issues','Pull Request','Actions','LICENSE','.gitignore'])assert.ok(dialog.textContent.includes(phrase));
  const link=dialog.querySelector('a');
  assert.equal(link.href,'https://github.com/explore');
  link.focus();
  link.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(doc.activeElement,dialog.querySelector('button'));
  dialog.querySelector('button').click();
  assert.equal(doc.activeElement,choices[2]);
  choices[0].click();
  doc.querySelector('.gitPopupOverlay').click();
  assert.equal(doc.querySelector('[role=dialog]'),null);
 }finally{await window.happyDOM.close();}
});

test('setup popup covers all four tools, links, commands and configuration steps',async()=>{
 const window=render(7),doc=window.document;
 const data=slides.find(s=>s.number===7);
 try{
  const choices=[...doc.querySelectorAll('.gitOverviewChoice')];
  assert.equal(choices.length,4);
  for(const [index,name] of ['VS Code','Node.js','Git','GitHub'].entries()){
   choices[index].click();
   const dialog=doc.querySelector('[role=dialog]');
   assert.ok(dialog.textContent.includes(name));
   const steps=[...dialog.querySelectorAll('.gitSetupStep')];
   const cards=data.cards.filter(c=>c.label===name);
   assert.equal(steps.length,cards.length);
   for(const [i,step] of steps.entries()){
    step.click();
    assert.equal(dialog.querySelectorAll('.gitSetupStep[aria-pressed=true]').length,1);
    const detail=dialog.querySelector('.gitSetupDetail');
    assert.equal(detail.querySelector('h3').textContent,cards[i].title);
    assert.ok(detail.textContent.includes(cards[i].text));
    if(cards[i].code||cards[i].installationOption)assert.equal(detail.querySelector('pre').textContent,cards[i].code||cards[i].installationOption);
    if(cards[i].link){assert.equal(detail.querySelector('a').href,cards[i].link);assert.equal(detail.querySelector('a').target,'_blank');}
   }
   dialog.querySelector('.gitPopupClose').click();
   assert.equal(doc.querySelector('[role=dialog]'),null);
   assert.equal(doc.activeElement,choices[index]);
  }
  for(const command of ['code --version','where.exe code','code .','node --version','npm --version','git --version','where.exe git','git credential-manager --version','git config --global user.name','git config --global user.email','git ls-remote']) assert.ok(data.cards.some(c=>c.code?.includes(command)),command);
  assert.ok(data.cards.some(c=>c.label==='GitHub'&&c.detail.includes('không chứng minh đã đăng nhập')));
 }finally{await window.happyDOM.close();}
});

test('download uses existing ZIP and the copyable prompt preserves app behavior',async()=>{
 const download=render(11), edit=render(14);
 try{
  const link=download.document.querySelector('.gitGuideLink');
  assert.equal(link.getAttribute('href'),'/downloads/eiu-advertising-starter.zip');
  assert.equal(link.getAttribute('download'),'eiu-advertising-starter.zip');
  assert.ok(fs.existsSync('public'+link.getAttribute('href')));
  edit.document.querySelectorAll('.gitChoice')[1].click();
  const prompt=edit.document.querySelector('textarea');
  assert.ok(prompt.readOnly);
  for(const phrase of ['Bối cảnh:','Mục tiêu:','Phạm vi:','Thiết kế:','Kiểm tra:','Đầu ra:','data/site.js','components/MarketingSite.js','npm test','npm run build','responsive','Không thêm dịch vụ']) assert.ok(prompt.value.includes(phrase),phrase);
  edit.document.execCommand=()=>false;
  edit.document.querySelector('.promptpanel button').click();
  assert.match(edit.document.querySelector('.promptpanel').textContent,/Ctrl\+C/);
 }finally{await download.happyDOM.close();await edit.happyDOM.close();}
});

test('the two AI tools expose tradeoffs with separate scoped themes',async()=>{
 for(const [page,theme] of [[8,'antigravity'],[9,'codex']]){
  const window=render(page);
  try{
   assert.equal(window.document.querySelector('.gitLesson').getAttribute('data-ai'),theme);
   assert.equal(window.document.querySelector('.gitStepDetail h2').textContent,'Ưu điểm');
   window.document.querySelectorAll('.gitChoice')[1].click();
   assert.equal(window.document.querySelector('.gitStepDetail h2').textContent,'Điểm cần cân nhắc');
  }finally{await window.happyDOM.close();}
 }
 const note=slides.find(s=>s.number===15).cards.map(c=>c.text+' '+c.detail).join(' ');
 assert.match(note,/một số model/);
 assert.match(note,/công cụ.*quyền/);
 assert.match(note,/không phải tất cả model/);
});

test('setup and practice lead to complete Push, Pull and Clone workflows',()=>{
 const commands=new Map([
  [6,['git --version','git status','git diff']],
  [7,['where.exe git','git credential-manager --version']],
  [7,['git config --global user.name','git config --global user.email']],
  [12,['npm install','npm run dev']],
  [16,['npm test','npm run build','npm run start']],
  [17,['git init -b main','git add .','git diff --cached','git commit -m']],
  [18,['git remote add origin','git remote -v','git push -u origin main']],
  [19,['git branch --show-current','git diff','git commit -m','git push']],
  [20,['git status','git pull --ff-only origin main','git log','git clone https://github.com/USERNAME/eiu-advertising-starter.git']]
 ]);
 for(const [page,values] of commands){
  const data=JSON.stringify(slides.find(s=>s.number===page));
  for(const value of values) assert.ok(data.includes(value),`Slide ${page}: ${value}`);
 }
 assert.equal(slides.length,21);
 assert.equal(slides[10].visual,'git-intro-starter');
 assert.equal(slides[15].visual,'git-intro-build');
 assert.equal(slides[16].visual,'git-intro-initialize');
 assert.equal(slides.at(-1).visual,'git-intro-quiz');
 assert.ok(!slides.slice(5).some(s=>JSON.stringify(s).includes('webapp-web')));
 assert.match(JSON.stringify(slides[17]),/Không bật README/);
 assert.match(JSON.stringify(slides[6]),/không cài extension GitHub/);
});

test('quiz gives feedback and the source remains registered for live display',async()=>{
 const window=render(21);
 try{
  window.document.querySelector('.choices button').click();
  assert.match(window.document.querySelector('.feedback').textContent,/Phù hợp/);
  const bindings=JSON.parse(fs.readFileSync('course-content/sources.json','utf8'));
  assert.ok(bindings.some(b=>b.courseId==='a857595d-def0-4543-9216-a680c6abfe26'&&b.sectionId==='47c1183e-a26e-4c5d-9937-88ec5a755a32'&&b.path==='course-content/web-app-development/Section1.tsx'));
 }finally{await window.happyDOM.close();}
});
