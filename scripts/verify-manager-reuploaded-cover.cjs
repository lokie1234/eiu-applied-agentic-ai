const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {browserOptions,createOfflinePlayer}=require('./lib/offline-player-qa.cjs');
async function main(){
 const browser=await chromium.launch(browserOptions()),out=path.resolve('.tmp/manager-reuploaded-cover-qa');fs.mkdirSync(out,{recursive:true});
 const code=fs.readFileSync('course-content/ai-for-managers/reuploaded/section1.js','utf8');
 try{for(const [width,height]of [[960,540],[1280,720],[1428,804],[1920,1080]])for(const template of [undefined,'']){
  const context=await browser.newContext({viewport:{width,height},offline:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const {frame,show,total}=await createOfflinePlayer(page,code,template);assert.equal(total,39);
  if(width===1920){await page.evaluate(()=>{const b=document.createElement('button');b.textContent='Fullscreen QA';b.style='position:fixed;top:0;right:0';b.onclick=()=>{void document.documentElement.requestFullscreen();b.remove();};document.body.appendChild(b);});await page.getByText('Fullscreen QA').click();await page.waitForFunction(()=>!!document.fullscreenElement);}
  for(let n=1;n<=39;n++){
   await show(n);await frame.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1),false);
   if(n===3){
    await frame.locator('[data-practical-goal]').waitFor();
    const fit=await frame.evaluate(()=>{const card=document.querySelector('[data-practical-goal]'),bounds=card.getBoundingClientRect(),need=card.querySelector('p'),title=card.querySelector('h2'),a=need.getBoundingClientRect(),b=title.getBoundingClientRect();return{text:need.textContent,title:title.textContent,inside:a.left>=bounds.left&&a.right<=bounds.right&&a.top>=bounds.top&&b.bottom<=bounds.bottom-4,gap:b.top-a.bottom,scroll:card.scrollHeight-card.clientHeight};});
    assert.equal(fit.text,'Hiểu được nhu cầu thực tế');assert.equal(fit.title,'Thiết kế sản phẩm cùng AI');assert.equal(fit.inside,true);assert(fit.gap>=6);assert(fit.scroll<=1);
    if(width===960&&template===undefined){await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(out,'orientation.png')});}
   }
   if(n===1){
    await frame.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
    assert.equal(await frame.locator('h1').innerText(),'Applied Agentic AI\nfor Managers');assert.equal(await frame.locator('h2,p').count(),0);
    const layout=await frame.evaluate(()=>{const root=document.querySelector('[data-offline-canvas]'),box=root.getBoundingClientRect(),heading=root.querySelector('h1').getBoundingClientRect(),logo=root.querySelector('img').getBoundingClientRect();return{inside:heading.left>=box.left&&heading.right<=box.right&&heading.top>=box.top&&heading.bottom<=box.bottom,logo:logo.right<=box.right+1&&logo.top>=box.top-1,overlap:heading.left<logo.right&&heading.right>logo.left&&heading.top<logo.bottom&&heading.bottom>logo.top};});
    assert.equal(layout.inside,true);assert.equal(layout.logo,true);assert.equal(layout.overlap,false);
    const scene=await frame.evaluate(()=>{const art=document.querySelector('[data-manager-team]'),a=art.getBoundingClientRect(),heading=document.querySelector('h1').getBoundingClientRect(),logo=document.querySelector('img').getBoundingClientRect();return{employees:art.querySelectorAll('[data-team-employee]').length,manager:art.querySelectorAll('[data-team-manager]').length,inside:a.left>=0&&a.top>=0&&a.right<=innerWidth&&a.bottom<=innerHeight,overlapHeading:a.left<heading.right&&a.right>heading.left&&a.top<heading.bottom&&a.bottom>heading.top,overlapLogo:a.left<logo.right&&a.right>logo.left&&a.top<logo.bottom&&a.bottom>logo.top,animations:art.getAnimations({subtree:true}).length};});
    assert.equal(scene.employees,3);assert.equal(scene.manager,1);assert.equal(scene.inside,true);assert.equal(scene.overlapHeading,false);assert.equal(scene.overlapLogo,false);assert.equal(scene.animations,0,'reduced motion disables the team animation');
    const dock=await frame.evaluate(()=>{const root=document.querySelector('[data-offline-canvas]'),canvas=root.getBoundingClientRect(),deck=root.querySelector('[data-cover-tools]'),box=deck.getBoundingClientRect(),heading=root.querySelector('h1').getBoundingClientRect(),team=root.querySelector('[data-manager-team]').getBoundingClientRect();return{count:deck.querySelectorAll('[data-cover-tool]').length,base:deck.querySelectorAll('[data-cover-tool-base]').length,names:[...deck.querySelectorAll('[title]')].length,inside:box.left>=canvas.left&&box.right<=canvas.right&&box.bottom<=canvas.bottom,below:box.top>heading.bottom,clear:box.right<team.left,paleLayers:[...root.querySelectorAll('div')].filter(node=>getComputedStyle(node).backgroundImage.includes('110deg')).length};});
    assert.equal(dock.count,5);assert.equal(dock.base,0);assert.equal(dock.names,0);assert.equal(dock.inside,true);assert.equal(dock.below,true);assert.equal(dock.clear,true);assert.equal(dock.paleLayers,0);
    assert.equal(await frame.locator('[data-tool-circle]').count(),5);assert.equal(await frame.locator('[role="tooltip"]:visible').count(),0);
    if(width===960&&template===undefined)await page.screenshot({path:path.join(out,'cover.png')});
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  if(width===1920)await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});await context.close();
  console.log(`Reuploaded Manager: ${total} slides at ${width}x${height}, template ${template===undefined?'on':'off'} passed.`);
 }
 const context=await browser.newContext({viewport:{width:960,height:540},offline:true,reducedMotion:'no-preference'}),page=await context.newPage();
 const {frame,show}=await createOfflinePlayer(page,code);await show(1);
 await frame.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
 const motion=await frame.evaluate(()=>{const path=document.querySelector('[data-team-signals] path'),check=document.querySelector('[data-team-complete]'),flow=path.getAnimations()[0],complete=check.getAnimations()[0];if(!flow||!complete)return null;flow.pause();complete.pause();flow.currentTime=0;complete.currentTime=0;const before=[getComputedStyle(path).strokeDashoffset,getComputedStyle(check).opacity];flow.currentTime=2400;complete.currentTime=2400;return{before,after:[getComputedStyle(path).strokeDashoffset,getComputedStyle(check).opacity]};});
 assert(motion,'team animation runs without reduced motion');assert.notEqual(motion.before[0],motion.after[0]);assert.notEqual(motion.before[1],motion.after[1]);
 for(const key of ['apps-script','sheets','gemini','chatgpt','claude']){
  const icon=frame.locator(`[data-cover-tool="${key}"]`);await icon.hover();
  await frame.waitForFunction(key=>document.querySelector(`[data-cover-tool="${key}"] img`).getAnimations().length>0,key);
  assert.equal(await icon.locator('[title]').count(),0);await icon.getByRole('tooltip').waitFor({state:'visible'});
  assert.equal(await icon.getByRole('tooltip').locator('strong').innerText(),await icon.getAttribute('aria-label'));
  const tooltipBounds=await icon.getByRole('tooltip').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;});assert.equal(tooltipBounds,true);
  const changes=await icon.locator('img').evaluate(async image=>{const a=image.getAnimations().find(animation=>animation instanceof CSSAnimation);if(!a)return null;a.pause();a.currentTime=0;await new Promise(requestAnimationFrame);const before=getComputedStyle(image).transform;a.currentTime=700;await new Promise(requestAnimationFrame);return{before,after:getComputedStyle(image).transform};});assert(changes,`${key} has a hover animation`);assert.notEqual(changes.before,changes.after,`${key} changes position on hover`);
 }
 await page.mouse.move(20,20);
 await frame.locator('[data-cover-tool="apps-script"]').focus();await frame.waitForFunction(()=>document.querySelector('[data-cover-tool="apps-script"] img').getAnimations().length>0);
 await frame.locator('[data-cover-tool="apps-script"] [role="tooltip"]').waitFor({state:'visible'});
 await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(out,'tool-dock-hover.png')});
 await page.screenshot({path:path.join(out,'team-animation.png')});await show(2);await show(1);assert.equal(await frame.locator('[data-team-employee]').count(),3);await context.close();
 console.log('Manager delegation paths and employee completion animate; reduced motion and cache navigation passed.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
