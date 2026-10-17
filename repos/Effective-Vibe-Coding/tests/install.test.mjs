import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { install } from '../scripts/install.mjs';

async function fixture(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'effective-vibe-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}

test('installs into a spaced project path, preserves existing instructions and is idempotent',async t=>{
 const base=await fixture(t),target=path.join(base,'my app');await fs.mkdir(target);
 const original=Buffer.from('\ufeff# Existing rules\r\nKeep my custom workflow.\r\n');
 await fs.writeFile(path.join(target,'AGENTS.md'),original);
 await fs.writeFile(path.join(target,'AGENTS.override.md'),'# Override\nPreserve this too.');
 const result=await install(target);
 assert.ok(result.files.includes('AGENTS.md'));
 const output=await fs.readFile(path.join(target,'AGENTS.md'));
 assert.ok(output.subarray(0,original.length).equals(original));
 assert.match(await fs.readFile(path.join(target,'AGENTS.override.md'),'utf8'),/^# Override\nPreserve this too\./);
 assert.ok(await fs.stat(path.join(target,'.agents/skills/effective-vibe-coding/SKILL.md')));
 assert.deepEqual((await install(target)).files,[]);
 assert.ok((await fs.readFile(path.join(target,'AGENTS.md'))).equals(output));
});

test('preflight rejects edited skill files without appending instructions',async t=>{
 const target=await fixture(t);const folder=path.join(target,'.agents/skills/effective-vibe-coding');
 await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'SKILL.md'),'User-owned skill');
 await assert.rejects(install(target),/Existing file differs/);
 assert.equal(await fs.readFile(path.join(folder,'SKILL.md'),'utf8'),'User-owned skill');
 await assert.rejects(fs.access(path.join(target,'AGENTS.md')));
});

test('dry run does not write files and a malformed rule stops installation',async t=>{
 const target=await fixture(t);
 assert.ok((await install(target,{dryRun:true})).files.length>0);
 assert.deepEqual(await fs.readdir(target),[]);
 await fs.writeFile(path.join(target,'AGENTS.md'),'<!-- BEGIN effective-vibe-coding -->');
 await assert.rejects(install(target),/Malformed/);
 assert.deepEqual(await fs.readdir(target),['AGENTS.md']);
});

test('refuses a redirected .agents directory and leaves its destination untouched',async t=>{
 const base=await fixture(t),target=path.join(base,'target'),outside=path.join(base,'outside');
 await fs.mkdir(target);await fs.mkdir(outside);
 await fs.symlink(outside,path.join(target,'.agents'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(install(target),/symlink destination/);
 assert.deepEqual(await fs.readdir(outside),[]);
});
