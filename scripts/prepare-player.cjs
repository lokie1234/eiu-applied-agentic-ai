const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..'),ui=path.join(root,'desktop-player/ui');
fs.mkdirSync(ui,{recursive:true});
const source=fs.readFileSync(path.join(root,'lib/tsxDocument.ts'),'utf8');
// One renderer for web and desktop. Only remove the module export for the shell.
const runtime=ts.transpileModule(source.replace('export function','function'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
fs.writeFileSync(path.join(ui,'lesson-runtime.js'),runtime);
fs.copyFileSync(path.join(root,'course-content/web-app-development/fonts/Inter-Variable.woff2'),path.join(ui,'Inter.woff2'));
const template='data:image/png;base64,'+fs.readFileSync(path.join(root,'public/templates/eiu-business-v1/background.png')).toString('base64');
fs.writeFileSync(path.join(ui,'player-assets.js'),'const EIU_PLAYER_ASSETS = '+JSON.stringify({template})+';\n');
const downloads=path.join(ui,'downloads');fs.mkdirSync(downloads,{recursive:true});
fs.copyFileSync(path.join(root,'public/downloads/eiu-advertising-starter.zip'),path.join(downloads,'eiu-advertising-starter.zip'));
console.log('Player assets prepared from the shared web renderer and EIU template.');
