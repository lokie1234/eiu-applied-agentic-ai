import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
function git(root, ...args) {
  try { const output=execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }); return args.includes('-z') ? output : output.trim(); }
  catch { return null; }
}

export async function inspect(root) {
  root = await fs.realpath(path.resolve(root));
  const packageFile = path.join(root, 'package.json');
  const pkg = await exists(packageFile) ? JSON.parse(await fs.readFile(packageFile, 'utf8')) : null;
  const lockfiles = [];
  for (const [file, manager] of [['package-lock.json','npm'],['npm-shrinkwrap.json','npm'],['pnpm-lock.yaml','pnpm'],['yarn.lock','yarn'],['bun.lock','bun'],['bun.lockb','bun']]) {
    if (await exists(path.join(root, file))) lockfiles.push({ file, manager });
  }
  const declaredManager = typeof pkg?.packageManager === 'string' ? pkg.packageManager.match(/^(npm|pnpm|yarn|bun)@/)?.[1] : null;
  const candidates = [...new Set(lockfiles.map(item => item.manager))];
  const manager = declaredManager || (candidates.length === 1 ? candidates[0] : null);
  const scriptNames = Object.keys(pkg?.scripts || {}).sort();
  const checkNames = ['lint','typecheck','type-check','check','test','build'].filter(name => scriptNames.includes(name));
  const notes = [];
  if (!pkg) notes.push('No package.json here; use the project stack or select the appropriate workspace package.');
  if (pkg && !manager) notes.push('Package manager is not determined uniquely; inspect project instructions before choosing one.');
  if (candidates.length > 1) notes.push('Multiple package-manager lockfiles found; do not replace them automatically.');
  const status = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=normal');
  const changes = [];
  if (status) {
    // Do not trim individual records: leading spaces encode index/worktree status.
    const records = status.split('\0');
    for (let i = 0; i < records.length; i++) {
      if (!records[i]) continue;
      const record = records[i];
      changes.push({ status: record.slice(0, 2), path: record.slice(3), ...(/[RC]/.test(record.slice(0,2)) ? { from: records[++i] } : {}) });
    }
  }
  return {
    root, nodeProject: Boolean(pkg), manager, lockfiles: lockfiles.map(item => item.file), scriptNames,
    suggestedChecks: manager ? checkNames.map(name => [manager, 'run', name]) : [],
    git: { root: git(root, 'rev-parse', '--show-toplevel'), branch: git(root, 'branch', '--show-current'), upstream: git(root, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'), remotes: (git(root, 'remote') || '').split('\n').filter(Boolean), changes },
    notes: [...notes, 'Read-only metadata. Project script bodies and remote URLs are omitted. Suggested checks were not executed; assess scripts before running them.']
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--root') throw new Error('Usage: node inspect-project.mjs --root <project>');
    console.log(JSON.stringify(await inspect(args[1]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
