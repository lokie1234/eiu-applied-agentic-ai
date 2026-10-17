import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('all migrated lesson runtimes retain the exact pre-migration compiled bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync('docs/section-js-migration.json','utf8'));
 assert.equal(manifest.files.length,5);
 for(const file of manifest.files){
  assert.ok(!fs.existsSync(file.source),'old duplicate section removed: '+file.source);
  const bytes=fs.readFileSync(file.runtime);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.runtime);
 }
});
test('the runtime factory allocates its SVG tag table once per frame and keyboard forwarding is opt-in',()=>{
 const source=fs.readFileSync('lib/tsxDocument.ts','utf8');
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require});
 const normal=exports.createTsxDocument('exports.default=[];',1);
 assert.equal((normal.match(/const svgTags=new Set/g)||[]).length,1);
 assert.ok(normal.indexOf('const svgTags=')<normal.indexOf('const h='));
 assert.ok(normal.includes("if(false)document.addEventListener('keydown'"));
 const desktop=exports.createTsxDocument('exports.default=[];',1,'','','request',true);
 assert.ok(desktop.includes("if(true)document.addEventListener('keydown'"));
});
