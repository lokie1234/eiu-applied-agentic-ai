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

test('section opening orbits four groups with two supporting AI icons inside VS Code',async()=>{
 const window=render(1),doc=window.document;
 try{
  const nodes=[...doc.querySelectorAll('.openingnode')];
  assert.deepEqual(nodes.map(node=>node.querySelector('strong').textContent),['VS Code','Node.js','Git','GitHub']);
  assert.ok(nodes[1].querySelector('svg'));
  const orbits=[...doc.querySelectorAll('.openingOrbit')];
  assert.equal(orbits.length,4);
  assert.deepEqual(orbits.map(orbit=>Number.parseFloat(orbit.style.animationDelay)),[0,-6.25,-12.5,-18.75]);
  orbits.slice(0,4).forEach((orbit,i)=>assert.ok(orbit.classList.contains('orbit-'+i)));
  const cluster=nodes[0].querySelector('.vscodeAICluster');
  assert.deepEqual([...cluster.querySelectorAll('img')].map(img=>img.alt),['VS Code','Codex','Antigravity']);
  assert.equal(cluster.querySelectorAll('.openingAISupport').length,2);
  assert.equal(doc.querySelector('.openingAIOrbit'),null);
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

test('practice cards open readable details without the old app tab strip',async()=>{
 for(const slide of slides.slice(7,-1).filter(s=>!['lab-divider','git-intro-ai-antigravity','git-intro-ai-codex'].includes(s.visual))){
  const window=render(slide.number), doc=window.document;
  try{
   assert.ok(doc.querySelector('.gitIntroSlide'));
   const buttons=[...doc.querySelectorAll('.gitChoice')];
   if(slide.number>=17&&slide.number<=20){
    assert.equal(doc.querySelectorAll('.inlineWorkflowCard').length,3);
    assert.equal(doc.querySelector('.inlineWorkflowCard>small'),null);
    assert.equal(doc.querySelector('.inlineWorkflowNote'),null);
    if(slide.number===19){
     const trigger=doc.querySelector('.repoGuideTrigger');
     assert.equal(trigger.textContent,'Hướng dẫn');
     assert.equal(doc.querySelector('.inlineWorkflowLink'),null);
     trigger.click();
     const dialog=doc.querySelector('[role=dialog]');
     for(const field of ['Owner','Repository name','Description','Choose visibility','Off','No .gitignore','No license'])assert.ok(dialog.textContent.includes(field),field);
     assert.equal(dialog.querySelector('a').href,'https://github.com/new');
     doc.querySelector('.repoGuideClose').click();
     assert.equal(doc.querySelector('[role=dialog]'),null);
     assert.equal(doc.activeElement,trigger);
    }else assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    assert.deepEqual([...doc.querySelectorAll('.inlineWorkflowCode pre')].map(el=>el.textContent),slide.cards.filter(c=>c.code).map(c=>c.code));
    assert.equal(doc.querySelectorAll('.inlineWorkflowCode button').length,slide.cards.filter(c=>c.code).length);
    continue;
   }
   if(slide.number===16){
    assert.equal(doc.querySelectorAll('.modelInfoCard').length,3);
    assert.equal(doc.querySelector('button'),null);
    assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    continue;
   }
   if(slide.number===14){
    assert.equal(doc.querySelectorAll('.vibeTextCard').length,3);
    assert.equal(doc.querySelector('.vibeBeforeAfter'),null);
    assert.doesNotMatch(doc.body.textContent,/Lumi Studio|Light Lab|Ví dụ/);
    assert.match(doc.querySelector('.vibeTextSteps').textContent,/Ctrl \+ Shift \+ F/);
    assert.match(doc.querySelector('.vibeTextSteps').textContent,/Ctrl \+ S/);
    assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    continue;
   }
   if(slide.number===15){
    assert.equal(doc.querySelectorAll('.vibeAiStep').length,3);
    assert.ok(doc.querySelector('.vibePrompt textarea'));
    assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    continue;
   }
   if(slide.number===12){
    assert.equal(doc.querySelectorAll('.starterCard').length,3);
    assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    assert.ok(doc.querySelector('[aria-label="File ZIP"]'));
    for(const card of slide.cards){if(!card.points)assert.ok(doc.body.textContent.includes(card.text));assert.ok(doc.body.textContent.includes(card.detail));}
    continue;
   }
   if(slide.number===13){
    assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    assert.deepEqual([...doc.querySelectorAll('.localCommand code')].map(el=>el.textContent),['npm.cmd install','npm.cmd run dev']);
    assert.equal(doc.querySelectorAll('.localCommand button').length,2);
    assert.equal(doc.querySelector('.localOpenApp').getAttribute('href'),'http://localhost:3000');
    assert.equal(doc.querySelector('.localOpenApp').target,'_blank');
    assert.match(doc.querySelector('.localRunNote').textContent,/cổng 3000 bận/);
    let command='';
    doc.execCommand=()=>{command=doc.activeElement.value;return true;};
    const copy=doc.querySelector('.localCommand button');
    copy.click();
    assert.equal(command,'npm.cmd install');
    assert.equal(copy.disabled,true);
    await new Promise(resolve=>setTimeout(resolve,500));
    assert.match(copy.textContent,/Đã sao chép/);
    continue;
   }
   if(slide.number===11){
    assert.equal(buttons.length,2);
    assert.match(doc.querySelector('.practiceSingleAiNote').textContent,/ghi đè.*xung đột/);
    assert.equal(doc.querySelector('a'),null);
    assert.match(JSON.stringify(slide.cards),/OpenAI/);
    assert.match(JSON.stringify(slide.cards),/Google/);
    assert.ok(slide.cards.every(card=>!card.link));
    assert.equal(doc.querySelector('.practiceOpen'),null);
    assert.equal(doc.querySelector('button.gitChoice'),null);
    assert.equal(doc.querySelectorAll('.practiceInstallCard .practiceSummary span').length,6);
    continue;
   }
   assert.equal(buttons.length,slide.cards.length);
   for(const [i,button] of buttons.entries()){
    button.click();
    assert.equal(doc.querySelectorAll('.gitChoice')[i],button);
    assert.equal(doc.querySelector('[role=dialog] h2').textContent,slide.cards[i].title);
    assert.equal(doc.querySelector('.gitToolTabs'),null);
    assert.ok([...doc.querySelectorAll('.gitMark img')].every(img=>img.src.startsWith('data:')));
    if(slide.number===21&&slide.cards[i].code){
     const copy=doc.querySelector('.practicePopupCopy button');
     let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
     copy.click();
     assert.equal(copy.dataset.state,'copying');
     assert.equal(copied,slide.cards[i].code);
     assert.equal(doc.querySelector('[role=dialog] textarea'),null);
     await new Promise(resolve=>setTimeout(resolve,500));
     assert.equal(copy.dataset.state,'copied');
     assert.match(copy.textContent,/Đã sao chép/);
    }
    doc.querySelector('.practiceClose').click();
    assert.equal(doc.querySelector('[role=dialog]'),null);
    assert.equal(doc.activeElement,button);
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
  assert.equal(doc.querySelectorAll('.gitTrioRoute .gitMark').length,8);
  assert.equal(doc.querySelectorAll('.gitTrioLane').length,2);
  assert.equal(doc.querySelector('.gitTrioDirection'),null);
  assert.equal(doc.querySelector('.gitTransferPush b').textContent,'Push');
  assert.equal(doc.querySelector('.gitTransferPull b').textContent,'Pull');
  assert.equal(doc.querySelector('[role=dialog]'),null);
  choices[0].click();
  let dialog=doc.querySelector('[role=dialog]');
  assert.match(dialog.querySelector('h2').textContent,/Node.js/);
  assert.equal(dialog.querySelectorAll('.gitPopupCard').length,2);
  for(const phrase of ['JavaScript','server','npm'])assert.ok(dialog.textContent.includes(phrase),phrase);
  assert.equal(dialog.querySelectorAll('.gitOverviewBullets li').length,3);
  assert.doesNotMatch(dialog.textContent,/GitHub|VS Code|\bGit\b/);
  assert.equal(dialog.querySelector('pre'),null);
  assert.equal(dialog.querySelector('a'),null);
  dialog.querySelector('.gitPopupClose').click();
  assert.equal(doc.activeElement,choices[0]);
  choices[1].click();
  dialog=doc.querySelector('[role=dialog]');
  assert.equal(dialog.getAttribute('aria-modal'),'true');
  assert.equal(dialog.querySelectorAll('.gitPopupCard').length,2);
  assert.equal(dialog.querySelector('pre'),null);
  assert.ok(dialog.textContent.includes('Commit'));
  assert.equal(dialog.querySelectorAll('.gitOverviewBullets li').length,3);
  assert.doesNotMatch(dialog.textContent,/Node\.js|GitHub|VS Code/);
  const close=dialog.querySelector('button');
  assert.equal(doc.activeElement,close);
  close.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  assert.equal(doc.activeElement,close);
  close.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(doc.querySelector('[role=dialog]'),null);
  assert.equal(doc.activeElement,choices[1]);
  choices[2].click();
  dialog=doc.querySelector('[role=dialog]');
  assert.equal(dialog.querySelectorAll('.gitPopupCard').length,2);
  for(const phrase of ['Issues','Pull Request','repository'])assert.ok(dialog.textContent.includes(phrase));
  assert.equal(dialog.querySelectorAll('.gitOverviewBullets li').length,3);
  assert.equal(dialog.querySelector('a'),null);
  dialog.querySelector('button').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
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
   assert.equal(steps.length,cards.length>1?cards.length:0);
   if(cards.length===1){
    assert.equal(dialog.querySelector('.gitSetupDetail h3').textContent,cards[0].title);
    if(cards[0].link)assert.equal(dialog.querySelector('a').href,cards[0].link);
   }
   for(const [i,step] of steps.entries()){
    step.click();
    assert.equal(dialog.querySelectorAll('.gitSetupStep[aria-pressed=true]').length,1);
    const detail=dialog.querySelector('.gitSetupDetail');
    assert.equal(detail.querySelector('h3').textContent,cards[i].title);
    assert.ok(detail.textContent.includes(cards[i].text));
    if(cards[i].code||cards[i].installationOption)assert.equal(detail.querySelector('pre').textContent,cards[i].code||cards[i].installationOption);
    if(cards[i].output)assert.equal(detail.querySelector('.gitTerminalResult pre').textContent,cards[i].output);
    if(cards[i].link){assert.equal(detail.querySelector('a').href,cards[i].link);assert.equal(detail.querySelector('a').target,'_blank');}
   }
   dialog.querySelector('.gitPopupClose').click();
   assert.equal(doc.querySelector('[role=dialog]'),null);
   assert.equal(doc.activeElement,choices[index]);
  }
  doc.querySelector('.setupBatchLaunch').click();
  const batch=data.cards.find(c=>c.label==='Kiểm tra');
  assert.equal(doc.querySelector('.setupBatchCommands').textContent,batch.code);
  assert.equal(doc.querySelector('.setupBatchColumns article:last-child pre').textContent,batch.output);
  let copied='';
  doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
  doc.querySelector('.setupCopyButton').click();
  assert.equal(doc.querySelector('.setupCopyButton').dataset.state,'copying');
  assert.equal(copied,batch.code);
  assert.equal(doc.querySelector('.setupBatch textarea'),null);
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(doc.querySelector('.setupCopyButton').dataset.state,'copied');
  assert.match(doc.querySelector('.setupCopyButton').textContent,/Đã sao chép/);
  doc.querySelector('.setupFinishVersions').click();
  assert.equal(doc.querySelector('[role=dialog]').dataset.app,'Cấu hình Git');
  assert.equal(doc.querySelectorAll('.gitSetupStep').length,2);
  assert.equal(data.cards.filter(c=>c.label==='GitHub').length,1);
  for(const command of ['code --version','node --version','npm.cmd --version','git --version','git credential-manager --version','git config --global user.name','git config --global user.email']) assert.ok(data.cards.some(c=>c.code?.includes(command)),command);
 }finally{await window.happyDOM.close();}
});

test('download uses existing ZIP and the copyable prompt preserves app behavior',async()=>{
 const download=render(12), edit=render(15);
 try{
  const link=download.document.querySelector('.gitGuideLink');
  assert.equal(link.getAttribute('href'),'/downloads/eiu-advertising-starter.zip');
  assert.equal(link.getAttribute('download'),'eiu-advertising-starter.zip');
  assert.ok(fs.existsSync('public'+link.getAttribute('href')));
  const prompt=edit.document.querySelector('textarea');
  assert.ok(prompt.readOnly);
  for(const phrase of ['Lumi Studio','Light Lab','Đăng ký workshop','điện thoại','Giữ nguyên tab','FAQ','form đăng ký','Đọc project','Kiểm tra']) assert.ok(prompt.value.includes(phrase),phrase);
  let copiedPrompt='';
  edit.document.execCommand=()=>{copiedPrompt=edit.document.activeElement.value;return true;};
  const promptCopy=edit.document.querySelector('.promptpanel button');
  promptCopy.click();
  assert.equal(promptCopy.dataset.state,'copying');
  assert.equal(copiedPrompt,prompt.value);
  assert.equal(prompt.selectionStart,prompt.selectionEnd);
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(promptCopy.dataset.state,'copied');
  assert.match(promptCopy.textContent,/Đã sao chép/);
 }finally{await download.happyDOM.close();await edit.happyDOM.close();}
});

test('the two AI tools show advantages and styled model names without embedded links or model headings',async()=>{
 for(const [page,theme] of [[8,'antigravity'],[9,'codex']]){
  const window=render(page);
  try{
   const doc=window.document;
   assert.equal(doc.querySelector('.aiBrandSlide').getAttribute('data-ai'),theme);
   assert.equal(doc.querySelector('.eiu'),null);
   assert.equal(doc.querySelectorAll('.aiBrandBenefit').length,3);
   assert.equal(doc.querySelectorAll('.aiModelRow').length,theme==='antigravity'?4:3);
   assert.equal(doc.querySelector('a'),null);
   assert.equal(doc.querySelector('.aiModelEyebrow'),null);
   assert.equal(doc.querySelector('.aiModelPanel>h2'),null);
   assert.equal(doc.querySelectorAll('.aiModelName').length,theme==='antigravity'?4:3);
  }finally{await window.happyDOM.close();}
 }
 const note=slides.find(s=>s.number===16).cards.map(c=>c.text+' '+c.detail).join(' ');
 assert.match(note,/Một số model/);
 assert.match(note,/công cụ.*quyền/);
 assert.match(note,/không phải tất cả model/);
});

test('setup and practice lead to complete Push, Pull and Clone workflows',()=>{
 const commands=new Map([
  [7,['code --version','node --version','npm.cmd --version','git credential-manager --version']],
  [7,['git config --global user.name','git config --global user.email']],
  [13,['npm.cmd install','npm.cmd run dev']],
  [17,['npm.cmd test','npm.cmd run build','npm.cmd run start']],
  [18,['git init -b main','git add .','git diff --cached','git commit -m']],
  [19,['git remote add origin','git remote -v','git push -u origin main']],
  [20,['git branch --show-current','git diff','git commit -m','git push']],
  [21,['git status','git pull --ff-only origin main','git log','git clone https://github.com/USERNAME/eiu-advertising-starter.git']]
 ]);
 for(const [page,values] of commands){
  const data=JSON.stringify(slides.find(s=>s.number===page));
  for(const value of values) assert.ok(data.includes(value),`Slide ${page}: ${value}`);
 }
 assert.equal(slides.length,22);
 assert.equal(slides[8].visual,'git-intro-ai-codex');
 assert.equal(slides[9].visual,'lab-divider');
 assert.equal(slides[9].title,'Lab 3');
 assert.equal(slides[10].visual,'git-intro-ai-setup');
 assert.equal(slides[11].visual,'git-intro-starter');
 assert.equal(slides[16].visual,'git-intro-build');
 assert.equal(slides[17].visual,'git-intro-initialize');
 assert.equal(slides.at(-1).visual,'git-intro-quiz');
 assert.ok(!slides.slice(5).some(s=>JSON.stringify(s).includes('webapp-web')));
 assert.ok(slides.slice(16,20).every(slide=>slide.cards.every(card=>!card.detail)));
 assert.match(JSON.stringify(slides[6]),/không cần cài GitHub Desktop hoặc extension GitHub/);
});

test('quiz gives feedback and the source remains registered for live display',async()=>{
 const window=render(22);
 try{
  window.document.querySelector('.choices button').click();
  assert.match(window.document.querySelector('.feedback').textContent,/Phù hợp/);
  const bindings=JSON.parse(fs.readFileSync('course-content/sources.json','utf8'));
  assert.ok(bindings.some(b=>b.courseId==='a857595d-def0-4543-9216-a680c6abfe26'&&b.sectionId==='47c1183e-a26e-4c5d-9937-88ec5a755a32'&&b.path==='course-content/web-app-development/Section1.tsx'));
 }finally{await window.happyDOM.close();}
});
