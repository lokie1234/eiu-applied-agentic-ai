import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';
const runtime={};vm.runInNewContext(fs.readFileSync('tests/fixtures/windows-player-1.2.1-runtime.js.txt','utf8'),runtime);
const background='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=';
async function player(session){
 const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}}),messages=[];
 // Run the exact bootstrap explicitly: Happy DOM does not fire iframe load.
 window.document.write(runtime.createLessonDocument().split('<script>')[0]+'</body></html>');
 window.eval(`(${runtime.lessonFrameBootstrap.toString()})();`);
 await window.happyDOM.whenAsyncComplete();
 const port={postMessage:message=>messages.push(message),start(){}};
 window.dispatchEvent(new window.MessageEvent('message',{source:window.eval('parent'),data:{type:'eiu-connect'},ports:[port]}));
 assert.equal(typeof port.onmessage,'function');
 port.onmessage({data:{type:'init',code:fs.readFileSync(`course-content/mis311/Week7Session${session}.js`,'utf8'),template:background,sequence:1}});
 assert.equal(messages.some(m=>m.type.endsWith('error')),false,JSON.stringify(messages));
 return{window,messages,send:data=>port.onmessage({data})};
}
for(const [session,count] of [[1,20],[2,10]])test(`MIS 311 Section ${session} reuses the Windows player frame without nesting insets or page numbers`,async()=>{
 const f=await player(session),doc=f.window.document;
 try{
  for(let page=1;page<=count;page++){
   f.send({type:'show',page,sequence:page+1});
   const wrap=doc.querySelector('.eiu-content'),native=doc.querySelector('[data-mis311-frame]');
   assert.ok(native);assert.equal(doc.querySelectorAll('#mis311-player-template').length,1,'cache/navigation never add duplicate adapter styles');
   assert.equal(f.window.getComputedStyle(wrap).width,'100%');
   assert.match(f.window.getComputedStyle(wrap).getPropertyValue('inset'),/^0(?:px)?$/);
   assert.equal(f.window.getComputedStyle(doc.querySelector('.eiu-number')).display,'none');
   assert.equal(native.querySelector('[data-mis311-page]').textContent,String(page));
   assert.equal(native.querySelector('[data-mis311-content]').style.left,'5.6%','native content keeps exactly one inset');
  }
  f.send({type:'template',enabled:false});assert.equal(doc.querySelector('#root').classList.contains('eiu-template'),false);
  f.send({type:'template',enabled:true});assert.match(f.window.getComputedStyle(doc.querySelector('.eiu-content')).getPropertyValue('inset'),/^0(?:px)?$/);
 }finally{await f.window.happyDOM.close();}
});
test('the offline adapter leaves the web template and content placement unchanged',async()=>{
 const {createTsxDocument}=loadTS('lib/tsxDocument.ts');const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 try{
  window.document.write(createTsxDocument(fs.readFileSync('course-content/mis311/Week7Session2.js','utf8'),5,background,'custom-eiu','section:5'));
  assert.equal(window.document.querySelector('.eiu-content'),null);
  const native=window.document.querySelector('[data-mis311-frame]'),content=native.querySelector('[data-mis311-content]');
  assert.equal(content.style.left,'5.6%');assert.equal(content.style.top,'11.5%');assert.equal(content.style.width,'88.8%');assert.equal(content.style.height,'77.4%');
  assert.equal(native.dataset.eiuTemplate,'custom-eiu');assert.match(native.style.backgroundImage,/data:image\/png/);
 }finally{await window.happyDOM.close();}
});
