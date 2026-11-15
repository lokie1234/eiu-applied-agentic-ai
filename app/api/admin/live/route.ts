import { requireAdminAccess } from '@/lib/auth/currentUser';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { readLiveState,saveLiveState } from '@/lib/livePresentationState';
import { gunzipSync } from 'node:zlib';

export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
async function authorize(sectionId:string,signal:AbortSignal,adminChecked=false,requireLive=true){
  if(!adminChecked&&!await requireAdminAccess(signal))return false;
  if(!/^[a-f0-9-]{36}$/i.test(sectionId))return false;
  const {data,error}=await getSupabaseAdmin(signal).from('course_sections').select('id,status,content_type,courses(description)').eq('id',sectionId).maybeSingle();
  if(error||data?.status!=='active')return false;
  if(!requireLive)return true;
  let settings:Record<string,boolean>={};
  const course=data.courses as unknown as {description:string|null}|null;
  try{settings=JSON.parse(course?.description||'{}').sectionLive||{};}catch{/* Legacy plain-text course descriptions use the existing default. */}
  return data.content_type==='tsx'&&settings[sectionId]!==false;
}
export async function GET(request:Request){
  try{
    const query=new URL(request.url).searchParams;
    const sectionId=query.get('sectionId')||'',status=query.get('status')==='1';
    if(!await authorize(sectionId,request.signal,false,!status))return Response.json({message:'Administrator section access required.'},{status:403,headers});
    const room=await readLiveState(sectionId,{epoch:query.get('epoch')||'',since:Number(query.get('since')??-1),after:Number(query.get('after')??-1),status},request.signal);
    return Response.json({room}, {headers});
  }catch{return Response.json({message:'Supabase Live backup is unavailable.'},{status:503,headers});}
}
export async function POST(request:Request){
  try{
    if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'Origin denied.'},{status:403,headers});
    if(!await requireAdminAccess(request.signal))return Response.json({message:'Administrator access required.'},{status:403,headers});
    const chunks:Uint8Array[]=[],reader=request.body?.getReader();let total=0;
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1_100_000){await reader.cancel();return Response.json({message:'Live update too large.'},{status:413,headers});}chunks.push(value);}
    const bytes=Buffer.concat(chunks);
    const decoded=request.headers.get('content-encoding')==='gzip'?gunzipSync(bytes,{maxOutputLength:1_100_000}):bytes;
    const body=JSON.parse(decoded.toString('utf8'));
    if(!await authorize(body.sectionId,request.signal,true,body.action!=='stop'))return Response.json({message:'Live is disabled or section access is unavailable.'},{status:403,headers});
    if(!['start','update','heartbeat','stop'].includes(body.action)||![body.deviceId,body.epoch].every(value=>typeof value==='string'&&/^[a-zA-Z0-9-]{16,100}$/.test(value)))return Response.json({message:'Invalid Live command.'},{status:400,headers});
    const room=await saveLiveState(body.sectionId,body.action,body,request.signal);return Response.json({revision:room?.revision||0,sequence:room?.sequence||0,room},{headers});
  }catch(error){return Response.json({message:error instanceof Error?error.message:'Unable to update Live.'},{status:409,headers});}
}
