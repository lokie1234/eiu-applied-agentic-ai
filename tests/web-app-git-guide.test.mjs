import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Window } from 'happy-dom';

const source = fs.readFileSync('course-content/web-app-development/Section1.js','utf8');
const sectionSlides = JSON.parse(fs.readFileSync('course-content/web-app-development/storyboard.json','utf8')).slides.filter(s=>s.section===1);
// Existing scenarios retain their layout identities when a new slide is inserted.
const slides = sectionSlides.filter(s=>!['git-intro-ai-claude','vscode-shortcuts'].includes(s.visual)).map(s=>({...s,number:s.layoutNumber??s.number}));
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'h',jsxFragmentFactory:'Fragment'}}).outputText;
const documents = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/tsxDocument.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:documents});
function render(page){
 const displayPage=(sectionSlides.find(s=>s.layoutNumber===page) ?? sectionSlides.find(s=>s.number===page && !s.layoutNumber)).number;
 return renderDisplay(displayPage);
}
function renderDisplay(page){
 const window = new Window();
 window.document.body.innerHTML='<div id="root"></div>';
 const script=documents.createTsxDocument(compiled,page,"","","",true).match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(script,{document:window.document,Node:window.Node,URL:window.URL,window,parent:{postMessage(){}},setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window)},{timeout:3000});
 const error=window.document.querySelector('#error');
 assert.ok(!error,`Slide ${page} renders: ${error?.textContent||''}`);
 return window;
}

test('section opening orbits four groups with three supporting AI icons inside VS Code',async()=>{
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
  assert.deepEqual([...cluster.querySelectorAll('img')].map(img=>img.alt),['VS Code','Codex','Antigravity','Claude']);
  assert.equal(cluster.querySelectorAll('.openingAISupport').length,3);
  assert.equal(Boolean(doc.querySelector('.openingAIOrbit')),false);
  assert.equal(doc.querySelector('.openinglinks circle').getAttribute('r'),'170');
  assert.equal(Boolean(doc.querySelector('.openinglinks path')),false);
  assert.match(doc.querySelector('.openingSubtitle').textContent,/Node.js/);
  assert.match(doc.querySelector('.openingcopy p').textContent,/Node.js chạy và kiểm tra/);
  assert.deepEqual([...doc.querySelectorAll('.openingroles>span')].map(item=>item.textContent),['Chỉnh sửa cùng AI','Chạy app với Node.js','Kiểm tra kết quả','Quản lý phiên bản']);
  assert.equal(Boolean(doc.querySelector('.openingNodeSummary')),false);
  assert.equal(Boolean(doc.querySelector('.openingroles code')),false);
 }finally{await window.happyDOM.close();}
});

test('VS Code introduction follows outcomes and preserves the workspace map',async()=>{
 const window=render(3),doc=window.document;
 try{
  assert.ok(doc.querySelector('.vscodeIntro'));
  assert.equal(doc.querySelector('.vscodeIntroTitle').textContent,sectionSlides.find(s=>s.visual==='vscode-intro').title);
  assert.ok(doc.querySelector('.vscodeIntroBadge img').src.startsWith('data:image/'));
  assert.equal(sectionSlides.find(s=>s.visual==='workspace-map').number,4);
 }finally{await window.happyDOM.close();}
});

test('workspace map opens six matching region popups with compact text headers and navy emphasis',async()=>{
 const window=render(4),doc=window.document;
 try{
  // The corner logo must stay out of document flow so the full map fits.
  const logoStyle=window.getComputedStyle(doc.querySelector('.workspaceCornerLogo'));
  assert.equal(logoStyle.position,'absolute');
  assert.equal(logoStyle.width,'54px');
  assert.equal(logoStyle.height,'54px');
  assert.equal(logoStyle.top,'28px');
  assert.equal(logoStyle.right,'42px');
  const names=[...doc.querySelectorAll('.vscodeName')];
  assert.equal(doc.querySelectorAll('.vscodeName p').length,0);
  assert.equal(names[5].querySelector('h3').textContent,'Trợ lý AI');
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
   assert.equal(Boolean(doc.querySelector('.workspacePopup')),false);assert.equal(doc.activeElement,names[i]);
   targets[i].click();
   assert.equal(doc.querySelector('.workspacePopup h2').textContent,details[i].title);
   doc.querySelector('.workspacePopupOverlay').click();
   assert.equal(Boolean(doc.querySelector('.workspacePopup')),false);assert.equal(doc.activeElement,targets[i]);
  }
 }finally{await window.happyDOM.close();}
});

test('practice cards open readable details without the old app tab strip',async()=>{
 for(const slide of slides.filter(s=>s.visual.startsWith('git-intro-') && s.number>=11 && s.number<=21)){
  const window=render(slide.number), doc=window.document;
  try{
   assert.ok(doc.querySelector('.gitIntroSlide'));
   const buttons=[...doc.querySelectorAll('.gitChoice')];
   if(slide.number>=17&&slide.number<=21){
    assert.equal(doc.querySelectorAll('.inlineWorkflowCard,.buildReviewRow').length,3);
    assert.equal(Boolean(doc.querySelector('.inlineWorkflowCard>small')),false);
    assert.equal(Boolean(doc.querySelector('.inlineWorkflowNote')),false);
    if(slide.number===19){
     const trigger=doc.querySelector('.repoGuideTrigger');
     assert.equal(trigger.textContent,'Hướng dẫn');
     assert.equal(Boolean(doc.querySelector('.inlineWorkflowLink')),false);
     trigger.click();
     const dialog=doc.querySelector('[role=dialog]');
     for(const field of ['Owner','Repository name','Description','Choose visibility','Off','No .gitignore','No license'])assert.ok(dialog.textContent.includes(field),field);
     assert.equal(dialog.querySelector('a').href,'https://github.com/new');
     doc.querySelector('.repoGuideClose').click();
     assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
     assert.equal(doc.activeElement,trigger);
    }else assert.equal(Boolean(doc.querySelector('[aria-haspopup=dialog]')),false);
    const commands=[...doc.querySelectorAll('.inlineWorkflowCards pre,.buildReviewCommand pre')].map(el=>el.textContent);
    const expected=slide.cards.filter(c=>c.code).map(c=>c.code);
    if(slide.number===21){
     assert.deepEqual(commands.slice(0,2),expected.slice(0,2));
     assert.match(commands[2],/^git clone -- URL_REPO /);
     assert.ok(doc.querySelector('.editableGit input'));
    }else assert.deepEqual(commands,expected);
    assert.equal(doc.querySelectorAll('.inlineWorkflowCards .copyControl,.buildReviewCommand .copyControl').length,slide.cards.filter(c=>c.code).length);
    if(slide.number===21){
     let copied='';doc.execCommand=()=>{copied=doc.activeElement.value;return true;};
     const copy=doc.querySelector('.inlineWorkflowCards .copyControl');
     copy.click();
     assert.equal(copied,slide.cards.find(c=>c.code).code);
     assert.equal(copy.dataset.state,'copying');
     await new Promise(resolve=>setTimeout(resolve,500));
     assert.equal(copy.dataset.state,'copied');
    }
    continue;
   }
   if(slide.number===16){
    assert.equal(doc.querySelectorAll('.modelInfoCard').length,3);
    assert.equal(Boolean(doc.querySelector('button')),false);
    assert.equal(Boolean(doc.querySelector('[aria-haspopup=dialog]')),false);
    continue;
   }
   if(slide.number===14){
    assert.equal(doc.querySelectorAll('.vibeTextCard').length,3);
    assert.equal(Boolean(doc.querySelector('.vibeBeforeAfter')),false);
    assert.doesNotMatch(doc.body.textContent,/Lumi Studio|Light Lab|Ví dụ/);
    assert.match(doc.querySelector('.vibeTextSteps').textContent,/Ctrl \+ Shift \+ F/);
    assert.match(doc.querySelector('.vibeTextSteps').textContent,/Ctrl \+ S/);
    assert.equal(Boolean(doc.querySelector('[aria-haspopup=dialog]')),false);
    continue;
   }
   if(slide.number===15){
    assert.equal(doc.querySelectorAll('.vibeAiStep').length,3);
    assert.ok(doc.querySelector('.vibePrompt textarea'));
    assert.equal(Boolean(doc.querySelector('[aria-haspopup=dialog]')),false);
    continue;
   }
   if(slide.number===12){
    assert.ok(doc.querySelector('.starterPromptPanel textarea'));
    assert.ok(doc.querySelector('.starterDownloadTrigger'));
    assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
    continue;
   }
   if(slide.number===13){
    const guide=doc.querySelector('.multiProjectTrigger');
    guide.click();
    assert.ok(doc.querySelector('.multiProjectDialog'));
    doc.querySelector('.multiProjectDialog .practiceClose').click();
    assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
    assert.deepEqual([...doc.querySelectorAll('.localCommand code')].map(el=>el.textContent),['npm.cmd install','npm.cmd run dev']);
    assert.equal(doc.querySelectorAll('.localCommand button').length,2);
    assert.equal(doc.querySelector('.localOpenApp').getAttribute('href'),'http://localhost:3000');
    assert.equal(doc.querySelector('.localOpenApp').target,'_blank');
    assert.equal(Boolean(doc.querySelector('.localRunNote')),false);
    assert.equal(Boolean(doc.querySelector('.localStepNote')),false);
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
    assert.equal(buttons.length,3);
    const claude=buttons[2];
    assert.equal(claude.querySelector('h2').textContent,'Cài Claude');
    assert.match(claude.textContent,/Claude Code/);
    assert.match(claude.textContent,/Anthropic/);
    assert.match(claude.textContent,/Install/);
    assert.doesNotMatch(claude.textContent,/CLI|npm|đăng nhập/i);
    assert.match(doc.querySelector('.practiceSingleAiNote').textContent,/ghi đè.*xung đột/);
    assert.equal(Boolean(doc.querySelector('a')),false);
    assert.match(JSON.stringify(slide.cards),/OpenAI/);
    assert.match(JSON.stringify(slide.cards),/Google/);
    assert.ok(slide.cards.every(card=>!card.link));
    assert.equal(Boolean(doc.querySelector('.practiceOpen')),false);
    assert.equal(Boolean(doc.querySelector('button.gitChoice')),false);
    assert.equal(doc.querySelectorAll('.practiceInstallCard .practiceSummary span').length,slide.cards.reduce((total,card)=>total+card.summary.length,0));
    continue;
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
  assert.equal(Boolean(doc.querySelector('.gitTrioDirection')),false);
  assert.equal(doc.querySelector('.gitTransferPush b').textContent,'Push');
  assert.equal(doc.querySelector('.gitTransferPull b').textContent,'Pull');
  assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
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
  assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
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
  assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
 }finally{await window.happyDOM.close();}
});

test('setup popup covers all four tools, links, commands and configuration steps',async()=>{
 const window=render(7),doc=window.document;
 const data=slides.find(s=>s.visual==='git-intro-setup-overview');
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
   assert.equal(Boolean(doc.querySelector('[role=dialog]')),false);
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
  assert.equal(Boolean(doc.querySelector('.setupBatch textarea')),false);
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
  download.document.querySelector('.starterDownloadTrigger').click();
  const link=download.document.querySelector('[role=dialog] a[download]');
  assert.equal(link.getAttribute('href'),'/downloads/eiu-advertising-starter.zip');
  assert.equal(link.getAttribute('download'),'eiu-advertising-starter.zip');
  assert.ok(fs.existsSync('public'+link.getAttribute('href')));
  const prompt=edit.document.querySelector('textarea');
  assert.equal(prompt.readOnly,false);
  assert.equal(prompt.value,sectionSlides.find(s=>s.visual==='git-intro-ai-edit').cards[1].prompt);
  let copiedPrompt='';
  edit.document.execCommand=()=>{copiedPrompt=edit.document.activeElement.value;return true;};
  prompt.value+='\nKeep the current access controls.';
  prompt.dispatchEvent(new edit.Event('input',{bubbles:true}));
  const promptCopy=edit.document.querySelector('.vibePrompt .copyControl');
  promptCopy.click();
  assert.equal(promptCopy.dataset.state,'copying');
  assert.equal(copiedPrompt,prompt.value);
  assert.equal(prompt.selectionStart,prompt.selectionEnd);
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(promptCopy.dataset.state,'copied');
  assert.match(promptCopy.textContent,/Đã sao chép/);
 }finally{await download.happyDOM.close();await edit.happyDOM.close();}
});

test('AI overview selects three tools and keeps Copilot and Cline in the moving logo strip',async()=>{
 const window=renderDisplay(6),doc=window.document;
 try{
  const choices=[...doc.querySelectorAll('.aiChoice')];
  assert.deepEqual(choices.map(c=>c.querySelector('strong').textContent),['Claude','Antigravity','Codex']);
  choices.forEach((button,index)=>{
   button.click();
   assert.equal(button.getAttribute('aria-pressed'),'true');
   assert.equal(doc.querySelector('.aiInfo').getAttribute('data-brand'),String(index));
   assert.equal(doc.querySelector('.aiInfoHead h2').textContent,button.querySelector('strong').textContent);
   assert.ok(button.querySelector('img').src.startsWith('data:image/'));
  });
  assert.equal(doc.querySelectorAll('.aiMarqueeGroup').length,2);
  for(const group of doc.querySelectorAll('.aiMarqueeGroup')){
   const names=[...group.querySelectorAll('.aiMarqueeItem')].map(n=>n.textContent);
   assert.equal(names.length,12);
   assert.equal(new Set(names).size,12);
   assert.ok(names.includes('GitHub Copilot')&&names.includes('Cline'));
  }
 }finally{await window.happyDOM.close();}
});

test('Claude follows Codex and shares the branded AI layout without changing later layout identities',async()=>{
 const codexIndex=sectionSlides.findIndex(s=>s.visual==='git-intro-ai-codex');
 assert.equal(sectionSlides[codexIndex+1].visual,'git-intro-ai-claude');
 assert.equal(sectionSlides[codexIndex+2].visual,'lab-divider');
 assert.equal(sectionSlides[codexIndex+2].layoutNumber,10);
 const window=renderDisplay(sectionSlides[codexIndex+1].number),doc=window.document;
 try{
  assert.equal(doc.querySelector('.aiBrandSlide').dataset.ai,'claude');
  assert.equal(doc.querySelectorAll('.aiBrandBenefit').length,3);
  assert.deepEqual([...doc.querySelectorAll('.aiModelName')].map(n=>n.textContent),['Claude Sonnet','Claude Opus','Claude Haiku']);
  assert.equal(doc.querySelectorAll('.aiBenefitLine').length,6);
  assert.ok(doc.querySelector('.aiBrandLogo').src.startsWith('data:image/'));
  assert.equal(Boolean(doc.querySelector('.aiModelCursor')),false);
 }finally{await window.happyDOM.close();}
});

test('the two AI tools show advantages and styled model names without embedded links or model headings',async()=>{
 for(const [page,theme] of [[8,'antigravity'],[9,'codex']]){
  const window=render(page);
  try{
   const doc=window.document;
   assert.equal(doc.querySelector('.aiBrandSlide').getAttribute('data-ai'),theme);
   assert.equal(Boolean(doc.querySelector('.eiu')),false);
   assert.equal(doc.querySelectorAll('.aiBrandBenefit').length,3);
   assert.equal(doc.querySelectorAll('.aiModelRow').length,theme==='antigravity'?4:3);
   assert.equal(Boolean(doc.querySelector('a')),false);
   assert.equal(Boolean(doc.querySelector('.aiModelEyebrow')),false);
   assert.equal(Boolean(doc.querySelector('.aiModelPanel>h2')),false);
   assert.equal(doc.querySelectorAll('.aiModelName').length,theme==='antigravity'?4:3);
  }finally{await window.happyDOM.close();}
 }
 const note=slides.find(s=>s.number===16).cards.map(c=>c.text+' '+c.detail).join(' ');
 assert.match(note,/Một số model/);
 assert.match(note,/công cụ.*quyền/);
 assert.match(note,/không phải tất cả model/);
});

test('setup and practice lead to complete Push, Pull and Clone workflows',()=>{
 for(const command of ['code --version','node --version','git config --global user.name','npm.cmd install','npm.cmd run dev','npm.cmd test','npm.cmd run build','git init -b main','git add .','git commit -m','git remote add origin','git push -u origin main','git pull --ff-only origin main','git clone']) assert.ok(source.includes(command),command);
 assert.equal(sectionSlides.length,32);
 assert.deepEqual(sectionSlides.map(s=>s.number),Array.from({length:32},(_,i)=>i+1));
 assert.equal(sectionSlides.at(-2).visual,'git-intro-submission');
 assert.equal(sectionSlides.at(-1).visual,'git-intro-section-quiz');
 for(const visual of ['git-intro-initialize','git-intro-publish','git-intro-push-code','git-intro-pull'])assert.ok(sectionSlides.some(s=>s.visual===visual));
});

test('all 32 admin slides retain embedded Inter while only loading their layout styles',async()=>{
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
   if(slide.visual.startsWith('git-intro-')&&!['git-intro-ai-antigravity','git-intro-ai-codex','git-intro-ai-claude'].includes(slide.visual))assert.ok(css.includes('.gitIntroSlide .copyControl'));
   assert.equal(doc.querySelector('.eiu')?.style.boxShadow||'','');
  }finally{await window.happyDOM.close();}
 }
});

test('setup slide builds copyable PowerShell identity commands from user inputs and retains them across steps',async()=>{
 const window=render(7),doc=window.document;
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

test('publishing slide validates the GitHub URL, updates commands and copies a snapshot of the entered repository',async()=>{
 const window=renderDisplay(sectionSlides.find(s=>s.visual==='git-intro-publish').number),doc=window.document;
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
