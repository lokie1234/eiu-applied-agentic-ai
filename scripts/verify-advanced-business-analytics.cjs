const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {browserOptions,createOfflinePlayer}=require('./lib/offline-player-qa.cjs');
const folder='course-content/advanced-business-analytics';
const salesFiles=JSON.parse(fs.readFileSync('components/section1/salesDashboardEmergencyData.ts','utf8').match(/export const SALES_DASHBOARD_FILES = (\[[\s\S]*\]) as const;/)[1]);
const fileText=(slide,name)=>slide.fileSet==='sales-dashboard'?salesFiles.find(f=>f.name===name).code:fs.readFileSync(`${folder}/try-app/${name}`,'utf8');
const storyboard=JSON.parse(fs.readFileSync(`${folder}/storyboard.json`,'utf8'));
function entries(section){const all=[];function visit(slide,page,buttons=[]){all.push({slide,page,buttons});if(slide.limitations)visit(slide.limitations,page,[...buttons,'What are the limitations?']);if(slide.practice?.hint)visit({kind:'prompt-definition',title:'You should use this prompt:'},page,[...buttons,'Hint']);if(slide.caution)visit(slide.caution,page,[...buttons,'Caution']);if(slide.definition){const title=slide.definitionTitle||'What is a prompt?';visit({kind:'prompt-definition',title},page,[...buttons,title]);}if(slide.kind==='split-overview'){slide.items[0].content.items.forEach(item=>visit(item.content,page,[item.label]));for(const p of slide.items[1].content.platforms)visit({kind:'plugins',title:p.name+' integrations',platforms:[p]},page,[p.name+' integrations']);}else if(['hub','history'].includes(slide.kind))slide.items.forEach(item=>visit(item.content,page,[...buttons,item.label]));}section.slides.forEach((s,i)=>visit(s,i+1));return all;}

async function main(){
 const out=path.resolve('.tmp/advanced-business-analytics-qa');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch(browserOptions()),report=[];
 try{
  for(const [width,height] of [[960,540],[1280,720],[1428,804],[1920,1080]])for(const section of storyboard.sections){
   const context=await browser.newContext({viewport:{width,height},offline:true,acceptDownloads:true,reducedMotion:'reduce'});
   try{
    const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
    const player=await createOfflinePlayer(page,fs.readFileSync(`${folder}/${section.file}`,'utf8')),frame=player.frame;
    if(width===1920){await page.evaluate(()=>{const b=document.createElement('button');b.textContent='Enter lesson fullscreen';b.style.cssText='position:fixed;top:8px;right:8px;z-index:999';b.onclick=()=>{void document.documentElement.requestFullscreen();b.remove();};document.body.append(b);});await page.getByRole('button',{name:'Enter lesson fullscreen'}).click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));}
    assert.equal(player.total,section.slides.length);
    async function closeTopics(){while(await frame.locator('.topicOverlay').count())await frame.locator('.topicOverlay').last().getByRole('button',{name:'Close topic',exact:true}).click();}
    async function open(entry){await closeTopics();await player.show(entry.page);for(const name of entry.buttons)await frame.getByRole('button',{name,exact:true}).last().click();}
    async function assertBounds(label){await frame.waitForFunction(()=>[...document.querySelectorAll('.officialToolIcon')].every(img=>img.complete&&img.naturalWidth>0));const problems=await frame.evaluate(()=>{
     const canvas=document.querySelector('.aba-canvas'),panes=[...canvas.querySelectorAll('.topicOverlay,.objectivesOverlay')],scope=panes.at(-1)||canvas,area=scope.getBoundingClientRect(),body=scope.querySelector(':scope > .body'),bad=[];
     if(body&&body.scrollHeight>body.clientHeight+2)bad.push(`body overflows ${body.scrollHeight-body.clientHeight}px`);
     if(canvas.querySelector('footer,.foot,.note,.label'))bad.push('redundant annotation or footer');
     if(/MIS 311 · Advanced Business Analytics ·/.test(canvas.innerText))bad.push('course footer remains');
     for(const node of scope.querySelectorAll('h1,h2,h3,p,li,td,th,button,label,textarea,select,.barRow,.componentDetail,.historyMarket,.historyIdentity,.keepPhrase,.titleLine,.officialToolIcon')){
      if(node.closest('.codePanel')||node.getBoundingClientRect().width===0)continue;
      const b=node.getBoundingClientRect();if(b.left<area.left-2||b.top<area.top-2||b.right>area.right+2||b.bottom>area.bottom+2)bad.push(`${node.tagName} outside content: ${node.textContent.slice(0,70)}`);
     }
     for(const image of scope.querySelectorAll('.officialToolIcon'))if(!image.complete||!image.naturalWidth||!image.src.startsWith('data:image/'))bad.push('official icon is missing or depends on the network');
     for(const name of scope.querySelectorAll('.toolName'))if(!name.querySelector('.officialToolIcon'))bad.push('tool name has no official icon');
     for(const heading of scope.querySelectorAll('h1')){const tools=[...heading.querySelectorAll('[data-tool]')].map(n=>n.dataset.tool);if(new Set(tools).size!==tools.length)bad.push('duplicate tool logo in heading');}
     // A slide can fit the canvas while its own grid cells still overlap.
     for(const step of scope.querySelectorAll('.step')){
      const cells=[...step.children].map(n=>({name:n.className||n.tagName,r:n.getBoundingClientRect()})),box=step.getBoundingClientRect();
      for(const cell of cells)if(cell.r.left<box.left-1||cell.r.right>box.right+1||cell.r.top<box.top-1||cell.r.bottom>box.bottom+1)bad.push(`workflow cell escapes card: ${cell.name}`);
      for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){const a=cells[i].r,b=cells[j].r;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)bad.push(`workflow cells overlap: ${cells[i].name}/${cells[j].name}`);}
     }
     for(const panel of scope.querySelectorAll('.goodPromptPanel,.goodPromptStage,.academicEmail,.cautionWarning,.useCaseCard,.gasFlow,.gasFlowSteps,.gasFlowStep,.gasFlowStep>div,.skillSetupStep,.skillExample')){
      const area=panel.getBoundingClientRect(),boxes=[...panel.children].map(n=>n.getBoundingClientRect());
      for(const box of boxes)if(box.top<area.top-1||box.bottom>area.bottom+1)bad.push('good prompt content escapes its panel');
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)bad.push('good prompt blocks overlap');}
     }
     const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
     while(walker.nextNode()){
      const text=walker.currentNode,parent=text.parentElement;if(!text.textContent.trim()||parent.closest('.codePanel,[hidden]')||!parent.getClientRects().length)continue;
      const range=document.createRange();range.selectNodeContents(text);
      for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<area.left-2||r.right>area.right+2||r.top<area.top-2||r.bottom>area.bottom+2))bad.push(`text escapes content: ${text.textContent.slice(0,60)}`);
     }
     const pages=[...document.querySelectorAll('[data-mis311-page],.eiu-number')].filter(n=>getComputedStyle(n).display!=='none');if(pages.length!==1)bad.push('duplicate/missing page number');
     return bad;
    });if(problems.length)await page.screenshot({path:path.join(out,'failure-current.png')});assert.deepEqual(problems,[],`${section.file} ${label} ${width}`);}
    const topics=entries(section);
    for(const template of [true,false]){
     await page.evaluate(enabled=>window.port.postMessage({type:'template',enabled}),template);
     for(const [index,entry]of topics.entries()){
      await open(entry);await frame.waitForFunction(()=>document.querySelector('.aba-canvas')?.style.transform);
      await assertBounds(entry.slide.title);
      if(entry.slide.kind==='ai-tool'){assert.equal(await frame.locator('.aiToolBrand').getAttribute('href'),entry.slide.url);assert.equal(await frame.locator('.aiToolPreview').getAttribute('href'),entry.slide.url);assert.match(await frame.locator('.aiToolVisit').getAttribute('rel'),/noopener/);assert.ok((await frame.locator('.aiToolInterface').getAttribute('src')).startsWith('data:image/webp;base64,'));assert.equal(await frame.locator('.aiToolInterface').evaluate(n=>getComputedStyle(n).objectFit),'contain');assert.equal(await frame.locator('.aiToolCaption,.aiToolExample').count(),0);if(width===1280&&template)await page.screenshot({path:path.join(out,entry.slide.icon+'-slide.png')});}
      if(entry.slide.kind==='annotated-prompt'){const toggle=frame.locator('.annotationActions button');if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();assert.equal(await frame.locator('.componentLabel:visible').count(),0);await toggle.click();assert.equal(await frame.locator('.componentLabel:visible').count(),5);await assertBounds('identified prompt components');assert.equal(await frame.locator('.sampleComponentLabel').first().evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');const overlap=await frame.evaluate(()=>{const labels=[...document.querySelectorAll('.sampleComponentLabel')].map(n=>n.getBoundingClientRect()),text=[];for(const p of document.querySelectorAll('.samplePromptBoard p')){const range=document.createRange();range.selectNodeContents(p);text.push(...range.getClientRects());}return labels.some(a=>text.some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));});assert.equal(overlap,false,'annotation badges do not cover prompt text');}
      if(entry.slide.kind==='leave-compare'){const previous=frame.getByRole('button',{name:'Previous part'});while(await previous.isEnabled())await previous.click();for(let i=0;i<entry.slide.pages.length;i++){await assertBounds('good prompt part '+i);if(i<entry.slide.pages.length-1)await frame.getByRole('button',{name:'Next part'}).click();}assert.equal(await frame.getByRole('link',{name:'Open bad-prompt app'}).getAttribute('href'),entry.slide.badUrl);assert.equal(await frame.getByRole('link',{name:'Open good-prompt app'}).getAttribute('href'),entry.slide.goodUrl);assert.equal(await frame.locator('.leaveDemo img').count(),2);}
      if(entry.slide.kind==='use-cases'){assert.equal(await frame.locator('.useCaseCard').count(),entry.slide.items.length);}
      if(entry.slide.layout==='custom-ai'){
       assert.equal(await frame.locator('.customAISummary').count(),0);
       assert.equal(await frame.locator('.customAIHub .hubButton').count(),4);
       for(let i=0;i<3;i++)assert.equal(await frame.locator('.customAIHub .hubButton').nth(i).locator('[data-tool]').getAttribute('data-tool'),entry.slide.items[i].content.tools[0]);
       assert.equal(await frame.evaluate(()=>{const a=[...document.querySelectorAll('.customAIHub .hubTitle,.customAISummary,.customAIHub .hubButton')].map(n=>n.getBoundingClientRect());return a.some((x,i)=>a.slice(i+1).some(y=>Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1));}),false,'custom AI definition and brand controls do not overlap');
      }
      if(entry.slide.kind==='skill-setup'){assert.equal(await frame.locator('.skillSetupStep').count(),3);assert.equal(await frame.locator('.skillExample,.skillAvailability,.skillSources').count(),0);}
      if(entry.slide.kind==='skill-demo'){
       assert.equal(await frame.locator('.skillDemoCard').count(),3);assert.equal(await frame.locator('.skillDemoIntro').textContent(),entry.slide.intro);
       const waiting=page.waitForEvent('download');await frame.getByRole('button',{name:'Download SKILL.md',exact:true}).click();const file=await waiting;assert.equal(file.suggestedFilename(),'SKILL.md');assert.deepEqual(fs.readFileSync(await file.path()),fs.readFileSync(`${folder}/skill-examples/calorie-planner/SKILL.md`),'download preserves the user file bytes');
       assert.equal(await frame.locator('.skillDemo input,.skillDemo iframe,.skillDemo script').count(),0,'the example downloads a skill without executing its instructions');
      }
      if(entry.slide.kind==='discussion-question'){const dialog=frame.getByRole('dialog',{name:entry.slide.title,exact:true});assert.equal(await dialog.getByRole('heading').count(),1);assert.equal(await dialog.getByRole('heading').textContent(),'What are the limitations?');assert.equal(await dialog.locator('p,a,.salesLimitCard').count(),0);}
      if(entry.slide.kind==='try-code'){assert.equal(await frame.locator('.tryIntro').count(),0);if(entry.slide.limitations){assert.equal(await frame.locator('.tryIntro').count(),0);assert.equal(await frame.getByRole('button',{name:'What are the limitations?',exact:true}).count(),1);assert.equal(await frame.locator('.salesLimitLabel').count(),0);assert.ok(await frame.locator('.salesLimitMark').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=90));assert.ok(await frame.locator('.tryCodeFile').first().evaluate(n=>n.getBoundingClientRect().height/n.closest('.body').getBoundingClientRect().height<.3),'sales copy cards stay compact');}
       assert.equal(await frame.locator('.tryCodeFile').count(),entry.slide.files.length);assert.equal(await frame.locator('.tryCode script,.tryCode iframe,.tryCode form').count(),0,'attached code is never rendered as executable HTML');
       if(entry.slide.download){const waiting=page.waitForEvent('download');await frame.getByRole('button',{name:'Download Sale data (.xlsx)',exact:true}).click();const file=await waiting;assert.equal(file.suggestedFilename(),'Sales-Data-2025.xlsx');assert.deepEqual(fs.readFileSync(await file.path()),fs.readFileSync('public/downloads/Sales-Data-2025.xlsx'),'download preserves original workbook bytes');}assert.equal(await frame.getByRole('link',{name:'Google Apps Script',exact:true}).getAttribute('href'),entry.slide.url);
       await frame.evaluate(()=>{window._tryNativeCopy=document.execCommand;window._tryCopies=[];document.execCommand=function(command,...args){const text=document.activeElement?.value,ok=window._tryNativeCopy.call(document,command,...args);window._tryCopies.push({text,ok});return ok;};});
       for(const name of entry.slide.files){const trigger=frame.getByRole('button',{name:'Copy '+name,exact:true});await trigger.click();assert.equal(await trigger.getAttribute('data-copied'),'true','native opaque-frame copy succeeded');const record=await frame.evaluate(()=>window._tryCopies.at(-1));assert.equal(record.ok,true);assert.equal(record.text,fileText(entry.slide,name).replace(/\r\n?/g,'\n'));assert.equal(await frame.locator('.tryCopyStatus').textContent(),name+' copied');assert.ok(await trigger.evaluate(n=>n===document.activeElement));await assertBounds('Copied '+name);}
       await closeTopics();await open(entry);assert.equal(await frame.locator('.tryCodeFile[data-copied=true]').count(),entry.slide.files.length,'copy indicators survive reopening');
       if(width===1280&&template){
        await frame.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(text){window._tryAsyncText=text;return Promise.resolve();}}});});
        await frame.getByRole('button',{name:'Copy Index.html',exact:true}).click();assert.equal(await frame.evaluate(()=>window._tryAsyncText),fileText(entry.slide,'Index.html'));
        await frame.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(Error('Clipboard denied'));document.execCommand=()=>false;});await frame.getByRole('button',{name:'Copy Code.gs',exact:true}).click();const manual=frame.getByRole('textbox',{name:'Text to copy',exact:true});await manual.waitFor();assert.equal(await frame.getByRole('button',{name:'Copy Code.gs',exact:true}).getAttribute('data-copied'),'false','denied copy never claims success');assert.equal(await manual.inputValue(),fileText(entry.slide,'Code.gs').replace(/\r\n?/g,'\n'));
        await manual.press('Escape');await open(entry);await frame.evaluate(()=>{delete navigator.clipboard;document.execCommand=window._tryNativeCopy;});await frame.getByRole('button',{name:'Copy Code.gs',exact:true}).click();assert.equal(await frame.getByRole('button',{name:'Copy Code.gs',exact:true}).getAttribute('data-copied'),'true','retry succeeds after permission failure');
       }
       await frame.evaluate(()=>{delete navigator.clipboard;document.execCommand=window._tryNativeCopy;});
      }
      if(entry.slide.kind==='ai-caution'){assert.match(await frame.locator('.academicEmail').innerText(),/Subject:|Dear Dr. Nguyen|Best wishes/);assert.equal(await frame.locator('.emailLeftover').textContent(),entry.slide.leftover);}
      if(entry.slide.kind==='columns'){for(const trigger of await frame.locator('.columnReveal').all())if(await trigger.getAttribute('aria-expanded')==='false')await trigger.click();await assertBounds(entry.slide.title+' revealed');}
      if(entry.slide.kind==='workflow'){const previous=frame.getByRole('button',{name:'Previous step',exact:true});while(await previous.isEnabled())await previous.click();await assertBounds(entry.slide.title+' first step');for(let i=1;i<entry.slide.items.length;i++){await frame.getByRole('button',{name:'Next step',exact:true}).click();await assertBounds(entry.slide.title+' step '+(i+1));}await frame.getByRole('button',{name:'Overview',exact:true}).click();await assertBounds(entry.slide.title+' overview');await frame.getByRole('button',{name:'Overview',exact:true}).click();}
      if(entry.slide.kind==='history'){assert.equal(await frame.locator('.historyCard').count(),6);assert.equal(await frame.locator('.historyGroupTitle,.historyExplore,.historyDate').count(),0);assert.equal(await frame.locator('.topicOverlay > .sub').count(),0);assert.equal(await frame.locator('.historyGroup').count(),2);assert.equal(await frame.getByRole('region',{name:'Local models'}).locator('.historyCard').count(),3);}
      if(entry.slide.kind==='plugins'){assert.equal(await frame.locator('.pluginLinks').count(),0);assert.equal(await frame.locator('.pluginExamples>div').count(),entry.slide.platforms.length*3);assert.equal(await frame.locator('.pluginPlatform').count(),entry.slide.platforms.length);assert.equal(await frame.locator('.pluginExamples dt').count(),entry.slide.platforms.length*3);assert.equal(await frame.locator('.pluginExamples dt img').count(),entry.slide.platforms.length*3);if(entry.slide.title.startsWith('ChatGPT')){await page.emulateMedia({colorScheme:'dark'});assert.equal(await frame.locator('.pluginPlatform>header [data-tool=chatgpt]').evaluate(n=>getComputedStyle(n).colorScheme),'light');await page.emulateMedia({colorScheme:'light'});}}
      if(entry.slide.kind==='cover'){assert.doesNotMatch(await frame.locator('.cover').innerText(),/[\u00c2\u00c3]/);assert.equal(await frame.locator('.cover .subtitle').count(),0);assert.equal(await frame.getByRole('button',{name:/Download starter ZIP|Download sample CSV/}).count(),0);}
      if(entry.slide.kind==='evidence'){
       for(let i=0;i<entry.slide.views.length;i++){
        const view=entry.slide.views[i],tabs=frame.locator('.evidenceTabs button');await tabs.nth(i).click();await assertBounds(view.title);
        assert.equal(await frame.locator('.evidence .barRow').count(),view.rows.length);assert.equal(await tabs.nth(i).getAttribute('aria-pressed'),'true');
        assert.deepEqual(await frame.locator('.evidence .barRow strong').allTextContents(),view.rows.map(r=>r[1]+'%'));
        assert.equal(await frame.locator('.evidence .insight').count(),0);
        assert.equal(await frame.locator('.evidenceSummary p,.evidenceCaveat').count(),0,'references and comparison notes stay out of the chart layout');
        assert.ok(await frame.locator('.evidence .chart').evaluate(n=>n.getBoundingClientRect().width/n.closest('.body').getBoundingClientRect().width>.97),'chart fills the available width');
        if(view.icon)assert.equal(await frame.locator('.evidenceSummary [data-tool]').getAttribute('data-tool'),view.icon);
        const source=frame.getByRole('button',{name:'Source',exact:true});await source.click();const dialog=frame.getByRole('dialog',{name:'Source: '+view.label,exact:true});await assertBounds('Source: '+view.label);
        assert.equal(await dialog.getByRole('link',{name:'Open original source'}).getAttribute('href'),view.source.url);assert.equal(await dialog.locator('.evidenceStudy').textContent(),view.source.detail);
        const close=dialog.getByRole('button',{name:'Close source'});await close.press('Shift+Tab');assert.ok(await dialog.getByRole('link').evaluate(n=>n===document.activeElement),'source focus stays within the dialog');await close.focus();await close.press('Escape');await dialog.waitFor({state:'detached'});assert.ok(await source.evaluate(n=>n===document.activeElement),'source closes back to its trigger');assert.equal(await frame.locator('.evidencePlot').getAttribute('data-view'),String(i));
        if(width===1280&&template)await page.screenshot({path:path.join(out,`section2-${entry.slide.title.replace(/\W+/g,'-')}-${i}.png`)});
       }
       await closeTopics();await open(entry);assert.equal(await frame.locator('.evidencePlot').getAttribute('data-view'),String(entry.slide.views.length-1),'selected perspective survives a revisit');
      }
      if(entry.slide.kind==='split-overview'){assert.equal(await frame.locator('.aiModelHalf .historyCard').count(),6);assert.equal(await frame.locator('.aiPluginHalf .floatingPlugin').count(),3);assert.equal(await frame.getByRole('button',{name:'A short history',exact:true}).count(),0);}
      if(entry.slide.title.startsWith('OpenAI')||entry.slide.title.startsWith('ChatGPT')){assert.ok(await frame.locator('.slideHeader h1').last().evaluate(h=>{const t=h.querySelector('.headingText'),i=h.querySelector('.headingIcons');if(!t||!i||t.querySelector('.toolName'))return false;const a=t.getBoundingClientRect(),b=i.getBoundingClientRect();return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<1;}),'brand headings share one centered text line and icon');}
      if(entry.slide.kind==='history-detail'){assert.equal(await frame.locator('.historyEvents li').count(),4);assert.ok(await frame.locator('.historyMarket').textContent());}
      if(width===1280&&template)await page.screenshot({path:path.join(out,`${section.file}-topic-${index+1}.png`)});
      assert.equal(await frame.locator('.infoTrigger,.sourceOverlay').count(),0,'source popups removed');
     }
    }
    for(const template of [true,false]){
     await page.evaluate(enabled=>window.port.postMessage({type:'template',enabled}),template);
     await open(topics[0]);const trigger=frame.getByRole('button',{name:'Learning objectives',exact:true});await trigger.click();
     const dialog=frame.getByRole('dialog',{name:'Learning objectives',exact:true});assert.equal(await dialog.locator('li').count(),section.objectives.length);
     for(const [number,text] of section.objectives)assert.ok((await dialog.textContent()).includes(number)&& (await dialog.textContent()).includes(text));
     await assertBounds('Learning objectives');
     if(width===1280&&template)await page.screenshot({path:path.join(out,`${section.file}-objectives.png`)});
     const close=dialog.getByRole('button',{name:'Close Learning objectives',exact:true});await close.press('Tab');assert.ok(await close.evaluate(n=>n===document.activeElement),'focus stays inside objectives');await close.press('Escape');assert.ok(await trigger.evaluate(n=>n===document.activeElement),'focus returns to trigger');
    }
    const find=kind=>topics.find(e=>e.slide.kind===kind);
    const annotated=find('annotated-prompt');if(annotated){await open(annotated);assert.equal(await frame.locator('.annotatedPrompt').getAttribute('data-revealed'),'true');await closeTopics();await open(annotated);assert.equal(await frame.locator('.annotatedPrompt').getAttribute('data-revealed'),'true','component identification survives revisit');}
    const history=topics.find(e=>e.slide.kind==='history-detail');if(history){await open(history);await frame.getByRole('button',{name:'Close topic',exact:true}).last().press('Escape');assert.ok(await frame.getByRole('button',{name:history.slide.company,exact:true}).evaluate(n=>n===document.activeElement),'history closes to its own icon');await closeTopics();}
    // Escape dismisses only one layer, retaining the parent topic menu.
    const nested=topics.find(e=>e.buttons.length===2);if(nested){await open(nested);await frame.getByRole('button',{name:'Close topic',exact:true}).last().press('Escape');assert.equal(await frame.locator('.topicOverlay').count(),1);}
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);report.push({section:section.file,width,height,slides:player.total,topics:topics.length,templateModes:2,errors,network});console.log(`${section.file}: ${width}×${height}, ${topics.length} topic views, dialogs, cache and local interactions passed`);
   }finally{await context.close();}
  }

  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
