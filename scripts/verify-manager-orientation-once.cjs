const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {browserOptions,createOfflinePlayer}=require('./lib/offline-player-qa.cjs');
const code=fs.readFileSync('course-content/ai-for-managers/reuploaded/section1.js','utf8');
const out=path.resolve('.tmp/manager-orientation-once');fs.mkdirSync(out,{recursive:true});
async function complete(frame){await frame.locator('[data-orientation-phase="complete"]').waitFor();await frame.locator('[data-manager-orientation]').evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await frame.locator('[data-manager-orientation]').evaluate(el=>el.getAnimations({subtree:true}).length),0);}
async function main(){
 const browser=await chromium.launch(browserOptions());
 try{
  for(const reducedMotion of ['no-preference','reduce']){
   const context=await browser.newContext({viewport:{width:960,height:540},offline:true,reducedMotion}),page=await context.newPage();
   const {frame,show}=await createOfflinePlayer(page,code);await show(3);
   if(reducedMotion==='no-preference'){
    await frame.locator('[data-orientation-phase="playing"]').waitFor();
    const finite=await frame.locator('[data-manager-orientation]').evaluate(el=>el.getAnimations({subtree:true}).map(a=>a.effect.getTiming().iterations));assert(finite.length>0);assert(finite.every(n=>n===1));
   }
   await complete(frame);
   const type=await frame.locator('[data-practical-goal]').evaluate(el=>({need:getComputedStyle(el.querySelector('p')).fontSize,title:getComputedStyle(el.querySelector('h2')).fontSize,overflow:el.scrollHeight-el.clientHeight}));assert.equal(type.need,type.title);assert.equal(type.need,'28px');assert(type.overflow<=1);
   await show(4);await show(3);await complete(frame);
   for(let n=8;n<=15;n++)await show(n);await show(3);await complete(frame);
   await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,`orientation-${reducedMotion}.png`)});
   await context.close();
  }
  // Interrupt the first run, then revisit the cached root before it completes.
  const context=await browser.newContext({viewport:{width:960,height:540},offline:true,reducedMotion:'no-preference'}),page=await context.newPage();
  const offline=await createOfflinePlayer(page,code);await offline.show(3);await offline.frame.locator('[data-orientation-phase="playing"]').waitFor();await offline.show(4);await offline.show(3);await complete(offline.frame);await context.close();
  // Actual web document + actual parent hook/store, with iframe recreation.
  const docModule={exports:{}};new Function('module','exports',esbuild.transformSync(fs.readFileSync('lib/tsxDocument.ts','utf8'),{loader:'ts',format:'cjs'}).code)(docModule,docModule.exports);
  const id='98694749-2879-46e2-82bd-03fd27f23c5e';
  const docs=Object.fromEntries([3,4].map(n=>[n,docModule.exports.createTsxDocument(code,n,'','',`${id}:${n}`)]));
  const result=await esbuild.build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React,{useRef,useState} from 'react';import{createRoot}from'react-dom/client';import{useLessonRevealBridge}from'./components/deck/useLessonRevealBridge';import{clearLessonRevealState}from'./lib/lessonRevealState';const docs=${JSON.stringify(docs).replace(/</g,'\\u003c')};const id=${JSON.stringify(id)};function Host(){const frame=useRef(null),[page,setPage]=useState(3);useLessonRevealBridge(id,frame);return <><iframe key={page} name="web" ref={frame} data-request-id={id+':'+page} sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox" srcDoc={docs[page]}/><nav><button onClick={()=>setPage(4)}>Next</button><button onClick={()=>setPage(3)}>Back</button><button onClick={()=>clearLessonRevealState(id)}>End</button></nav></>;}function App(){const[v,setV]=useState(0);return <><Host key={v}/><button onClick={()=>setV(v+1)}>New visit</button></>;}createRoot(document.getElementById('app')).render(<App/>);`},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},minify:true});
  const html=`<style>html,body{margin:0}iframe{display:block;width:960px;height:540px;border:0}</style><div id="app"></div><script>${result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`;
  const webContext=await browser.newContext({viewport:{width:960,height:620},offline:true,reducedMotion:'no-preference'}),web=await webContext.newPage();
  await web.route('http://localhost:33119/',route=>route.fulfill({contentType:'text/html',body:html}));await web.goto('http://localhost:33119/');
  let frame=web.frame({name:'web'});await web.frameLocator('iframe').locator('[data-orientation-phase="playing"]').waitFor();
  await web.getByRole('button',{name:'Next',exact:true}).click();await web.getByRole('button',{name:'Back',exact:true}).click();await complete(web.frameLocator('iframe'));
  await web.getByRole('button',{name:'New visit',exact:true}).click();await web.frameLocator('iframe').locator('[data-orientation-phase="playing"]').waitFor();await complete(web.frameLocator('iframe'));
  await web.getByRole('button',{name:'Next',exact:true}).click();await web.getByRole('button',{name:'Back',exact:true}).click();await complete(web.frameLocator('iframe'));
  await web.getByRole('button',{name:'End',exact:true}).click();await web.frameLocator('iframe').getByText('This section session has ended.').waitFor();
  await web.getByRole('button',{name:'New visit',exact:true}).click();await web.frameLocator('iframe').locator('[data-orientation-phase="playing"]').waitFor();
  await webContext.close();
  console.log('Orientation: one finite run, equal 28px goals, cached/evicted/interrupted revisits stay static; recreated website frames, new visits, termination and reduced motion passed.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
