import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillName = 'effective-vibe-coding';
const begin = '<!-- BEGIN effective-vibe-coding -->';
const end = '<!-- END effective-vibe-coding -->';
const rule = `${begin}
## Effective Vibe Coding

For code implementation, bug fixes and UI refinements, read and apply
.agents/skills/effective-vibe-coding/SKILL.md and its relevant references.
Complete the requested change with appropriate verification, consistent typography/layout,
evidence-based performance work, and cleanup of code proven redundant within the task.
Preserve existing instructions, design choices and unrelated work. Report concrete
user-visible results and actual checks in the user's language; do not answer with only a diff.
This rule does not apply to pure Q&A. It grants no additional tool permissions or authority
to publish, push, deploy or delete unrelated work.
${end}`;

async function statOrNull(file) {
  try { return await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function assertSafeDestination(root, relative) {
  const parts = relative.split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const info = await statOrNull(current);
    if (info?.isSymbolicLink()) throw new Error(`Refusing symlink destination: ${current}`);
    if (info && i < parts.length - 1 && !info.isDirectory()) throw new Error(`Expected directory: ${current}`);
    if (info && i === parts.length - 1 && !info.isFile()) throw new Error(`Expected regular file: ${current}`);
  }
}

async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Skill sources must not contain symlinks');
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) result.push(relative);
    else throw new Error(`Unsupported source: ${relative}`);
  }
  return result.sort();
}

export async function install(target, { dryRun = false } = {}) {
  if (!target) throw new Error('Provide --target pointing to an existing project directory.');
  const root = await fs.realpath(path.resolve(target));
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Target must be a directory.');
  const source = path.join(repo, 'skills', skillName);
  const plan = [];
  for (const relative of await filesUnder(source)) {
    const dest = `.agents/skills/${skillName}/${relative}`;
    await assertSafeDestination(root, dest);
    const content = await fs.readFile(path.join(source, relative));
    const existing = await statOrNull(path.join(root, dest));
    if (existing) {
      if (!(await fs.readFile(path.join(root, dest))).equals(content)) {
        throw new Error(`Existing file differs; review or back it up before reinstalling: ${dest}`);
      }
    } else plan.push({ relative: dest, content });
  }
  const instructionFiles = ['AGENTS.md'];
  await assertSafeDestination(root, 'AGENTS.override.md');
  if (await statOrNull(path.join(root, 'AGENTS.override.md')) && (await fs.readFile(path.join(root, 'AGENTS.override.md'), 'utf8')).trim()) instructionFiles.push('AGENTS.override.md');
  for (const instructionFile of instructionFiles) {
    await assertSafeDestination(root, instructionFile);
    const agentsPath = path.join(root, instructionFile);
    const existingAgents = await statOrNull(agentsPath);
    const original = existingAgents ? await fs.readFile(agentsPath, 'utf8') : '';
    const count = marker => original.split(marker).length - 1;
    if (count(begin) !== count(end) || count(begin) > 1) throw new Error(`Malformed managed block in ${instructionFile}; review it before installation.`);
    if (count(begin)) {
      const start = original.indexOf(begin), stop = original.indexOf(end);
      if (stop < start || original.slice(start, stop + end.length).replaceAll('\r\n', '\n') !== rule) {
        throw new Error('Existing managed rule was edited; merge it manually before reinstalling.');
      }
    } else {
      // Preserve all existing bytes/text including its final newline; only append.
      const separator = original ? original.endsWith('\n\n') ? '' : original.endsWith('\n') ? '\n' : '\n\n' : '';
      plan.push({ relative: instructionFile, content: Buffer.from(original + separator + rule + '\n'), existing: Boolean(existingAgents), previous: original });
    }
  }
  // Complete preflight before the first write; do not overwrite conflicting skill files.
  if (!dryRun) for (const item of plan) {
    await assertSafeDestination(root, item.relative);
    const destination = path.join(root, item.relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (item.existing) {
      if (await fs.readFile(destination, 'utf8') !== item.previous) throw new Error(`${item.relative} changed during installation; retry after reviewing it.`);
      await fs.writeFile(destination, item.content);
    } else await fs.writeFile(destination, item.content, { flag: 'wx' });
  }
  return { target: root, dryRun, files: plan.map(item => item.relative), unchanged: plan.length === 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2); let target; let dryRun = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--target' && args[i + 1] && !args[i + 1].startsWith('--')) target = args[++i];
      else if (args[i] === '--dry-run') dryRun = true;
      else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    console.log(JSON.stringify(await install(target, { dryRun }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
