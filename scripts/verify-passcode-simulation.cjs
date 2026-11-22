const path=require('path'),assert=require('assert/strict');
const {createCatalogFixture}=require('./lib/catalog-ui-qa.cjs');
async function main(){
 const out=path.resolve('.tmp/passcode-simulation-qa'),entry=`import React from 'react';import{createRoot}from'react-dom/client';import Portal from './components/LessonPortal';
 const role=new URLSearchParams(location.search).get('role')||'admin';const courses=[{id:'c1',slug:'business',title:'Business Analytics',description:'Course description',languageLabel:'en',folderGroupId:'f1',folderGroupName:'AI Training',sections:[{id:'s1',sectionKey:'prompts',title:'Prompt design',position:1,contentType:'tsx',slideCount:11,canFacilitate:role==='teacher'},{id:'s2',sectionKey:'tools',title:'AI tools',position:2,contentType:'tsx',slideCount:6,canFacilitate:role==='teacher'}]},{id:'c2',slug:'web',title:'Web Development',languageLabel:'en',folderGroupId:'f2',folderGroupName:'Web Tools',sections:[{id:'s3',sectionKey:'apps',title:'Web apps',position:1,contentType:'tsx',slideCount:7}]}];
 createRoot(document.getElementById('app')).render(<Portal isAdmin={role==='admin'} canFacilitate={role==='teacher'} courseFolders={courses} initialSection={null} initialProfile={null}/>);`;
 const {server,browser}=await createCatalogFixture(out,entry);
 try{for(const width of [390,960,1280])for(const role of ['admin','teacher','learner']){
  const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage(),errors=[],requests=[];let failList=true;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST')requests.push(request.url());});
  const credentials=[{id:'global:all:learner',code:'111111',kind:'global',label:'All courses',mode:'learner',available:true,courseCount:2,sectionCount:3},{id:'course:c1:facilitator',code:'222222',kind:'course',label:'Business Analytics',mode:'facilitator',available:true,courseCount:1,sectionCount:2},{id:'section:s1:learner',code:'333333',kind:'section',label:'Business Analytics / Prompt design',mode:'learner',available:true,courseCount:1,sectionCount:1},{id:'course:hidden:learner',code:'444444',kind:'course',label:'Hidden course',mode:'learner',available:false,courseCount:0,sectionCount:0}];
  await page.route('**/api/admin/passcode-simulation',async route=>{
   if(route.request().method()==='GET'){if(failList){failList=false;return route.fulfill({status:503,json:{message:'Connection unavailable. Retry.'}});}return route.fulfill({json:{success:true,credentials}});}
   const id=route.request().postDataJSON().credentialId,item=credentials.find(item=>item.id===id);if(!item?.available)return route.fulfill({status:409,json:{message:'Inactive passcode'}});
   const ids=item.kind==='global'?['s1','s2','s3']:item.kind==='course'?['s1','s2']:['s1'];await new Promise(resolve=>setTimeout(resolve,150));return route.fulfill({json:{success:true,preview:{credentialId:id,label:(item.kind==='global'?'Global':'Specialized')+' · '+item.label,mode:item.mode,sections:ids.map(id=>({id,canFacilitate:item.mode==='facilitator'}))}}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/?role='+role);await page.getByRole('button',{name:/Open sections for/}).waitFor();
  const trigger=page.getByRole('button',{name:'Passcode simulation',exact:true});
  if(role!=='admin'){assert.equal(await trigger.count(),0);}else{
   assert.equal(await page.getByRole('button',{name:'Learning Access',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Teaching Access',exact:true}).count(),0);
   await trigger.click();let dialog=page.getByRole('dialog',{name:'Passcode simulation',exact:true});await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'Retry',exact:true}).click();await dialog.locator('code').first().waitFor();assert.equal(await dialog.locator('code').count(),4);assert.equal(await dialog.getByRole('button',{name:/Simulate 444444/}).isDisabled(),true);
   await page.screenshot({path:path.join(out,'passcodes-'+width+'.png')});const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
   await dialog.getByLabel('Find a passcode').fill('333333');assert.equal(await dialog.locator('code').count(),1);await dialog.getByRole('button',{name:/Simulate 333333/}).click();await dialog.waitFor({state:'detached'});
   assert.match(await page.locator('[data-access-preview-mode]').innerText(),/Prompt design/);assert.equal(await page.getByRole('button',{name:/^Edit /}).count(),0);if(width===390)await page.locator('#mobile-folder-toggle').click();assert.equal(await page.locator('[data-icon-surface=folder]').count(),1);if(width===390)await page.locator('#mobile-folder-toggle').click();
   await page.locator('[data-icon-surface=course]').hover();await page.getByRole('button',{name:/Open sections for/}).click();assert.equal(await page.locator('article[data-icon-surface=section]').count(),1);assert.equal(await page.locator('[data-access-preview-mode]').getAttribute('data-access-preview-mode'),'learning');
   await page.getByRole('button',{name:'Back to admin',exact:true}).click();assert.equal(await page.locator('[data-access-preview-mode]').count(),0);
   await trigger.click();dialog=page.getByRole('dialog',{name:'Passcode simulation',exact:true});await dialog.getByRole('button',{name:/Simulate 222222/}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('article[data-icon-surface=section]').count(),2);assert.equal(await page.locator('[data-access-preview-mode]').getAttribute('data-access-preview-mode'),'teaching');assert.equal(await page.getByRole('button',{name:/^Edit /}).count(),0);
   await trigger.click();dialog=page.getByRole('dialog',{name:'Passcode simulation',exact:true});await dialog.getByRole('button',{name:/Simulate 111111/}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('[data-icon-surface=folder]').count(),2);await page.getByRole('button',{name:'Back to admin',exact:true}).click();assert.ok(await page.getByRole('button',{name:/^Edit /}).count()>0);
   assert.ok(requests.every(url=>url.endsWith('/api/admin/passcode-simulation')),'simulation never logs in, submits, or writes learner presence');
  }
  assert.deepEqual(errors,[]);await context.close();console.log('Passcode simulation '+role+' '+width+': existing codes, scope filtering, teaching/learning, retry and return passed');
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
