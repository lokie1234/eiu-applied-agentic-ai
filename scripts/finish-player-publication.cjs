const fs=require('node:fs');
const {headers,base}=require('./player-github.cjs')();
async function main(){
 const runs=await fetch(base+'/actions/runs?per_page=10',{headers}).then(r=>r.json());const run=runs.workflow_runs.find(r=>r.name==='Publish public player downloads');if(!run){console.log('Publication queued.');return;}
 const jobs=await fetch(base+'/actions/runs/'+run.id+'/jobs',{headers}).then(r=>r.json());
 console.log(JSON.stringify({id:run.id,status:run.status,result:run.conclusion,jobs:jobs.jobs.map(j=>({status:j.status,result:j.conclusion,step:j.steps?.find(s=>s.status==='in_progress')?.name,failed:j.steps?.filter(s=>s.conclusion==='failure').map(s=>s.name)}))}));
 if(run.status==='completed'&&run.conclusion==='success'){
  const artifacts=await fetch(base+'/actions/runs/'+run.id+'/artifacts',{headers}).then(r=>r.json());const artifact=artifacts.artifacts.find(a=>a.name==='player-public-manifest');if(!artifact)throw Error('Missing public manifest artifact');
  const response=await fetch(artifact.archive_download_url,{headers});if(!response.ok)throw Error('Manifest download failed');
  const zip=await require(process.cwd()+'/node_modules/jszip').loadAsync(Buffer.from(await response.arrayBuffer()));
  const file=Object.values(zip.files).find(f=>f.name.endsWith('player-releases.json'));if(!file)throw Error('Manifest missing');
  const text=await file.async('string'),manifest=JSON.parse(text);if(manifest.packages.length!==3||manifest.packages.some(p=>!p.parts.length))throw Error('Incomplete installer publication');
  fs.writeFileSync('public/downloads/player-releases.json',text);console.log('Saved public download manifest for all three platforms.');
  for(const name of ['EIU_PLAYER_UPLOAD_WINDOWS','EIU_PLAYER_UPLOAD_MAC_ARM64','EIU_PLAYER_UPLOAD_MAC_X64']){const removed=await fetch(base+'/actions/secrets/'+name,{method:'DELETE',headers});if(![204,404].includes(removed.status))throw Error('Unable to remove temporary upload grant');}
  console.log('Removed all temporary repository upload grants.');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
