const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {browserOptions,createOfflinePlayer}=require('./lib/offline-player-qa.cjs');
const folder='course-content/advanced-business-analytics';
const input=JSON.parse(fs.readFileSync(`${folder}/storyboard.json`,'utf8'));
function hubs(section){const all=[];function walk(s,page,buttons=[]){if(s.kind!=='hub')return;all.push({s,page,buttons});s.items.forEach(item=>walk(item.content,page,[...buttons,item.label]));}section.slides.forEach((s,i)=>walk(s,i+1));return all;}
async function main(){
 const browser=await chromium.launch(browserOptions()),out=path.resolve('.tmp/aba-motion-qa'),report=[];fs.mkdirSync(out,{recursive:true});
 try{
  for(const [width,height]of [[960,540],[1280,720],[1920,1080]])for(const section of input.sections){
   const context=await browser.newContext({viewport:{width,height},offline:true,reducedMotion:'no-preference'});
   try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const player=await createOfflinePlayer(page,fs.readFileSync(`${folder}/${section.file}`,'utf8')),frame=player.frame,basePage=section.slides.findIndex(s=>s.kind==='hub')+1;
    await player.show(basePage);await frame.waitForFunction(()=>document.querySelector('.hubButton')?.getAnimations().some(a=>a.playState==='running'));
    await page.screenshot({path:path.join(out,'motion-start.png')});
    const name=section.slides[basePage-1].items[0].label,trigger=frame.getByRole('button',{name,exact:true});
    const before=await trigger.evaluate(n=>n.getAnimations().find(a=>a.animationName?.startsWith('aba-drift')).currentTime);await page.waitForTimeout(150);const after=await trigger.evaluate(n=>n.getAnimations().find(a=>a.animationName?.startsWith('aba-drift')).currentTime);assert.ok(after>before,`drift advances over time (${before} to ${after})`);
    await trigger.hover({force:true});assert.equal(await trigger.evaluate(n=>getComputedStyle(n).animationPlayState),'paused','hover stabilizes the click target');
    await trigger.click();await frame.waitForFunction(()=>document.querySelector('.topicOverlay')?.getAnimations().some(a=>a.playState==='running'));
    assert.equal(await frame.evaluate(()=>document.querySelector('.aba-canvas > .body').inert),true,'underlying menu is unavailable while a dialog is open');
    assert.equal(await frame.evaluate(()=>[...document.querySelectorAll('.aba-canvas > .body .hubButton')].every(n=>getComputedStyle(n).animationPlayState==='paused')),true,'underlying drift pauses');
    await frame.waitForFunction(()=>document.querySelector('.topicOverlay')?.getAnimations().every(a=>a.playState!=='running'));
    if(await frame.locator('.columnReveal').count()){await frame.locator('.columnReveal').first().click();assert.equal(await frame.locator('.columnReveal').first().getAttribute('aria-expanded'),'true');}
    await frame.getByRole('button',{name:'Close topic',exact:true}).press('Escape');await frame.locator('.topicOverlay').waitFor({state:'detached'});
    assert.equal(await trigger.evaluate(n=>document.activeElement===n),true,'close restores focus to the original topic');
    if(section.slides[basePage-1].items[0].content.kind==='columns'){await trigger.click();assert.equal(await frame.locator('.columnReveal').first().getAttribute('aria-expanded'),'true','reopened disclosure retains its state');await frame.getByRole('button',{name:'Close topic',exact:true}).click();await frame.locator('.topicOverlay').waitFor({state:'detached'});}
    await frame.evaluate(()=>{window.previousMotionRoot=document.querySelector('eiu-aba-slide');});await player.show(basePage===2?3:2);
    assert.equal(await frame.evaluate(()=>!window.previousMotionRoot.isConnected&&window.previousMotionRoot.dataset.motionActive==='false'&&window.previousMotionRoot.getAnimations({subtree:true}).every(a=>a.playState!=='running')),true,'detached cached slides stop all effects');
    await player.show(basePage);await page.mouse.move(0,0);await frame.evaluate(()=>document.activeElement?.blur());
    await frame.waitForFunction(()=>document.querySelector('.hubButton')?.getAnimations().some(a=>a.playState==='running'));
    await frame.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await frame.evaluate(()=>document.querySelector('eiu-aba-slide').getAnimations({subtree:true}).every(a=>a.playState!=='running')),true,'hidden document pauses effects');
    await frame.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await frame.waitForFunction(()=>document.querySelector('.hubButton')?.getAnimations().some(a=>a.playState==='running'));
    async function close(){while(await frame.locator('.topicOverlay').count()){const pane=frame.locator('.topicOverlay').last();await pane.getByRole('button',{name:'Close topic',exact:true}).click();await pane.waitFor({state:'detached'});}}
    for(const [index,entry]of hubs(section).entries()){
     await close();await player.show(entry.page);
     for(const label of entry.buttons){const b=frame.getByRole('button',{name:label,exact:true}).last();await b.hover({force:true});await b.click();await frame.waitForFunction(()=>[...document.querySelectorAll('.topicOverlay')].at(-1)?.getAnimations().every(a=>a.playState!=='running'));}
     for(const phase of [0,.25,.5,.75]){
      const bad=await frame.evaluate(phase=>{
       const panels=[...document.querySelectorAll('.topicOverlay')],scope=panels.at(-1)||document.querySelector('.aba-canvas'),hub=scope.querySelector('.topicHub'),rect=hub.getBoundingClientRect();
       for(const animation of hub.getAnimations({subtree:true}).filter(a=>a.animationName?.startsWith('aba-drift'))){animation.pause();animation.currentTime=Number(animation.effect.getTiming().duration)*phase;}
       const nodes=[...hub.querySelectorAll(':scope > .hubButton,:scope > .hubTitle,:scope > .promptHelp,:scope > .cautionTrigger')],boxes=nodes.map(n=>({box:n.getBoundingClientRect(),name:n.textContent})),bad=[];
       for(const {box:b,name}of boxes)if(b.left<rect.left-1||b.right>rect.right+1||b.top<rect.top-1||b.bottom>rect.bottom+1)bad.push('Out of frame: '+name);
       for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i].box,b=boxes[j].box;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)bad.push('Overlap: '+boxes[i].name+' / '+boxes[j].name);}
       return bad;
      },phase);
      if(bad.length)await page.screenshot({path:path.join(out,'failure.png')});assert.deepEqual(bad,[],`${section.file} ${entry.s.title} ${width} phase=${phase}`);
     }
     if(width===1280)await page.screenshot({path:path.join(out,`${section.file}-hub-${index+1}.png`)});
    }
    await close();await player.show(basePage);await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await frame.evaluate(()=>document.querySelector('eiu-aba-slide').getAnimations({subtree:true}).some(a=>a.playState==='running')),false,'reduced motion disables drift');
    const first=frame.getByRole('button',{name,exact:true});await first.click();assert.equal(await frame.locator('.topicOverlay').evaluate(n=>n.getAnimations().length),0,'reduced motion skips dialog animation');await frame.getByRole('button',{name:'Close topic',exact:true}).click();assert.equal(await frame.locator('.topicOverlay').count(),0);
    assert.deepEqual(errors,[]);report.push({section:section.file,width,height,hubs:hubs(section).length,phases:4,lifecycle:true,reducedMotion:true});console.log(`${section.file} ${width}: drift phases, hover, modal transitions, cache/visibility suspension and reduced motion passed`);
   }finally{await context.close();}
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
