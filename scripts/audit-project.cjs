const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const tracked=cp.execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
const newFiles=cp.execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
const files=[...new Set([...tracked,...newFiles])].filter(f=>fs.existsSync(path.join(root,f))&&!f.startsWith('tmp/'));
const hashes=new Map(),duplicates=[],overrides=[];
for(const file of files){
 if(!/\.(tsx?|jsx?|cjs|mjs)$/.test(file))continue;
 const text=fs.readFileSync(path.join(root,file),'utf8');
 const hash=crypto.createHash('sha256').update(text).digest('hex');
 const same=hashes.get(hash)||[];same.push(file);hashes.set(hash,same);
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isSourceFile(node)||ts.isBlock(node)){
   const names=new Set();
   for(const item of node.statements){
    if(ts.isFunctionDeclaration(item)&&item.body&&item.name){
     if(names.has(item.name.text))overrides.push({file,name:item.name.text,line:tree.getLineAndCharacterOfPosition(item.getStart()).line+1});
     names.add(item.name.text);
    }
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
}
for(const files of hashes.values())if(files.length>1)duplicates.push(files);
const result={scannedFiles:files.length,duplicateFunctionDeclarations:overrides,identicalSourceFiles:duplicates};
fs.mkdirSync(path.join(root,'.local'),{recursive:true});
fs.writeFileSync(path.join(root,'.local/project-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(overrides.length)process.exitCode=1;
