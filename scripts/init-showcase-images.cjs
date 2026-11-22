// Provision only the private attachment bucket; no learner records are changed.
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const name='learner-showcase-images',bucket=await db.storage.getBucket(name);
 if(bucket.error){
  if(!/not found|does not exist/i.test(bucket.error.message))throw bucket.error;
  const created=await db.storage.createBucket(name,{public:false,fileSizeLimit:1024*1024,allowedMimeTypes:['image/webp']});if(created.error)throw created.error;
 }
 const verified=await db.storage.getBucket(name);if(verified.error)throw verified.error;
 if(verified.data.public!==false||Number(verified.data.file_size_limit)!==1024*1024||!verified.data.allowed_mime_types?.includes('image/webp'))throw Error('The attachment bucket settings do not match the private WebP policy.');
 console.log('Private showcase image bucket verified: WebP only, maximum 1 MB per stored image.');
 if(process.argv.includes('--smoke')){
  const bytes=await require('sharp')({create:{width:16,height:16,channels:3,background:'#144069'}}).webp().toBuffer();
  const path=`_verification/${require('node:crypto').randomUUID()}.webp`;
  try{
   const saved=await db.storage.from(name).upload(path,bytes,{contentType:'image/webp',upsert:false});if(saved.error)throw saved.error;
   const read=await db.storage.from(name).download(path);if(read.error)throw read.error;
   if(!bytes.equals(Buffer.from(await read.data.arrayBuffer())))throw Error('Stored image bytes differ.');
   const publicUrl=db.storage.from(name).getPublicUrl(path).data.publicUrl;
   if((await fetch(publicUrl)).ok)throw Error('Private image was publicly accessible.');
   const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
   if(!publishable)throw Error('Browser publishable key is required to verify storage isolation.');
   const anonymous=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
   if(!(await anonymous.storage.from(name).download(path)).error)throw Error('Browser credentials could directly download private images.');
   console.log('Synthetic image roundtrip passed; anonymous public access denied. No learner submission created.');
  }finally{
   const removed=await db.storage.from(name).remove([path]);if(removed.error)throw removed.error;
   const retry=await db.storage.from(name).remove([path]);if(retry.error)throw retry.error;
   console.log('Repeated removal of the absent synthetic image is safe for deletion retries.');
  }
 }
}
main().catch(error=>{console.error(error.message||'Unable to initialize image storage.');process.exitCode=1;});
