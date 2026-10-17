import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/playerDownload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto:webcrypto,Blob,Uint8Array});
function fixture(){
 const buffers=[Buffer.from('part-one-'),Buffer.from('part-two')];
 return {buffers,pkg:{name:'installer.zip',platform:'windows-x64',bytes:buffers.reduce((sum,b)=>sum+b.length,0),sha256:'',parts:buffers.map((b,i)=>({url:'https://downloads.example/'+i,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}))}};
}
test('public installer download verifies parts, preserves order and returns one complete ZIP',async()=>{
 const {buffers,pkg}=fixture(),reads=[],progress=[];
 const blob=await exports.downloadPlayerArchive(pkg,new AbortController().signal,value=>progress.push(value),async url=>{const index=Number(url.split('/').pop());reads.push(index);return new Response(buffers[index]);});
 assert.equal(await blob.text(),'part-one-part-two');
 assert.equal(blob.type,'application/zip');assert.deepEqual(reads,[0,1]);
 assert.equal(progress[0],0);assert.equal(progress.at(-1),100);
});
test('corrupted installer data is rejected before any file is offered',async()=>{
 const {pkg}=fixture();let reads=0;
 await assert.rejects(exports.downloadPlayerArchive(pkg,new AbortController().signal,()=>{},async()=>{reads++;return new Response('corrupt');}),/Tệp tải về/);
 assert.equal(reads,1);
});
test('cancelling a download stops before the next artifact read',async()=>{
 const {buffers,pkg}=fixture(),controller=new AbortController();let reads=0;
 await assert.rejects(exports.downloadPlayerArchive(pkg,controller.signal,percent=>{if(percent>0)controller.abort();},async()=>new Response(buffers[reads++])),/abort/i);
 assert.equal(reads,1);
});

test('published Windows and macOS installers expose only public, token-free URLs',()=>{
 const releases=JSON.parse(fs.readFileSync('public/downloads/player-releases.json','utf8'));
 assert.deepEqual(releases.packages.map(p=>p.platform),['windows-x64','mac-arm64','mac-x64']);
 for(const pkg of releases.packages){
  assert.equal(pkg.parts.reduce((sum,part)=>sum+part.bytes,0),pkg.bytes);
  assert.match(pkg.sha256,/^[a-f0-9]{64}$/);
  for(const part of pkg.parts){
   const url=new URL(part.url);assert.equal(url.protocol,'https:');assert.equal(url.search,'');
   assert.ok(url.pathname.startsWith('/storage/v1/object/public/lesson-player-installers/'));
   assert.ok(part.bytes>0&&part.bytes<=4*1024*1024);assert.match(part.sha256,/^[a-f0-9]{64}$/);
  }
 }
 assert.ok(fs.existsSync('public/downloads/eiu-lesson-player-install.txt'));
});
