"use client";
import { livePresentationCommand as convexCommand, readLivePresentation, readLiveRoom, realtimeReady } from './realtime/client';
import { applyLivePatch, type LiveDocument } from './livePresentationProtocol';
type Command = {sectionId:string;deviceId:string;epoch:string;sequence?:number;patch?:string};
type Session = {document:string;latest?:string;checkpoint?:()=>Promise<void>;sequence:number;backupSequence:number;backupStarted:boolean;primaryStarted:boolean;provider:'convex'|'supabase';writing:boolean;job?:Promise<void>;timer?:ReturnType<typeof setTimeout>;stopped:boolean};
const sessions=new Map<string,Session>();
export async function endLiveSession(sectionId:string){
  const results=await Promise.allSettled([readLiveBackup(sectionId),readLiveRoom(sectionId)]);
  const owners=new Map<string,{owner:string;epoch:string}>();
  for(const result of results)if(result.status==='fulfilled'&&result.value)owners.set(result.value.epoch,result.value);
  if(!owners.size&&results.every(result=>result.status==='rejected'))throw new Error('Chưa kiểm tra được phiên Live. Hãy thử lại.');
  for(const room of owners.values()){
    const stopped=await liveCommand('stop',{sectionId,deviceId:room.owner,epoch:room.epoch}) as {primaryStopped:boolean;backupStopped:boolean};
    if(results[0].status==='fulfilled'&&results[0].value?.epoch===room.epoch&&!stopped.backupStopped)throw new Error('Chưa giải phóng được phiên dự phòng. Hãy thử kết thúc phiên cũ lần nữa.');
    if(results[1].status==='fulfilled'&&results[1].value?.active&&results[1].value.epoch===room.epoch&&!stopped.primaryStopped)throw new Error('Chưa kết thúc được phiên điều khiển. Hãy thử lại.');
  }
}
export function stageLiveDocument(epoch:string,state:LiveDocument){
  const current=sessions.get(epoch);if(!current||current.stopped)return;
  current.latest=JSON.stringify(state);current.sequence++;
  // Capture can continue while a server request is still awaiting its deadline.
  if(current.checkpoint&&!current.timer)current.timer=setTimeout(()=>{current.timer=undefined;void current.checkpoint?.().catch(()=>{});},450);
}
export async function resumeLiveSession(args:Command){
  if(sessions.has(args.epoch))return;
  let sequence=0,document='',backupStarted=false;
  try{const room=await readLiveBackup(args.sectionId);if(room?.epoch===args.epoch&&room.owner===args.deviceId&&room.active){sequence=room.sequence;document=room.document||'';backupStarted=true;}}
  catch{try{const room=await readLivePresentation(args.sectionId);if(room?.epoch===args.epoch){sequence=room.sequence;document=room.document;}}catch{/* The transport will report a connection failure on publish. */}}
  sessions.set(args.epoch,{sequence,document,backupSequence:sequence,backupStarted,primaryStarted:false,provider:'convex',writing:false,stopped:false});
}
async function primary(action:'start'|'update'|'stop',args:Command){
  let timer:ReturnType<typeof setTimeout>;
  try{return await Promise.race([convexCommand(action,args),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Convex response timed out')),action==='start'?2500:1200);})]);}finally{clearTimeout(timer!);}
}
async function backup(action:string,args:Command,document?:string){
  const encoded=JSON.stringify({...args,action,document,patch:undefined});
  const response=await fetch('/api/admin/live',{method:'POST',headers:{'Content-Type':'application/json'},body:encoded,signal:AbortSignal.timeout(action==='start'?20000:action==='stop'?12000:6000)});
  const result=await response.json();if(!response.ok)throw new Error(result.message||'Live backup unavailable.');return result;
}
export async function liveCommand(action:'start'|'update'|'stop',args:Command){
  let session=sessions.get(args.epoch);
  if(action==='start'){
    session={document:'',sequence:0,backupSequence:0,backupStarted:false,primaryStarted:false,provider:'convex',writing:false,stopped:false};sessions.set(args.epoch,session);
    // New controllers require the private lease. Existing streams can survive a backup outage.
    await backup('start',args);session.backupStarted=true;
    try{await primary('start',args);session.primaryStarted=true;return {provider:'convex'};}catch(error){
      if(error instanceof Error&&/Another device/.test(error.message)){if(session.backupStarted)await backup('stop',args).catch(()=>{});throw error;}
      if(!session.backupStarted)throw error;session.provider='supabase';return {provider:'supabase'};
    }
  }
  if(!session){session={document:'',sequence:0,backupSequence:0,backupStarted:false,primaryStarted:false,provider:'convex',writing:false,stopped:false};sessions.set(args.epoch,session);}
  const current=session;
  const checkpoint=async()=>{
    if(current.stopped)return;
    if(current.writing){await current.job?.catch(()=>{});if(current.backupSequence<current.sequence)return checkpoint();return;}
    current.writing=true;
    let sequence=current.sequence,document=current.latest||current.document;
    current.job=(async()=>{
      if(!current.backupStarted){const resumed=await backup('start',args);if(typeof resumed.sequence==='number')sequence=current.sequence=Math.max(sequence,current.sequence,resumed.sequence+1);document=current.latest||current.document;current.backupStarted=true;}
      await backup('update',{...args,sequence},document);current.backupSequence=sequence;
    })().finally(()=>{current.writing=false;});
    return current.job;
  };
  current.checkpoint=checkpoint;
  if(action==='stop'){
    current.stopped=true;if(current.timer)clearTimeout(current.timer);
    const results=await Promise.allSettled([primary('stop',args),backup('stop',args)]);sessions.delete(args.epoch);if(results.every(result=>result.status==='rejected'))throw new Error('Chưa thể kết thúc Live. Kiểm tra kết nối và thử lại.');return {primaryStopped:results[0].status==='fulfilled',backupStopped:results[1].status==='fulfilled'};
  }
  if(args.patch)current.document=applyLivePatch(current.document,args.patch);
  let sequence=++current.sequence;
  let patch=args.patch||'';
  if(current.provider==='supabase'&&current.document)patch=JSON.stringify({...JSON.parse(current.document) as LiveDocument,reset:true,removed:[]});
  try{
    if(!realtimeReady())throw new Error('Convex disconnected');
    if(!current.primaryStarted){const resumed=await primary('start',args);if(typeof resumed?.sequence==='number')sequence=current.sequence=Math.max(sequence,current.sequence,resumed.sequence+1);if(current.latest)patch=JSON.stringify({...JSON.parse(current.latest) as LiveDocument,reset:true,removed:[]});current.primaryStarted=true;}
    const result=await primary('update',{...args,sequence,patch});current.provider='convex';
    if(!current.timer)current.timer=setTimeout(()=>{current.timer=undefined;void checkpoint().catch(()=>{/* Convex remains the available transport. */});},450);
    return result;
  }catch(error){
    console.warn('Live primary transport unavailable:',error instanceof Error?error.message:'connection error');
    if(error instanceof Error&&/no longer controls|Another device/.test(error.message))throw error;
    // The same epoch/device writes the private backup; no action is replayed.
    if(current.timer){clearTimeout(current.timer);current.timer=undefined;}
    await checkpoint();current.provider='supabase';return {provider:'supabase'};
  }
}

export async function readLiveBackup(sectionId:string,epoch='',revision=-1){
  const response=await fetch(`/api/admin/live?sectionId=${encodeURIComponent(sectionId)}&epoch=${encodeURIComponent(epoch)}&since=${revision}`,{cache:'no-store',signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('Supabase backup unavailable.');return (await response.json()).room as {owner:string;epoch:string;revision:number;sequence:number;updatedAt:number;active:boolean;document?:string}|null;
}
