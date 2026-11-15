import 'server-only';
import { getSupabaseAdmin } from './supabase/server';
import { applyLivePatch, type LiveDocument } from './livePresentationProtocol';

const bucket = 'admin-live-presentations';
export type BackupRoom = { owner:string;epoch:string;revision:number;sequence:number;updatedAt:number;active:boolean;document:string };
type Lease = { owner:string;epoch:string };
// A short read cache only; the private lease upload remains the cross-instance authority.
const readCache=new Map<string,{expires:number;value:unknown}>();
function remember(path:string,value:unknown){if(readCache.size>=32)readCache.delete(readCache.keys().next().value!);readCache.set(path,{expires:Date.now()+1500,value});}
export async function liveBackup(sectionId:string, action:'view'|'start'|'update'|'stop', input:{deviceId?:string;epoch?:string;sequence?:number;document?:string}, signal?:AbortSignal) {
  const storage = getSupabaseAdmin(signal).storage;
  const files=storage.from(bucket),leasePath=`${sectionId}/lease.json`;
  const read=async<T>(path:string,fresh=false):Promise<T|null>=>{const cached=readCache.get(path);if(!fresh&&cached&&cached.expires>Date.now())return structuredClone(cached.value) as T;const {data,error}=await files.download(path);if(error){if(/not found|does not exist/i.test(error.message)||String(error.status)==='404'){remember(path,null);return null;}throw new Error('Supabase Live storage unavailable.');}const value=JSON.parse(await data.text()) as T;remember(path,value);return value;};
  const write=async(path:string,value:unknown,upsert:boolean)=>{const result=await files.upload(path,Buffer.from(JSON.stringify(value)),{contentType:'application/json',upsert,cacheControl:'0'});if(result.error)throw new Error(result.error.message);remember(path,value);};
  if(action==='start'){
    const created=await storage.createBucket(bucket,{public:false,fileSizeLimit:2_000_000,allowedMimeTypes:['application/json']});
    if(created.error&&!/already exists|duplicate/i.test(created.error.message))throw new Error('Unable to initialize private Live backup.');
    const configured=await storage.getBucket(bucket);if(configured.error||configured.data?.public!==false)throw new Error('Live backup requires a private storage bucket.');
    const lease:Lease={owner:input.deviceId!,epoch:input.epoch!};
    let acquired=true;
    try{await write(leasePath,lease,false);}catch{
      acquired=false;const existing=await read<Lease>(leasePath,true);
      if(existing?.owner!==lease.owner||existing.epoch!==lease.epoch)throw new Error('Another device controls Live. Stop its Live session before starting a new controller.');
    }
    const room:BackupRoom={...lease,revision:0,sequence:0,updatedAt:Date.now(),active:true,document:''};
    const previous=acquired?null:await read<BackupRoom>(`${sectionId}/${lease.epoch}.json`);
    if(!previous)await write(`${sectionId}/${lease.epoch}.json`,room,true);
    return previous||room;
  }
  const lease=await read<Lease>(leasePath,action==='stop');if(!lease){if(action==='update')throw new Error('Live backup has not started.');return null;}
  const path=`${sectionId}/${lease.epoch}.json`;
  if(action==='view')return read<BackupRoom>(path);
  if(lease.owner!==input.deviceId||lease.epoch!==input.epoch)throw new Error('This device no longer owns Live.');
  if(action==='stop'){
    const removed=await files.remove([leasePath,path]);if(removed.error)throw new Error('Unable to release Live backup.');readCache.delete(leasePath);readCache.delete(path);return null;
  }
  const room=await read<BackupRoom>(path);
  if(!room)throw new Error('Live backup has not started.');
  if(!Number.isSafeInteger(input.sequence)||input.sequence!<=room.sequence)return room;
  if(Date.now()-room.updatedAt<60)throw new Error('Live backup updates are too frequent.');
  if(input.document){const document=JSON.parse(input.document) as LiveDocument;applyLivePatch('',JSON.stringify({...document,reset:true,removed:[]}));}
  const next={...room,document:input.document||room.document,sequence:input.sequence!,revision:room.revision+1,updatedAt:Date.now()};await write(path,next,true);return next;
}
