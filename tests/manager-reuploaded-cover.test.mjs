import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Window} from 'happy-dom';
const original='course-content/imported/500c7192-961d-4e41-9917-9b9f85f0b667/98694749-2879-46e2-82bd-03fd27f23c5e/0242893b-b5f3-4036-8cfb-efc903434327.js';
const imageBytes=uri=>uri.startsWith('data:image/svg+xml;base64,')?Buffer.from(uri.split(',')[1],'base64').toString('utf8').replaceAll('\r\n','\n'):uri;
function lesson(file){
 const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 window.eval('var module={exports:{}};var exports=module.exports;'+fs.readFileSync(file,'utf8')+';window.slides=module.exports.default;');
 return {window,slides:window.slides,show(n){const node=window.slides[n-1]();window.document.body.replaceChildren(node);return node;},async close(){window.dispatchEvent(new window.Event('pagehide'));await window.happyDOM.close();}};
}
test('reuploaded Manager cover changes only its audience and removes the two requested subtitle lines',async()=>{
 const before=lesson(original),after=lesson('course-content/ai-for-managers/reuploaded/section1.js');
 try{
  assert.equal(after.slides.length,39);assert.equal(before.slides.length,38);
  const old=before.show(1),cover=after.show(1);
  assert.equal(cover.querySelector('h1').textContent,'Applied Agentic AIfor Managers');
  assert.equal(cover.querySelector('h2'),null);assert.equal(cover.querySelector('p'),null);
  assert.equal(cover.querySelectorAll('[data-team-manager]').length,1);
  assert.equal(cover.querySelectorAll('[data-team-employee]').length,3);
  assert.equal(cover.querySelectorAll('[data-team-signals] path').length,3);
  assert.equal(cover.querySelector('img').src,old.querySelector('img').src);
  assert.deepEqual([...cover.querySelectorAll('[data-cover-tool]')].map(node=>node.getAttribute('data-cover-tool')),['apps-script','sheets','gemini','chatgpt','claude']);
  assert.equal(cover.querySelectorAll('[data-cover-tool-base]').length,0);
  assert.equal(cover.querySelectorAll('[data-tool-circle]').length,5);
  assert.equal(cover.querySelectorAll('[role=tooltip]').length,5);
  assert.equal(cover.querySelector('[data-cover-tools] [title]'),null);
  const icons=JSON.parse(fs.readFileSync('course-content/ai-for-managers/reuploaded/tool-icons.json','utf8'));
  const official=JSON.parse(fs.readFileSync('course-content/advanced-business-analytics/assets/official-icons.json','utf8'));
  for(const node of cover.querySelectorAll('[data-cover-tool]')){const key=node.getAttribute('data-cover-tool'),uri=node.querySelector('img').src;assert.equal(createHash('sha256').update(Buffer.from(uri.split(',')[1],'base64')).digest('hex'),official[key].sha256);assert.equal(uri,icons[key].src);assert.equal(node.querySelector('[role=tooltip] strong').textContent,icons[key].label);}
  assert.equal(cover.getAttribute('data-preserve-original'),'true');
  for(let n=2;n<=38;n++){
   const a=before.show(n),b=after.show(n>=5?n+1:n);
   if(n===4){
    const ideas=JSON.parse(fs.readFileSync('course-content/ai-for-managers/reuploaded/ideas-data.json','utf8'));
    assert.equal(b.querySelector('h1').textContent,'Một vài ý tưởng cho cấp quản lý');
    assert.equal(b.querySelectorAll('[data-manager-idea]').length,8);
    assert.deepEqual([...b.querySelectorAll('[data-manager-idea] strong')].map(node=>node.textContent),ideas.map(item=>item.title));
    assert.ok(!b.querySelector('[data-manager-ideas]').textContent.includes('Đăng ký môn học'));
    continue;
   }
   const text=b.querySelector('[data-offline-canvas] > div').textContent;
   if(n===3){assert.ok(b.querySelector('[data-practical-goal]').textContent.includes('Hiểu được nhu cầu thực tế'));}
   assert.equal(n===3?text.replace('Hiểu được nhu cầu thực tế',''):text,a.querySelector('[data-offline-canvas] > div').textContent,`slide ${n} content preserved`);
   assert.deepEqual([...b.querySelectorAll('img')].map(img=>imageBytes(img.src)),[...a.querySelectorAll('img')].map(img=>imageBytes(img.src)),`slide ${n} images preserved`);
   assert.deepEqual([...b.querySelectorAll('button')].map(el=>el.textContent),[...a.querySelectorAll('button')].map(el=>el.textContent),`slide ${n} controls preserved`);
   assert.deepEqual([...b.querySelectorAll('a')].map(el=>[el.href,el.download]),[...a.querySelectorAll('a')].map(el=>[el.href,el.download]),`slide ${n} downloads preserved`);
  }
 }finally{await before.close();await after.close();}
});
