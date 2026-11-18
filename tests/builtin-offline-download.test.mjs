import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('offline Emergency responses preserve binary ZIP bytes as well as UTF-8 text',async()=>{
  const code=ts.transpileModule(fs.readFileSync('course-content/applied-agentic-ai/offline/browser.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022},
  }).outputText;
  for(const [bytes,mime] of [[Buffer.from([80,75,3,4,0,128,255,195,40]),'application/zip'],[Buffer.from('Nội dung SKILL\r\n'),'text/plain;charset=utf-8']]) {
    const exports={};
    vm.runInNewContext(code,{exports,Uint8Array,Response,atob,require:name=>{
      assert.equal(name,'eiu:emergency');return {bytes:bytes.toString('base64'),mime};
    }});
    const response=await exports.offlineEmergencyFetch('eiu:emergency',{body:JSON.stringify({file:'config'})});
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
    assert.equal(response.headers.get('Content-Type'),mime);
    assert.equal((await exports.offlineEmergencyFetch('eiu:emergency',{body:'{"file":"unknown"}'})).status,400);
  }
});
