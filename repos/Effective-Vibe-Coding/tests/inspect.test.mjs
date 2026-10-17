import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspect } from '../skills/effective-vibe-coding/scripts/inspect-project.mjs';

test('reports checks without executing scripts or leaking remote credentials and preserves Git status columns',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'effective-inspect-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'ignore'});
 git('init','-b','main');
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({scripts:{test:'node -e "require(\'fs\').writeFileSync(\'SIDE_EFFECT\',\'bad\')"',build:'echo build'}}));
 await fs.writeFile(path.join(root,'package-lock.json'),'{}');
 await fs.writeFile(path.join(root,'two words.txt'),'before');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture');
 await fs.writeFile(path.join(root,'two words.txt'),'after');git('remote','add','origin','https://token:SECRET@example.invalid/repo.git');
 const result=await inspect(root);
 assert.equal(result.manager,'npm');
 assert.deepEqual(result.suggestedChecks,[['npm','run','test'],['npm','run','build']]);
 assert.deepEqual(result.git.changes,[{status:' M',path:'two words.txt'}]);
 assert.deepEqual(result.git.remotes,['origin']);
 assert.ok(!JSON.stringify(result).includes('SECRET'));
 assert.ok(!JSON.stringify(result).includes('SIDE_EFFECT'));
 await assert.rejects(fs.access(path.join(root,'SIDE_EFFECT')));
 await fs.writeFile(path.join(root,'yarn.lock'),'');
 assert.equal((await inspect(root)).manager,null);
});

test('a non-Node project has no fabricated check commands',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'effective-stack-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const result=await inspect(root);assert.equal(result.nodeProject,false);assert.deepEqual(result.suggestedChecks,[]);
});
