"use client";
import {applyLivePatch,type LiveDocument} from './livePresentationProtocol';
import {diffLiveDocument} from './livePresentationDom';
import {primeLiveRoom,publishLiveDocument,readLiveBackup,endLiveBroadcast,type LiveRoom} from './livePresentationRealtime';
export {readLiveBackup} from './livePresentationRealtime';
type Command={sectionId:string;deviceId:string;epoch:string;sequence?:number;patch?:string};
type Session={args:Command;sequence:number;documentSequence:number;state:LiveDocument|null;document:string;dirty:boolean;stopped:boolean;timer?:ReturnType<typeof setTimeout>;job?:Promise<void>;retry:number};
const sessions=new Map<string,Session>();
async function request(action:string,args:Command,extra:Record<string,unknown>={}){
  const response=await fetch('/api/admin/live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,sectionId:args.sectionId,deviceId:args.deviceId,epoch:args.epoch,...extra}),signal:AbortSignal.timeout(action==='start'?20000:action==='stop'?12000:10000)});
  const result=await response.json();if(!response.ok)throw Error(result.message||'Supabase Live is unavailable.');
  if(result.room!==undefined)primeLiveRoom(args.sectionId,result.room);return result as {room:LiveRoom|null;sequence:number};
}
function install(args:Command,room:LiveRoom|null){
  const value:Session={args,sequence:room?.sequence||0,documentSequence:room?.documentSequence||0,state:room?.document?JSON.parse(room.document):null,document:room?.document||'',dirty:false,stopped:false,retry:10000};sessions.set(args.epoch,value);return value;
}
export async function resumeLiveSession(args:Command){
  if(sessions.has(args.epoch))return;
  const room=await readLiveBackup(args.sectionId).catch(()=>null);
  if(room?.epoch===args.epoch&&room.owner===args.deviceId){primeLiveRoom(args.sectionId,room);install(args,room);}else install(args,null);
}
function schedule(s:Session){if(!s.timer&&!s.stopped)s.timer=setTimeout(()=>{s.timer=undefined;void checkpoint(s).catch(()=>{});},s.retry);}
function adopt(s:Session,state:LiveDocument){
  const delta=diffLiveDocument(s.state,state);
  if(s.state&&!delta.nodes.length&&!delta.removed.length&&s.state.page===state.page&&s.state.width===state.width&&s.state.height===state.height){publishLiveDocument(s.args.sectionId,s.args.deviceId,s.args.epoch,s.documentSequence,state);return;}
  s.state=state;s.documentSequence=++s.sequence;s.dirty=true;
  publishLiveDocument(s.args.sectionId,s.args.deviceId,s.args.epoch,s.documentSequence,state);schedule(s);
}
export function stageLiveDocument(epoch:string,state:LiveDocument){const s=sessions.get(epoch);if(s&&!s.stopped)adopt(s,state);}
async function checkpoint(s:Session):Promise<void>{
  if(s.stopped||!s.dirty)return;if(s.job)return s.job;
  const sequence=++s.sequence,documentSequence=s.documentSequence,document=JSON.stringify(s.state);
  s.job=(async()=>{try{
    await request('update',s.args,{sequence,documentSequence,document});
    if(s.documentSequence===documentSequence)s.dirty=false;s.retry=10000;
  }catch(error){s.retry=Math.min(30000,s.retry*2);throw error;}
  finally{s.job=undefined;if(s.dirty&&!s.stopped)schedule(s);}})();
  return s.job;
}
export async function endLiveSession(sectionId:string){
  const room=await readLiveBackup(sectionId,'',-1,true);if(room?.active)await liveCommand('stop',{sectionId,deviceId:room.owner,epoch:room.epoch});
}
export async function liveCommand(action:'start'|'update'|'stop',args:Command){
  if(action==='start'){
    const result=await request('start',args);install(args,result.room);return {provider:'supabase'};
  }
  let s=sessions.get(args.epoch);if(!s){await resumeLiveSession(args);s=sessions.get(args.epoch)!;}
  if(action==='stop'){
    s.stopped=true;clearTimeout(s.timer);endLiveBroadcast(args.sectionId,args.epoch);
    await request('stop',args);sessions.delete(args.epoch);return {primaryStopped:true,backupStopped:true};
  }
  if(args.patch){
    const document=applyLivePatch(s.state?JSON.stringify(s.state):s.document,args.patch);adopt(s,JSON.parse(document) as LiveDocument);
    return {provider:'supabase'};
  }
  if(s.dirty){clearTimeout(s.timer);s.timer=undefined;await checkpoint(s);}
  else await request('heartbeat',args,{sequence:++s.sequence,documentSequence:s.documentSequence});
  return {provider:'supabase'};
}
