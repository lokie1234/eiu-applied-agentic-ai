import 'server-only';
import {createHmac} from 'node:crypto';
import {getSupabaseAdmin} from './supabase/server';
import {liveBackup} from './livePresentationBackup';
import {applyLivePatch,type LiveDocument} from './livePresentationProtocol';

export type LiveState={owner:string;epoch:string;active:boolean;topic:string;expiresAt:number;sequence:number;documentSequence:number;revision:number;updatedAt:number;document?:string};
const columns='owner,epoch,active,topic,expires_at,sequence,document_sequence,revision,updated_at';
type Row={owner:string;epoch:string;active:boolean;topic:string;expires_at:string;sequence:number;document_sequence:number;revision:number;updated_at:string;document?:string};
const convert=(row:Row):LiveState=>({owner:row.owner,epoch:row.epoch,active:row.active,topic:row.topic,expiresAt:Date.parse(row.expires_at),sequence:row.sequence,documentSequence:row.document_sequence,revision:row.revision,updatedAt:Date.parse(row.updated_at),...(row.document!==undefined?{document:row.document}:{})});
function grant(sectionId:string,epoch:string){
  const secret=process.env.PASSCODE_SESSION_SECRET||process.env.SUPABASE_SECRET_KEY;
  if(!secret)throw Error('Live channel secret is not configured.');
  const bucket=Math.floor(Date.now()/120000);
  return {topic:'eiu-live-v2:'+createHmac('sha256',secret).update(`${sectionId}:${epoch}:${bucket}`).digest('hex'),expires:new Date((bucket+1)*120000+30000).toISOString()};
}
async function rpc(name:string,args:Record<string,unknown>,signal?:AbortSignal){
  const {data,error}=await getSupabaseAdmin(signal).rpc(name,args);if(error)throw Error(error.message);return data as Row;
}
async function metadata(sectionId:string,signal?:AbortSignal){
  const {data,error}=await getSupabaseAdmin(signal).from('live_presentation_rooms').select(columns).eq('section_id',sectionId).maybeSingle();
  if(error)throw Error(error.message);return data?convert(data as unknown as Row):null;
}
export async function readLiveState(sectionId:string,options:{epoch?:string;since?:number;status?:boolean;after?:number}={},signal?:AbortSignal):Promise<LiveState|null>{
  let room=await metadata(sectionId,signal);
  // One-time upgrade of an existing private Storage lease; no learner history is migrated.
  if(!room){
    const legacy=await getSupabaseAdmin(signal).storage.from('admin-live-presentations').list(sectionId,{limit:10,search:'lease.json'});
    const old=legacy.data?.some(file=>file.name==='lease.json')?await liveBackup(sectionId,'view',{},signal):null;
    if(old?.active){
      const credentials=grant(sectionId,old.epoch);
      await rpc('live_presentation_claim',{p_section:sectionId,p_owner:old.owner,p_epoch:old.epoch,p_topic:credentials.topic,p_expires:credentials.expires},signal);
      if(old.document)await saveLiveState(sectionId,'update',{deviceId:old.owner,epoch:old.epoch,sequence:Math.max(1,old.sequence),documentSequence:Math.max(1,old.sequence),document:old.document},signal);
      room=await metadata(sectionId,signal);
    }
  }
  if(!room||!room.active||options.status||options.epoch===room.epoch&&(options.since===room.revision||room.documentSequence<=(options.after??-1)))return room;
  const {data,error}=await getSupabaseAdmin(signal).from('live_presentation_rooms').select(columns+',document').eq('section_id',sectionId).maybeSingle();
  if(error)throw Error(error.message);return data?convert(data as unknown as Row):null;
}
type Input={deviceId:string;epoch:string;sequence?:number;documentSequence?:number;document?:string};
export async function saveLiveState(sectionId:string,action:'start'|'update'|'heartbeat'|'stop',input:Input,signal?:AbortSignal):Promise<LiveState|null>{
  if(action==='stop'){
    await rpc('live_presentation_stop',{p_section:sectionId,p_owner:input.deviceId,p_epoch:input.epoch},signal);
    // Release a pre-migration Storage lease too, when it belongs to this owner.
    await liveBackup(sectionId,'stop',input,signal).catch(()=>{});
    return null;
  }
  const credentials=grant(sectionId,input.epoch);
  if(action==='start'){
    await readLiveState(sectionId,{status:true},signal);
    return convert(await rpc('live_presentation_claim',{p_section:sectionId,p_owner:input.deviceId,p_epoch:input.epoch,p_topic:credentials.topic,p_expires:credentials.expires},signal));
  }
  if(!Number.isSafeInteger(input.sequence)||input.sequence!<1)throw Error('Invalid Live sequence.');
  let document:string|null=null;
  if(action==='update'&&input.document){
    const state=JSON.parse(input.document) as LiveDocument;
    document=applyLivePatch('',JSON.stringify({...state,reset:true,removed:[]}));
  }
  return convert(await rpc('live_presentation_save',{p_section:sectionId,p_owner:input.deviceId,p_epoch:input.epoch,p_sequence:input.sequence,p_document_sequence:input.documentSequence??input.sequence,p_document:document,p_topic:credentials.topic,p_expires:credentials.expires},signal));
}
