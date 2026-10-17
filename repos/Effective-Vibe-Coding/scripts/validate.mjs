import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(repo,'skills/effective-vibe-coding');
const source=await fs.readFile(path.join(root,'SKILL.md'),'utf8');
const header=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
if(!header)throw Error('Missing skill frontmatter');
const fields=Object.fromEntries(header[1].split(/\r?\n/).map(line=>{
  const match=line.match(/^([a-z-]+): (.+)$/);if(!match)throw Error('Expected simple key/value frontmatter');return [match[1],match[2]];
}));
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.name)||fields.name.length>64||fields.name!==path.basename(root))throw Error('Invalid skill name');
if(!fields.description||fields.description.length>1024||/[<>]/.test(fields.description))throw Error('Invalid skill description');
if(Object.keys(fields).some(key=>!['name','description'].includes(key)))throw Error('Unexpected frontmatter key');
if(/\[TODO|TODO:|TBD/.test(source))throw Error('Unfinished scaffold');
for(const match of source.matchAll(/\]\(([^)]+)\)/g)){
  if(/^(https?:|#)/.test(match[1]))continue;
  const relative=match[1].split('#')[0];const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep))throw Error('Reference escapes skill');
  await fs.access(file);
}
const yaml=await fs.readFile(path.join(root,'agents/openai.yaml'),'utf8');
if(!yaml.includes('$'+fields.name)||!yaml.includes('allow_implicit_invocation: true'))throw Error('Invalid invocation metadata');
console.log('Skill name, frontmatter, reference links and invocation metadata are valid.');
