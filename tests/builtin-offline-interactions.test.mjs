import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';

const tick = () => new Promise(resolve => setTimeout(resolve, 30));
function lesson(section) {
  // These are repository-built bundles, not administrator-supplied JS.
  const window = new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
  const requests=[];
  window.fetch=async url=>{requests.push(url);throw Error('Offline lessons must not fetch');};
  window.eval('var module={exports:{}};var exports=module.exports;'+fs.readFileSync(`lib/drive/builtin-decks/section${section}.js`,'utf8')+';window.lesson=module.exports.default;');
  return {window,requests,slides:window.lesson,show(page) {
    const node=window.lesson[page-1]();window.document.body.replaceChildren(node);return node;
  },async close(){window.dispatchEvent(new window.Event('pagehide'));await window.happyDOM.close();}};
}
function button(node, text) {return [...node.querySelectorAll('button')].find(button=>button.textContent.includes(text));}

test('all 75 original content slides render with embedded images and no online forms or requests',async()=>{
  for(const section of [1,2]) {
    const f=lesson(section);
    try {
      assert.equal(f.slides.length,section===1?38:37);
      for(let page=1;page<=f.slides.length;page++) {
        const node=f.show(page);await tick();
        assert.equal(node.getAttribute('viewBox'),'0 0 960 540');
        assert.equal(node.getAttribute('data-preserve-original'),'true');
        assert.ok(node.querySelector('h1,h2'),`section ${section} page ${page}`);
        for(const image of node.querySelectorAll('img')) assert.match(image.src,/^data:/);
        for(const link of node.querySelectorAll('a')) assert.match(link.getAttribute('href'),/^(?:data:|https:\/\/)/);
        assert.equal(node.querySelector('input[type=email]'),null,'no second learner identity');
      }
      assert.deepEqual(f.requests,[]);
    } finally {await f.close();}
  }
});

test('section 1 retains reactive architecture cards and cached state after detaching',async()=>{
  const f=lesson(1);
  try {
    const node=f.show(8);await tick();button(node,'Database').click();await tick();
    assert.match(node.querySelector('foreignObject>div>div').textContent,/Nơi cất giữ dữ liệu/);
    f.window.document.body.replaceChildren();await tick();
    f.window.document.body.append(node);await tick();
    assert.match(node.querySelector('foreignObject>div>div').textContent,/Nơi cất giữ dữ liệu/);
    button(node,'Integrations').click();await tick();
    assert.match(node.querySelector('foreignObject>div>div').textContent,/Gmail/);
  } finally {await f.close();}
});

test('section 1 opens/closes the original dialog and lazy embedded photo gallery',async()=>{
  const f=lesson(1);
  try {
    let node=f.show(9);await tick();button(node,'Business Logic').click();await tick();
    assert.match(node.querySelector('[role=dialog]').textContent,/Business Logic/);
    button(node,'Close').click();await tick();assert.equal(node.querySelector('[role=dialog]'),null);
    node=f.show(10);await tick();button(node,'Thực trạng').click();await tick();
    const dialog=node.querySelector('[role=dialog]');assert.ok(dialog);
    assert.equal(dialog.querySelectorAll('img').length,4);
    dialog.querySelector('[aria-label^="Xem lớn ảnh"]').click();await tick();
    assert.match(dialog.textContent,/1 \/ 4/);
    dialog.querySelector('[aria-label="Ảnh tiếp theo"]').click();await tick();
    assert.match(dialog.textContent,/2 \/ 4/);
    dialog.querySelector('[aria-label="Đóng Thực trạng"]').click();await tick();
    assert.equal(node.querySelector('[role=dialog]'),null);assert.deepEqual(f.requests,[]);
  } finally {await f.close();}
});

test('section 2 runs the complete local incident submission, approval and completion workflow',async()=>{
  const f=lesson(2);
  try {
    const node=f.show(14);await tick();
    const submit=button(node,'Submit báo cáo');assert.equal(submit.disabled,true);
    const severity=node.querySelector('select[required]');severity.value='ưu tiên';
    severity.dispatchEvent(new f.window.Event('change',{bubbles:true}));await tick();
    assert.equal(submit.disabled,false);submit.click();await tick();
    assert.equal(node.querySelectorAll('tbody tr').length,1);
    button(node,'Duyệt').click();await tick();assert.match(node.querySelector('tbody').textContent,/Đã duyệt/);
    button(node,'Hoàn thành').click();await tick();assert.match(node.querySelector('tbody').textContent,/Đã hoàn thành/);
    assert.deepEqual(f.requests,[]);
  } finally {await f.close();}
});

test('offline download links contain the exact original file bytes and readable filenames',async()=>{
  const f=lesson(1);
  try {
    for(const [page,filename] of [[33,'design-dna.txt'],[38,'Sales-Data-2025.xlsx']]) {
      const node=f.show(page);await tick();
      const link=node.querySelector(`a[download="${filename}"]`);assert.ok(link);
      assert.deepEqual(Buffer.from(link.href.split(',')[1],'base64'),fs.readFileSync('public/downloads/'+filename));
    }
  } finally {await f.close();}
});
