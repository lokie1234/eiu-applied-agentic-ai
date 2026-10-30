import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('immutable migrated snapshots retain their bytes and editable lessons match their compiler sources',async()=>{
 const manifest=JSON.parse(fs.readFileSync('docs/section-js-migration.json','utf8'));
 const generated=new Map();
 for (const script of ['build-web-app-course.cjs','build-mis301-course.cjs']) {
  const buildRequire=createRequire(new URL('../scripts/'+script,import.meta.url));
  await vm.runInNewContext(fs.readFileSync('scripts/'+script,'utf8'),{
   require:name=>name==='node:fs'?{...fs,writeFileSync:(file,bytes)=>generated.set(String(file).replaceAll('\\','/'),bytes)}:buildRequire(name),
   process:{argv:['node',script],env:{},cwd:()=>process.cwd()},console:{log(){}},Buffer,
  });
 }
 assert.equal(manifest.files.length,5);
 for(const file of manifest.files){
  assert.ok(!fs.existsSync(file.source),'old duplicate section removed: '+file.source);
  const bytes=fs.readFileSync(file.runtime);
  const compiled=[...generated].find(([path])=>path.endsWith('/'+file.runtime));
  // Git checkouts may use CRLF in editable CSS template literals.
  if(compiled) assert.equal(bytes.toString('utf8').replaceAll('\r\n','\n'),compiled[1].replaceAll('\r\n','\n'),file.runtime+' matches storyboard, renderer and assets');
  else assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.runtime);
 }
});
test('the runtime factory allocates its SVG tag table once per frame',()=>{
 const source=fs.readFileSync('lib/tsxDocument.ts','utf8');
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require});
 const normal=exports.createTsxDocument('exports.default=[];',1);
 assert.equal((normal.match(/const svgTags=new Set/g)||[]).length,1);
 assert.ok(normal.indexOf('const svgTags=')<normal.indexOf('const h='));
});
