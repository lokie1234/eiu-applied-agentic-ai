// Usage: node --env-file=.env.local scripts/apply-live-supabase-migration.cjs
const fs=require('node:fs');
async function main(){
  let token=process.env.SUPABASE_ACCESS_TOKEN;
  if(!token?.startsWith('sbp_'))throw Error('SUPABASE_ACCESS_TOKEN is required.');
  const ref=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const query=fs.readFileSync('supabase/migrations/202611160001_live_presentation_realtime.sql','utf8');
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`Live migration failed (${response.status}): ${await response.text()}`);
  console.log('Applied Live-only Supabase migration.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
