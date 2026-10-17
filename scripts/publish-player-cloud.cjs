// CI receives short-lived tokens scoped to these public installer objects only.
// No service-role key or access to course content is available to this workflow.
const fs=require('node:fs'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const version=require('../desktop-player/package.json').version;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function publish(config){
 const response=await fetch(config.assetUrl,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/octet-stream','X-GitHub-Api-Version':'2022-11-28'}});
 if(!response.ok)throw Error('Unable to read installer release.');
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length!==config.bytes||data.readUInt32LE(0)!==0x04034b50)throw Error('Installer release verification failed.');
 const client=createClient(config.projectUrl,config.publicKey),parts=[];let next=0;
 async function worker(){while(next<config.parts.length){
  const index=next++,part=config.parts[index],body=data.subarray(index*config.partSize,Math.min(data.length,(index+1)*config.partSize));
  let success=false;
  for(let attempt=0;attempt<3&&!success;attempt++){
   const uploaded=await client.storage.from(config.bucket).uploadToSignedUrl(part.path,part.token,body,{contentType:'application/octet-stream',cacheControl:'31536000'});
   if(!uploaded.error||/already exists|Duplicate/i.test(uploaded.error.message))success=true;
  }
  if(!success)throw Error('Installer upload failed: '+config.platform+' part '+(index+1));
  const url=client.storage.from(config.bucket).getPublicUrl(part.path).data.publicUrl;
  const check=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
  if(!check.ok||Number(check.headers.get('content-length'))!==body.length)throw Error('Public installer verification failed.');
  parts[index]={url,bytes:body.length,sha256:hash(body)};
  console.log(config.platform+': verified '+(index+1)+'/'+config.parts.length);
 }}
 const results=await Promise.allSettled(Array.from({length:4},()=>worker()));
 if(results.some(result=>result.status==='rejected'))throw Error('Publication failed for '+config.platform+'. Reissue upload grants before retrying.');
 return {platform:config.platform,name:config.name,bytes:data.length,sha256:hash(data),parts};
}
async function main(){
 const configs=['PLAYER_WINDOWS','PLAYER_MAC_ARM64','PLAYER_MAC_X64'].map(key=>JSON.parse(process.env[key]||'null'));
 if(configs.some(config=>!config))throw Error('Short-lived installer upload grants are required.');
 const packages=[];
 for(const config of configs)packages.push(await publish(config));
 fs.writeFileSync('public/downloads/player-releases.json',JSON.stringify({version,packages},null,2)+'\n');
 console.log('All public installer packages verified.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
