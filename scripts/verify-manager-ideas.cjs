const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{browserOptions,createOfflinePlayer}=require('./lib/offline-player-qa.cjs');
const ideas=require('../course-content/ai-for-managers/reuploaded/ideas-data.json');
const code=fs.readFileSync('course-content/ai-for-managers/reuploaded/section1.js','utf8');
async function fit(frame){
 const layout=await frame.evaluate(()=>{const root=document.querySelector('[data-manager-ideas]'),r=root.getBoundingClientRect(),dialog=root.querySelector('[role=dialog]'),nodes=dialog?[dialog,...dialog.querySelectorAll('button,h2,h3,footer,[data-idea-step]')]:[...root.querySelectorAll('[data-manager-idea]')],errors=[];
 for(const node of nodes){const b=node.getBoundingClientRect();if(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1)errors.push(node.textContent.slice(0,60));if(node.scrollHeight>node.clientHeight+2&&['hidden','auto','scroll','clip'].includes(getComputedStyle(node).overflowY))errors.push('clip:'+node.className);}
 if(dialog){const footer=dialog.querySelector('footer').getBoundingClientRect();for(const text of dialog.querySelectorAll('[data-idea-step] h3'))if(text.getBoundingClientRect().bottom>footer.top-4)errors.push('footer overlap');}
 return{errors,outer:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1};});assert.deepEqual(layout.errors,[]);assert.equal(layout.outer,false);
}
async function main(){
 const browser=await chromium.launch(browserOptions()),out=path.resolve('.tmp/manager-ideas-qa');fs.mkdirSync(out,{recursive:true});
 try{
  for(const [width,height]of [[960,540],[1280,720],[1428,804],[1920,1080]])for(const template of [undefined,'']){
   const context=await browser.newContext({viewport:{width,height},offline:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
   const {frame,show,total}=await createOfflinePlayer(page,code,template);assert.equal(total,39);
   if(width===1920){await page.evaluate(()=>{const b=document.createElement('button');b.textContent='Fullscreen QA';b.style='position:fixed;top:0;right:0';b.onclick=()=>{void document.documentElement.requestFullscreen();b.remove();};document.body.appendChild(b);});await page.getByText('Fullscreen QA').click();await page.waitForFunction(()=>!!document.fullscreenElement);}
   await show(4);await frame.locator('[data-manager-ideas]').waitFor();assert.equal(await frame.locator('[data-manager-idea]').count(),8);assert.equal(await frame.getByRole('heading',{level:1}).innerText(),'Một vài ý tưởng cho cấp quản lý');assert.equal(await frame.getByText('Đăng ký môn học',{exact:true}).count(),0);await fit(frame);
   assert.equal(await frame.getByText('Chọn một ý tưởng để khám phá quy trình',{exact:true}).count(),0);
   const centered=await frame.locator('[data-manager-idea]').evaluateAll(buttons=>buttons.every(button=>{const b=button.getBoundingClientRect(),icon=button.querySelector('[data-idea-tile-icon]').getBoundingClientRect(),label=button.querySelector('strong').getBoundingClientRect();return button.textContent.trim()===button.getAttribute('aria-label')&&Math.abs((icon.left+icon.right-b.left-b.right)/2)<1&&Math.abs((label.left+label.right-b.left-b.right)/2)<1;}));assert.equal(centered,true);
   if(width===960&&template===undefined){await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,'ideas.png')});}
   for(const idea of ideas){
    const button=frame.locator(`[data-manager-idea="${idea.id}"]`);assert.equal(await button.evaluate(el=>getComputedStyle(el).cursor),'pointer');await button.click();
    const dialog=frame.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getByRole('heading',{level:2}).innerText(),idea.title);assert.equal(await dialog.locator('[data-idea-title] small').count(),0);assert.equal(await dialog.getByRole('heading',{level:2}).evaluate(el=>getComputedStyle(el).fontSize),'30px');assert.equal(await dialog.locator('[data-idea-step]').count(),4);assert.equal(await dialog.locator('[data-idea-step] [data-idea-glyph]').count(),4);assert.deepEqual(await dialog.locator('[data-idea-step] h3').allTextContents(),idea.steps.map(s=>s.label));await fit(frame);
    if(width===960&&template===undefined){await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,idea.id+'.png')});}
    await dialog.getByRole('button',{name:'Đóng quy trình'}).press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await button.evaluate(el=>el===document.activeElement),true);
   }
   await frame.locator('[data-manager-idea="results"]').focus();await frame.locator('[data-manager-idea="results"]').press('Enter');await frame.getByRole('dialog').getByRole('button',{name:'Ý tưởng tiếp theo'}).click();assert.equal(await frame.locator('[data-idea-dialog]').getAttribute('data-idea-dialog'),'leave');await frame.getByRole('button',{name:'Ý tưởng trước'}).click();assert.equal(await frame.locator('[data-idea-dialog]').getAttribute('data-idea-dialog'),'results');
   await frame.getByRole('button',{name:'Ý tưởng tiếp theo'}).focus();await frame.getByRole('button',{name:'Ý tưởng tiếp theo'}).press('Tab');assert.equal(await frame.getByRole('button',{name:'Đóng quy trình'}).evaluate(el=>el===document.activeElement),true);
   await show(5);await show(4);await frame.getByRole('dialog').waitFor();await frame.getByRole('button',{name:'Đóng quy trình'}).click();
   assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);if(width===1920)await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});await context.close();
   console.log(`Manager ideas ${width}x${height}, template ${template===undefined?'on':'off'}: 8 accessible 3D buttons and 8 animated icon workflows fit.`);
  }
  const context=await browser.newContext({viewport:{width:960,height:540},offline:true,reducedMotion:'no-preference'}),page=await context.newPage();const {frame,show}=await createOfflinePlayer(page,code);await show(4);const button=frame.locator('[data-manager-idea="leave"]');await button.hover();await frame.waitForFunction(()=>getComputedStyle(document.querySelector('[data-manager-idea="leave"]')).transform!=='none');assert(await button.locator('svg').evaluate(el=>el.getAnimations().length)>0);await button.click();
  const motion=await frame.locator('[data-idea-step]').first().evaluate(el=>{const animations=el.getAnimations({subtree:true});return{count:animations.length,infinite:animations.some(a=>a.effect.getTiming().iterations===Infinity)};});assert(motion.count>0);assert.equal(motion.infinite,true);await frame.getByRole('button',{name:'Đóng quy trình'}).click();await show(5);await page.keyboard.press('Escape');assert.equal(await frame.getByRole('dialog').count(),0);await context.close();
  console.log('Hover motion, workflow animation, reduced motion, Escape/focus trap, topic navigation and cached-state cleanup passed.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
