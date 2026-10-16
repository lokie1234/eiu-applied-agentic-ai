import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Window } from 'happy-dom';

const source = fs.readFileSync('course-content/web-app-development/Section1.tsx','utf8');
const sectionSlides = JSON.parse(fs.readFileSync('course-content/web-app-development/storyboard.json','utf8')).slides.filter(s=>s.section===1);
// Existing scenarios retain their layout identities when a new slide is inserted.
const slides = sectionSlides.filter(s=>!['vscode-shortcuts','git-intro-ai-workflow','git-intro-skill-functions','git-intro-skill-defaults'].includes(s.visual)).map(s=>({...s,number:s.layoutNumber??s.number}));
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'h',jsxFragmentFactory:'Fragment'}}).outputText;
const documents = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/tsxDocument.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:documents});
function render(page){
 const displayPage=sectionSlides.find(s=>(s.layoutNumber??s.number)===page && !['vscode-shortcuts','git-intro-ai-workflow','git-intro-skill-functions','git-intro-skill-defaults'].includes(s.visual)).number;
 return renderDisplay(displayPage);
}
function renderDisplay(page){
 const window = new Window();
 window.document.body.innerHTML='<div id="root"></div>';
 const script=documents.createTsxDocument(compiled,page).match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(script,{document:window.document,Node:window.Node,URL:window.URL,window,parent:{postMessage(){}},setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window)},{timeout:3000});
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
    assert.deepEqual([...doc.querySelectorAll('.inlineWorkflowCards pre')].map(el=>el.textContent),slide.cards.filter(c=>c.code).map(c=>c.code));
    assert.equal(doc.querySelectorAll('.inlineWorkflowCards .copyControl').length,slide.cards.filter(c=>c.code).length);
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
    for(const card of slide.cards){if(!card.points)assert.ok(doc.body.textContent.includes(card.text));}
    assert.equal(doc.querySelector('.starterNote'),null);
    assert.equal(doc.querySelector('.starterHero h2').textContent,'Lumi Studio');
    continue;
   }
   if(slide.number===13){
    assert.equal(doc.querySelector('[aria-haspopup=dialog]'),null);
    assert.deepEqual([...doc.querySelectorAll('.localCommand code')].map(el=>el.textContent),['npm.cmd install','npm.cmd run dev']);
    assert.equal(doc.querySelectorAll('.localCommand button').length,2);
    assert.equal(doc.querySelector('.localOpenApp').getAttribute('href'),'http://localhost:3000');
    assert.equal(doc.querySelector('.localOpenApp').target,'_blank');
    assert.equal(doc.querySelector('.localRunNote'),null);
    assert.equal(doc.querySelector('.localStepNote'),null);
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
 assert.equal(slides.at(-1).visual,'git-intro-repo-showcase');
 assert.ok(!slides.slice(5).some(s=>JSON.stringify(s).includes('webapp-web')));
 assert.ok(slides.slice(16,20).every(slide=>slide.cards.every(card=>!card.detail)));
 assert.match(JSON.stringify(slides[6]),/không cần cài GitHub Desktop hoặc extension GitHub/);
});

test('repository showcase has official embedded icons, functions and links and remains registered',async()=>{
 const window=renderDisplay(25);
 try{
  const doc=window.document;
  assert.equal(doc.querySelector('.gitGuideQuiz'),null);
  const cards=[...doc.querySelectorAll('.repoShowcaseCard')];
  assert.equal(cards.length,4);
  assert.equal(new Set(cards.map(c=>c.querySelector('img').src)).size,4);
  for(let i=0;i<cards.length;i++){
   const source=sectionSlides[24].cards[i],card=cards[i];
   assert.equal(card.querySelector('h2').textContent,source.title);
   assert.match(card.querySelector('img').src,/^data:image\/png;base64,/);
   assert.equal(card.querySelectorAll('li').length,2);
   assert.equal(card.querySelector('a').href,source.link);
   assert.equal(card.querySelector('a').target,'_blank');
   assert.equal(card.querySelector('a').rel,'noopener noreferrer');
   assert.equal(card.querySelector('[title]'),null);
   card.querySelector('a').focus();assert.equal(doc.activeElement,card.querySelector('a'));
  }
  assert.equal(new Set(cards.map(c=>c.querySelector('.repoShowcaseIcon').style.animationDelay)).size,4);
  const bindings=JSON.parse(fs.readFileSync('course-content/sources.json','utf8'));
  assert.ok(bindings.some(b=>b.courseId==='a857595d-def0-4543-9216-a680c6abfe26'&&b.sectionId==='47c1183e-a26e-4c5d-9937-88ec5a755a32'&&b.path==='course-content/web-app-development/Section1.tsx'));
 }finally{await window.happyDOM.close();}
});

test('each repository opens its own installation guide with copy, links and keyboard navigation',async()=>{
 const window=renderDisplay(25),doc=window.document;
 try{
  const triggers=[...doc.querySelectorAll('.repoShowcaseInstall')];
  assert.equal(triggers.length,4);
  for(let i=0;i<triggers.length;i++){
   const card=sectionSlides[24].cards[i],setup=card.setup;
   triggers[i].click();
   const dialog=doc.querySelector('.repoInstallDialog');assert.ok(dialog);
   assert.equal(dialog.getAttribute('role'),'dialog');
   assert.equal(dialog.getAttribute('aria-modal'),'true');
   assert.ok(doc.getElementById(dialog.getAttribute('aria-labelledby')).textContent.includes(card.title));
   assert.ok(dialog.querySelector('.repoInstallPrereq').textContent.includes(setup.shell));
   assert.equal(dialog.querySelectorAll('.repoInstallStep').length,3);
   assert.equal(dialog.querySelector('[title]'),null);
   const controls=[...dialog.querySelectorAll('button,a[href]')];
   assert.equal(doc.activeElement,controls[0]);
   controls[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));
   assert.equal(doc.activeElement,controls.at(-1));
   controls.at(-1).dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
   assert.equal(doc.activeElement,controls[0]);
   dialog.querySelector('h3').click();assert.ok(doc.querySelector('[role=dialog]'));
   const codes=setup.steps.filter(s=>s.code).map(s=>s.code);
   assert.deepEqual([...dialog.querySelectorAll('pre')].map(p=>p.textContent),codes);
   const copies=[...dialog.querySelectorAll('.copyControl')];
   assert.equal(copies.length,codes.length);
   for(let n=0;n<copies.length;n++){
    let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
    copies[n].click();assert.equal(copied,codes[n]);
    await new Promise(resolve=>setTimeout(resolve,480));
    assert.equal(copies[n].dataset.state,'copied');
    assert.equal(doc.querySelector('textarea'),null);
   }
   const links=[...dialog.querySelectorAll('a')];
   assert.equal(links[0].href,setup.docs);
   if(setup.appUrl)assert.equal(links[1].href,setup.appUrl+(new URL(setup.appUrl).pathname==='/'&&!setup.appUrl.endsWith('/')?'/':''));
   for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');}
   dialog.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert.equal(doc.querySelector('[role=dialog]'),null);
   assert.equal(doc.activeElement,triggers[i]);
  }
  triggers[0].click();doc.querySelector('.repoInstallOverlay').click();
  assert.equal(doc.querySelector('[role=dialog]'),null);assert.equal(doc.activeElement,triggers[0]);
  triggers[1].click();doc.querySelector('.repoInstallDialog .skillDefaultClose').click();
  assert.equal(doc.querySelector('[role=dialog]'),null);assert.equal(doc.activeElement,triggers[1]);
  assert.match(sectionSlides[24].cards[3].setup.shell,/WSL/);
  assert.ok(!sectionSlides[24].cards[3].setup.steps.some(s=>s.code?.includes('npx n8n')));
 }finally{await window.happyDOM.close();}
});

test('all 25 slides retain embedded Inter while only loading their layout styles',async()=>{
 assert.equal(fs.readFileSync('course-content/web-app-development/fonts/Inter-Variable.woff2').subarray(0,4).toString(),'wOF2');
 assert.doesNotMatch(source,/git-intro-quiz|\.skillFeatureGrid\{|\.skillOutcome\{/);
 for(const slide of sectionSlides){
  const window=renderDisplay(slide.number),doc=window.document;
  try{
   const css=[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n');
   assert.equal((css.match(/@font-face/g)||[]).length,1,'one embedded font declaration on slide '+slide.number);
   assert.match(css,/data:font\/woff2;base64,/);
   assert.doesNotMatch(css,/data:font\/ttf;base64,/);
   if(slide.visual!=='cover')assert.ok(!css.includes('.coverSlide{'));
   if(!slide.visual.startsWith('workspace-'))assert.ok(!css.includes('.vscodeMap{'));
   if(slide.visual.startsWith('git-intro-')&&!['git-intro-ai-antigravity','git-intro-ai-codex'].includes(slide.visual))assert.ok(css.includes('.gitIntroSlide .copyControl'));
   assert.equal(doc.querySelector('.eiu')?.style.boxShadow||'','');
  }finally{await window.happyDOM.close();}
 }
});

test('installation dialog preserves repo links and copies install and invocation commands',async()=>{
 assert.equal(sectionSlides.length,25);
 assert.equal(sectionSlides[21].visual,'git-intro-pull');
 assert.equal(sectionSlides[22].visual,'git-intro-ai-workflow');
 assert.equal(sectionSlides[23].visual,'git-intro-skill-defaults');
 assert.equal(sectionSlides[24].visual,'git-intro-repo-showcase');
 assert.ok(!sectionSlides.some(s=>s.visual==='git-intro-skill-functions'));
 assert.deepEqual(sectionSlides.map(s=>s.number),Array.from({length:25},(_,i)=>i+1));
 const window=renderDisplay(24),doc=window.document;
 try{
  const install=doc.querySelector('.skillInstallToolbar button');install.click();
  const dialog=doc.querySelector('[role=dialog]');assert.ok(dialog);
  const controls=[...dialog.querySelectorAll('button,a[href]')];
  assert.equal(doc.activeElement,controls[0]);
  controls[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));
  assert.equal(doc.activeElement,controls.at(-1));
  assert.equal(doc.querySelector('[role=tab]'),null);
  const links=[...doc.querySelectorAll('.skillRepo a')];
  assert.equal(links.length,1);
  assert.equal(links[0].href,'https://github.com/lokie1234/Effective-Vibe-Coding');
  const commands=[...doc.querySelectorAll('.skillCommandBox pre')].map(el=>el.textContent);
  assert.deepEqual(commands,[
   'git clone https://github.com/lokie1234/Effective-Vibe-Coding.git ../Effective-Vibe-Coding',
   'node ../Effective-Vibe-Coding/scripts/install.mjs --target .'
  ]);
  assert.match(doc.querySelector('.skillTerminalIntro').textContent,/folder project muốn cài/);
  const expected=[...commands,...sectionSlides[23].regionDetails[0].cards.slice(2).map(c=>c.prompt)];
  const buttons=[...doc.querySelectorAll('.skillSetup .copyControl')];
  assert.equal(buttons.length,4);
  const actions=[...doc.querySelectorAll('.skillSetup a,.skillSetup button')];
  assert.equal(actions.length,5);
  assert.equal(doc.querySelector('[role=tooltip]'),null);
  assert.equal(doc.querySelector('.skillSetup .gitLead'),null);
  assert.equal(doc.querySelector('.skillCommand small'),null);
  for(const action of actions){
   assert.equal(action.getAttribute('aria-describedby'),null);
   assert.equal(action.getAttribute('title'),null);
   action.focus();assert.equal(doc.activeElement,action);
  }
  for(let i=0;i<buttons.length;i++){
   let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
   buttons[i].click();assert.equal(copied,expected[i]);
   assert.equal(doc.querySelector('textarea'),null,'fallback copy cleans up temporary input');
   await new Promise(resolve=>setTimeout(resolve,500));
   assert.equal(buttons[i].dataset.state,'copied');
  }
  assert.match(expected[2],/^\$effective-vibe-coding/);
  assert.match(expected[3],/Áp dụng skill effective-vibe-coding/);
  dialog.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(doc.querySelector('[role=dialog]'),null);
  assert.equal(doc.activeElement,install);
 }finally{await window.happyDOM.close();}
});

test('skill introduction summarizes capabilities without duplicating installation',async()=>{
 const window=renderDisplay(23),doc=window.document;
 try{
  assert.equal(doc.querySelectorAll('.skillBulletCard').length,3);
  assert.equal(doc.querySelectorAll('.skillBulletCard li').length,6);
  for(const card of sectionSlides[22].cards){assert.ok(doc.body.textContent.includes(card.title));for(const point of card.points)assert.ok(doc.body.textContent.includes(point));}
  assert.equal(doc.querySelector('.skillCommands'),null);
  assert.equal(doc.querySelector('.skillOutcome'),null);
  assert.equal(doc.querySelector('.skillBrandName').textContent,'EffectiveVibe Coding');
  assert.ok(doc.querySelector('.skillBrandEmblem img'));
  assert.equal(doc.querySelectorAll('.skillGear').length,2);
  assert.ok(doc.querySelector('.skillRepairWrench'));
  assert.equal(doc.querySelector('.skillIntro button,.skillIntro a'),null);
  assert.equal(doc.querySelector('[role=tab]'),null);
 }finally{await window.happyDOM.close();}
});

test('activation comparison opens setup dialogs, copies rules and restores keyboard focus',async()=>{
 const window=renderDisplay(24),doc=window.document;
 try{
  const triggers=[...doc.querySelectorAll('.skillDefaultCard .skillDefaultButton')];
  assert.equal(triggers.length,3);
  assert.equal(doc.querySelector('.skillDefaultAdvice'),null);
  assert.equal(doc.querySelector('.skillDefaults .gitLead'),null);
  assert.equal(doc.querySelector('[role=tooltip]'),null);
  assert.equal(doc.querySelectorAll('.skillDefaultIdentity').length,3);
  assert.equal(doc.querySelectorAll('.skillDefaultTrade').length,6);
  for(let i=0;i<3;i++){
   triggers[i].click();
   const dialog=doc.querySelector('[role=dialog]');
   assert.ok(dialog);assert.equal(dialog.getAttribute('aria-modal'),'true');
   assert.equal(dialog.querySelector('.skillDefaultCheck'),null);
   assert.equal(dialog.querySelector('[title]'),null);
   const controls=[...dialog.querySelectorAll('button')];
   assert.equal(doc.activeElement,controls[0]);
   controls[0].dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));
   assert.equal(doc.activeElement,controls.at(-1));
   assert.doesNotMatch(dialog.textContent,/slide\s*\d|xem lại|kiểm tra hướng dẫn/i);
   if(i===0)assert.equal(dialog.querySelectorAll('code').length,1);
   if(i===1){
    assert.match(dialog.textContent,/Bộ cài đã thêm lời nhắc/);
    assert.match(dialog.textContent,/Nếu cài thủ công/);
   }
   if(i===2){
    assert.match(dialog.textContent,/~\/.agents\/skills\/effective-vibe-coding/);
    assert.match(dialog.textContent,/~\/.codex\/AGENTS.md/);
    assert.match(dialog.textContent,/~\/.gemini\/config\/skills/);
    assert.match(dialog.textContent,/~\/.gemini\/GEMINI.md/);
   }
   if(i>0){
    let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
    const copy=dialog.querySelector('.copyControl');copy.click();
    assert.equal(copied,sectionSlides[23].prompt);
    await new Promise(resolve=>setTimeout(resolve,500));
    assert.equal(copy.dataset.state,'copied');
   }
   dialog.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert.equal(doc.querySelector('[role=dialog]'),null);
   assert.equal(doc.activeElement,triggers[i]);
  }
  triggers[1].click();doc.querySelector('.skillDefaultOverlay').click();
  assert.equal(doc.querySelector('[role=dialog]'),null);
  assert.equal(doc.activeElement,triggers[1]);
 }finally{await window.happyDOM.close();}
});

test('slide 8 builds copyable PowerShell identity commands from user inputs and retains them across steps',async()=>{
 const window=renderDisplay(8),doc=window.document;
 try{
  doc.querySelector('.setupFinishVersions').click();
  const editor=doc.querySelector('.editableGit[data-mode=identity]');
  assert.ok(editor);assert.equal(editor.querySelector('button').disabled,true);
  const inputs=[...editor.querySelectorAll('input')];
  const input=(field,value)=>{field.value=value;field.dispatchEvent(new window.Event('input',{bubbles:true}));};
  input(inputs[0],"Nguyễn O'Brien $HOME");input(inputs[1],'not-an-email');
  assert.equal(editor.querySelector('button').disabled,true);
  input(inputs[1],'123456+an@users.noreply.github.com');
  const command="git config --global user.name 'Nguyễn O''Brien $HOME'\ngit config --global user.email '123456+an@users.noreply.github.com'\ngit config --global init.defaultBranch main";
  assert.equal(editor.querySelector('pre').textContent,command);
  assert.equal(editor.querySelector('button').disabled,false);
  let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
  editor.querySelector('button').click();assert.equal(copied,command);
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(editor.querySelector('button').dataset.state,'copied');
  const steps=[...doc.querySelectorAll('.gitSetupStep')];steps[1].click();
  assert.ok(doc.querySelector('.gitTerminalBlock .copyControl'));
  steps[0].click();
  assert.equal(doc.querySelector('.editableGit input').value,"Nguyễn O'Brien $HOME");
  assert.equal(doc.querySelector('.editableGit pre').textContent,command);
 }finally{await window.happyDOM.close();}
});

test('slide 20 validates the GitHub URL, updates commands and copies a snapshot of the entered repository',async()=>{
 const window=renderDisplay(20),doc=window.document;
 try{
  const editor=doc.querySelector('.editableGit[data-mode=repo]');
  const field=editor.querySelector('input');
  const input=value=>{field.value=value;field.dispatchEvent(new window.Event('input',{bubbles:true}));};
  assert.equal(editor.querySelector('button').disabled,true);
  for(const value of ['URL_REPO','http://github.com/user/repo','https://token@github.com/user/repo','https://github.com/user/repo?token=x','https://example.com/user/repo']){
   input(value);assert.equal(editor.querySelector('button').disabled,true,value);
  }
  input('https://github.com/lokie1234/Effective-Vibe-Coding.git');
  const command="git remote add origin 'https://github.com/lokie1234/Effective-Vibe-Coding.git'\ngit remote -v";
  assert.equal(editor.querySelector('pre').textContent,command);
  let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
  const oldButton=editor.querySelector('button');oldButton.click();assert.equal(copied,command);
  input('');assert.equal(editor.querySelector('button').disabled,true);
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(editor.querySelector('button').disabled,true,'finishing an old copy cannot enable an invalid form');
  input('https://github.com/user/another-repo');
  assert.match(editor.querySelector('pre').textContent,/another-repo/);
  assert.equal(editor.querySelector('button').dataset.state,'idle');
 }finally{await window.happyDOM.close();}
});
