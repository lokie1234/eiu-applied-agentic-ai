const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const JSZip=require('jszip');
async function main(){
 const root=path.resolve(__dirname,'..'),dist=path.join(root,'desktop-player/dist');
 const version=require('../desktop-player/package.json').version;
 const installer=path.join(dist,`EIU-Lesson-Player-${version}-win-x64.exe`);
 if(fs.existsSync(installer)){
  const zip=new JSZip();zip.file(path.basename(installer),fs.readFileSync(installer));
  zip.file('HUONG-DAN-CAI-DAT.txt',fs.readFileSync(path.join(root,'desktop-player/INSTALL.txt')));
  const body=await zip.generateAsync({type:'nodebuffer',compression:'STORE'});
  fs.writeFileSync(path.join(dist,`EIU-Lesson-Player-${version}-windows-x64.zip`),body);
 }
 const packages=fs.readdirSync(dist).filter(name=>/^EIU-Lesson-Player-.*\.zip$/.test(name));
 for(const name of packages.filter(name=>/-mac-/.test(name))){
  const file=path.join(dist,name),zip=await JSZip.loadAsync(fs.readFileSync(file));
  if(!zip.file('HUONG-DAN-CAI-DAT.txt')){
   zip.file('HUONG-DAN-CAI-DAT.txt',fs.readFileSync(path.join(root,'desktop-player/INSTALL.txt')),{unixPermissions:0o100644});
   fs.writeFileSync(file,await zip.generateAsync({type:'nodebuffer',platform:'UNIX',compression:'DEFLATE',compressionOptions:{level:6}}));
  }
 }
 const hashes=packages.map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,name))).digest('hex')+'  '+name);
 fs.writeFileSync(path.join(dist,'SHA256SUMS-'+process.platform+'.txt'),hashes.join('\n')+'\n');
 console.log(packages.join('\n'));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
