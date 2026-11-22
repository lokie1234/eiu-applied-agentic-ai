const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),esbuild=require('esbuild');
const {chromium}=require('playwright'),{browserOptions}=require('./lib/offline-player-qa.cjs');
async function main(){
 const out=path.resolve('.tmp/catalog-edit-qa');fs.mkdirSync(out,{recursive:true});
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Portal from './components/LessonPortal';
 const role=new URLSearchParams(location.search).get('role')||'admin';const course={id:'course',slug:'test',title:'Business Analytics',description:'Course description',languageLabel:'en',folderGroupId:'folder',folderGroupName:'AI Training',folderGroupDescription:'Folder description',sections:[{id:'section',sectionKey:'lesson',title:'Prompt design',description:'Section description',position:1,contentType:'tsx',slideCount:11,canFacilitate:role==='teacher'}]};
 window.renderCatalog=()=>createRoot(document.getElementById('app')).render(<Portal isAdmin={role==='admin'} canFacilitate={role==='teacher'} courseFolders={[course]} initialSection={null} initialProfile={null}/>);window.renderCatalog();`;
 await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},bundle:true,external:['/branding/*'],outfile:path.join(out,'app.js'),plugins:[{name:'fixture',setup(build){
  build.onResolve({filter:/^(next\/|@\/lib\/(realtime\/client|supabase\/browser|learningLanguage))|LivePresentation|PdfDeck|SectionTwoDeck|UploadedSectionDeck|LearningInnovationIcon|CourseDiscoveryHeading|useSectionSlideCounts/},args=>({path:args.path,namespace:'mock'}));
  build.onLoad({filter:/.*/,namespace:'mock'},args=>{let contents=`export default ()=>null;export const LiveSectionControl=()=>null,LiveController=()=>null,LiveFollower=()=>null;`;
   if(args.path==='next/navigation')contents=`export const useRouter=()=>({refresh(){window.catalogRefreshes=(window.catalogRefreshes||0)+1;},replace(){},push(){}});`;
   if(args.path==='next/dynamic')contents=`export default ()=>()=>null;`;
   if(args.path==='next/image'||args.path==='next/link')contents=`import React from 'react';export default props=>React.createElement('${args.path==='next/link'?'a':'img'}',props,props.children);`;
   if(args.path.includes('learningLanguage'))contents=`export const useLearningLanguage=()=>({t:x=>x,language:'en',setLanguage(){}});`;
   if(args.path.includes('supabase/browser'))contents=`export const getSupabaseBrowserClient=()=>null;`;
   if(args.path.includes('useSectionSlideCounts'))contents=`export const useSectionSlideCounts=()=>({section:11});`;
   if(args.path.includes('realtime/client'))contents=`export const useCourseRealtime=()=>false,realtimeReady=()=>false,pulsePresence=async()=>false,listenInteractive=()=>()=>{},watchRealtimeReady=()=>()=>{};`;
   return {contents,resolveDir:process.cwd()};});
  build.onResolve({filter:/^@\//},args=>{const stem=path.resolve(args.path.replace('@/',''));for(const ext of ['.ts','.tsx','.json'])if(fs.existsSync(stem+ext))return{path:stem+ext};});
 }}]});
 const server=http.createServer((req,res)=>{const file=req.url.split('?')[0];if(file==='/app.js'||file==='/app.css'){res.setHeader('Content-Type',file.endsWith('js')?'text/javascript':'text/css');return res.end(fs.readFileSync(path.join(out,file.slice(1))));}if(file.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({success:true,items:[],counts:{},online:0}));}res.setHeader('Content-Type','text/html');res.end('<html><head><link rel="stylesheet" href="/app.css"></head><body style="margin:0"><div id="app"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch(browserOptions());
 try{for(const width of [390,960,1280])for(const role of ['admin','teacher','learner']){
  const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage(),errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));let fail=true;
  await page.route('**/api/admin/catalog',async route=>{writes.push(route.request().postDataJSON());await new Promise(resolve=>setTimeout(resolve,200));return route.fulfill({status:fail?500:200,json:fail?{message:'Database unavailable. Try again.'}:{success:true,item:writes.at(-1)}});});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?role='+role);
  await page.getByRole('button',{name:/Open sections for/}).waitFor();
  if(role!=='admin'){assert.equal(await page.getByRole('button',{name:/^Edit /}).count(),0);await page.locator('[data-icon-surface=course]').hover();await page.getByRole('button',{name:/Open sections for/}).click();assert.equal(await page.getByRole('button',{name:/^Edit /}).count(),0);}
  else{
   for(const title of ['AI Training','Business Analytics']){
    if(width===390&&title==='AI Training')await page.locator('#mobile-folder-toggle').click();
    const gear=page.getByRole('button',{name:'Edit '+title,exact:true});await gear.click();const dialog=page.getByRole('dialog',{name:'Edit name and description'});
    assert.equal(await dialog.getByLabel('Name',{exact:true}).inputValue(),title);assert.ok(await dialog.getByLabel('Description',{exact:true}).inputValue());
    await dialog.getByLabel('Name',{exact:true}).fill(title+' revised');await dialog.getByLabel('Description',{exact:true}).fill('Updated description');
    fail=true;await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Name',{exact:true}).inputValue(),title+' revised');
    fail=false;await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'detached'});
    if(width===390&&title==='AI Training')await page.locator('#mobile-folder-toggle').click();
   }
   await page.locator('[data-icon-surface=course]').hover();await page.getByRole('button',{name:/Open sections for/}).click();await page.getByRole('button',{name:'Edit Prompt design',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit name and description'});await dialog.getByLabel('Description',{exact:true}).fill('A new section description');
   await page.screenshot({path:path.join(out,'section-editor-'+width+'.png')});const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'detached'});assert.deepEqual(writes.map(write=>write.kind),['folder','folder','course','course','section']);assert.equal(await page.evaluate(()=>window.catalogRefreshes),3);
   await page.getByRole('button',{name:'Edit Prompt design',exact:true}).click();await page.getByRole('dialog').press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  }
  assert.deepEqual(errors,[]);await context.close();console.log('Catalog '+role+' '+width+': admin-only gears, native dialogs, retry/save and stable navigation passed');
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
