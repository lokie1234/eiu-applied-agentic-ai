const fs=require('node:fs'),crypto=require('node:crypto');
require(process.cwd()+'/node_modules/@next/env').loadEnvConfig(process.cwd());
const sodium=require('libsodium-wrappers');
const {headers,base}=require('./player-github.cjs')();
const version=require('../desktop-player/package.json').version;
async function main(){
 await sodium.ready;
 const keyResponse=await fetch(base+'/actions/secrets/public-key',{headers});if(!keyResponse.ok)throw Error('Cannot read repository encryption key: '+keyResponse.status);
 const key=await keyResponse.json();
 const release=await fetch(base+'/releases/tags/player-v'+version,{headers}).then(r=>r.json());
 const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const client=require(process.cwd()+'/node_modules/@supabase/supabase-js').createClient(projectUrl,serviceKey);
 const bucket='lesson-player-installers',partSize=4*1024*1024,nonce=crypto.randomUUID();
 const bucketState=await client.storage.getBucket(bucket);
 if(bucketState.error){const created=await client.storage.createBucket(bucket,{public:true,fileSizeLimit:50*1024*1024,allowedMimeTypes:['application/octet-stream']});if(created.error)throw Error('Unable to create public installer storage.');}
 else if(!bucketState.data.public)throw Error('Refusing to change a private storage bucket.');
 for(const [platform,secret] of [['windows-x64','EIU_PLAYER_UPLOAD_WINDOWS'],['mac-arm64','EIU_PLAYER_UPLOAD_MAC_ARM64'],['mac-x64','EIU_PLAYER_UPLOAD_MAC_X64']]){
  const name='EIU-Lesson-Player-'+version+'-'+platform+'.zip',asset=release.assets.find(a=>a.name===name);if(!asset)throw Error('Missing installer release');
  const config={platform,name,bytes:asset.size,assetUrl:asset.url,projectUrl,publicKey,bucket,partSize,parts:[]};
  const count=Math.ceil(asset.size/partSize);let next=0;
  async function worker(){while(next<count){const index=next++,object=version+'/cloud-'+nonce+'/'+name+'.part'+String(index+1).padStart(3,'0');const granted=await client.storage.from(bucket).createSignedUploadUrl(object);if(granted.error)throw Error('Unable to issue installer-only upload grant');config.parts[index]={path:object,token:granted.data.token};}}
  const results=await Promise.allSettled(Array.from({length:6},()=>worker()));if(results.some(r=>r.status==='rejected'))throw Error('Grant creation failed.');
  const sealed=sodium.crypto_box_seal(sodium.from_string(JSON.stringify(config)),sodium.from_base64(key.key,sodium.base64_variants.ORIGINAL));
  const saved=await fetch(base+'/actions/secrets/'+secret,{method:'PUT',headers,body:JSON.stringify({key_id:key.key_id,encrypted_value:sodium.to_base64(sealed,sodium.base64_variants.ORIGINAL)})});
  if(!saved.ok)throw Error('Unable to save scoped upload grants: '+saved.status);
  console.log('Prepared short-lived, installer-only grants:',platform,count);
 }
 fs.copyFileSync('desktop-player/INSTALL.txt','public/downloads/eiu-lesson-player-install.txt');
 const dispatched=await fetch(base+'/actions/workflows/publish-player.yml/dispatches',{method:'POST',headers,body:JSON.stringify({ref:'main'})});
 if(!dispatched.ok)throw Error('Publication dispatch failed: '+dispatched.status);
 console.log('Publication started. Run node scripts/finish-player-publication.cjs after the workflow completes.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
