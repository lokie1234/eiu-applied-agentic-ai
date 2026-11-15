"use client";
import type {RealtimeChannel} from '@supabase/supabase-js';
import {getSupabaseBrowserClient} from './supabase/browser';
import {applyLivePatch,type LiveDocument} from './livePresentationProtocol';
import {diffLiveDocument} from './livePresentationDom';

export type LiveRoom={owner:string;epoch:string;active:boolean;topic:string;expiresAt:number;sequence:number;documentSequence:number;revision:number;updatedAt:number;document?:string};
type Peer={id:string;offer:string;answer?:string;updatedAt:number};
export type LivePeerRoom={owner:string;epoch:string;peers:Peer[]}|null;
type Publisher={deviceId:string;epoch:string;sequence:number;state:LiveDocument;sent:LiveDocument|null;sentSequence:number;resetVersion:number};
type Entry={id:string;room:LiveRoom|null;generation:number;document:string;docSequence:number;channel:RealtimeChannel|null;topic:string;ready:boolean;refs:number;loading:boolean;stopped:boolean;
  rooms:Set<(room:LiveRoom|null)=>void>;documents:Set<(document:string)=>void>;peers:Set<(room:LivePeerRoom)=>void>;connections:Set<()=>void>;errors:Set<(error:Error)=>void>;
  offers:Map<string,Peer>;publisher?:Publisher;timer?:ReturnType<typeof setTimeout>;sendTimer?:ReturnType<typeof setTimeout>;sending:boolean;
  packets:Map<string,{parts:string[];total:number;size:number;sequence:number;baseSequence:number}>};
const entries=new Map<string,Entry>();
function entry(id:string){let current=entries.get(id);if(!current){current={id,room:null,generation:0,document:'',docSequence:-1,channel:null,topic:'',ready:false,refs:0,loading:false,stopped:false,rooms:new Set(),documents:new Set(),peers:new Set(),connections:new Set(),errors:new Set(),offers:new Map(),sending:false,packets:new Map()};entries.set(id,current);}return current;}
function ready(e:Entry,value:boolean){if(e.ready!==value){e.ready=value;e.connections.forEach(callback=>callback());}}
function peers(e:Entry){const room=e.room?.active?{owner:e.room.owner,epoch:e.room.epoch,peers:[...e.offers.values()]}:null;e.peers.forEach(callback=>callback(room));}
function show(e:Entry,document:string,sequence:number){if(sequence<e.docSequence)return;e.document=document;e.docSequence=sequence;e.documents.forEach(callback=>callback(document));}
function send(e:Entry,event:string,payload:unknown){if(!e.channel||!e.ready)return Promise.resolve(false);return e.channel.send({type:'broadcast',event,payload},{timeout:2000}).then(result=>result==='ok').catch(()=>false);}

async function flush(e:Entry){
  if(e.sending||!e.ready||!e.publisher||e.stopped)return;
  const publisher=e.publisher,state=publisher.state,sequence=publisher.sequence,topic=e.topic,resetVersion=publisher.resetVersion;
  const patch=diffLiveDocument(publisher.sent,state);
  if(!patch.nodes.length&&!patch.removed.length&&publisher.sent?.page===state.page&&publisher.sent?.width===state.width&&publisher.sent?.height===state.height)return;
  e.sending=true;
  try{
    const encoded=JSON.stringify(patch),id=crypto.randomUUID(),total=Math.ceil(encoded.length/60000);
    const sent=await Promise.all(Array.from({length:total},(_,part)=>send(e,'visual',{id,epoch:publisher.epoch,owner:publisher.deviceId,sequence,baseSequence:publisher.sentSequence,part,total,data:encoded.slice(part*60000,(part+1)*60000)})));
    if(sent.every(Boolean)&&e.publisher===publisher&&e.topic===topic&&publisher.resetVersion===resetVersion){publisher.sent=state;publisher.sentSequence=sequence;}
    else publisher.sent=null;
  }finally{e.sending=false;if(e.ready&&e.publisher&&(e.publisher.state!==state||!e.publisher.sent)&&!e.sendTimer)e.sendTimer=setTimeout(()=>{e.sendTimer=undefined;void flush(e);},200);}
}
function packet(e:Entry,value:unknown){
  if(!value||typeof value!=='object')return;
  const p=value as {id:string;owner:string;epoch:string;sequence:number;baseSequence:number;part:number;total:number;data:string};
  if(!e.room?.active||p.owner!==e.room.owner||p.epoch!==e.room.epoch||!Number.isSafeInteger(p.sequence)||p.sequence<=e.docSequence||typeof p.id!=='string'||p.id.length>50||!Number.isInteger(p.part)||!Number.isInteger(p.total)||p.total<1||p.total>32||p.part<0||p.part>=p.total||typeof p.data!=='string'||p.data.length>60000)return;
  let buffer=e.packets.get(p.id);
  if(!buffer){if(e.packets.size>=2)e.packets.clear();buffer={parts:[],total:p.total,size:0,sequence:p.sequence,baseSequence:p.baseSequence};e.packets.set(p.id,buffer);}
  if(buffer.sequence!==p.sequence||buffer.total!==p.total||buffer.parts[p.part]!==undefined)return;
  buffer.parts[p.part]=p.data;buffer.size+=p.data.length;
  if(buffer.size>900000){e.packets.delete(p.id);return;}
  if(buffer.parts.filter(value=>value!==undefined).length!==buffer.total)return;
  e.packets.delete(p.id);
  try{const patch=buffer.parts.join('');if(!JSON.parse(patch).reset&&buffer.baseSequence!==e.docSequence)throw Error('Missing visual delta');show(e,applyLivePatch(e.document,patch),p.sequence);}catch{void send(e,'resync',{epoch:e.room.epoch});}
}
function signal(e:Entry,value:unknown){
  if(!value||typeof value!=='object')return;
  const p=value as {epoch:string;kind:string;deviceId:string;peerId:string;sdp?:string};
  if(!e.room?.active||p.epoch!==e.room.epoch||!['offer','answer','leave'].includes(p.kind)||!/^[a-zA-Z0-9-]{16,100}$/.test(p.peerId)||typeof p.deviceId!=='string'||p.sdp!==undefined&&(typeof p.sdp!=='string'||p.sdp.length>20000))return;
  const previous=e.offers.get(p.peerId);
  if(p.kind==='answer'){if(p.deviceId!==e.room.owner||!previous)return;previous.answer=p.sdp||'';previous.updatedAt=Date.now();}
  else if(p.kind==='leave')e.offers.delete(p.peerId);
  else{if(!previous&&e.offers.size>=4){const oldest=[...e.offers.values()].sort((a,b)=>a.updatedAt-b.updatedAt)[0];if(Date.now()-oldest.updatedAt<60000)return;e.offers.delete(oldest.id);}e.offers.set(p.peerId,{id:p.peerId,offer:p.sdp||'',updatedAt:Date.now()});}
  peers(e);
}
function closeChannel(e:Entry){const channel=e.channel;e.channel=null;e.topic='';ready(e,false);if(channel){const client=getSupabaseBrowserClient();if(client)void client.removeChannel(channel);}}
function connect(e:Entry){
  const room=e.room;if(!e.refs||!room?.active||room.expiresAt<Date.now()){if(!room?.active)closeChannel(e);return;}
  if(e.channel&&e.topic===room.topic)return;
  closeChannel(e);
  const client=getSupabaseBrowserClient();if(!client)return;
  const topic=room.topic;e.topic=topic;
  const channel=client.channel(topic,{config:{private:true,broadcast:{ack:true,self:false}}});e.channel=channel;
  channel.on('broadcast',{event:'visual'},({payload})=>{if(e.topic===topic)packet(e,payload);})
    .on('broadcast',{event:'peer'},({payload})=>{if(e.topic===topic)signal(e,payload);})
    .on('broadcast',{event:'resync'},()=>{if(e.topic!==topic)return;if(e.publisher){e.publisher.sent=null;e.publisher.resetVersion++;void flush(e);}for(const offer of e.offers.values())void send(e,'peer',{epoch:e.room?.epoch,deviceId:'peer-resync-device',peerId:offer.id,kind:'offer',sdp:offer.offer});})
    .on('broadcast',{event:'ended'},({payload})=>{if(e.topic===topic&&payload?.epoch===e.room?.epoch){e.room={...e.room!,active:false};e.rooms.forEach(callback=>callback(e.room));closeChannel(e);}})
    .subscribe(status=>{
      if(e.channel!==channel)return;
      ready(e,status==='SUBSCRIBED');
      if(status==='SUBSCRIBED'){if(e.publisher){e.publisher.sent=null;e.publisher.resetVersion++;void flush(e);}void send(e,'resync',{epoch:e.room?.epoch});}
    });
}
export function primeLiveRoom(sectionId:string,room:LiveRoom|null){
  const e=entry(sectionId);e.generation++;
  if(e.room?.epoch!==room?.epoch){e.document='';e.docSequence=-1;e.offers.clear();e.packets.clear();if(e.publisher?.epoch!==room?.epoch)e.publisher=undefined;}
  e.room=room;
  if(room?.document&&room.documentSequence>=e.docSequence){try{const state=JSON.parse(room.document) as LiveDocument;show(e,applyLivePatch('',JSON.stringify({...state,reset:true,removed:[]})),room.documentSequence);}catch{/* A later broadcast reset or checkpoint repairs malformed state. */}}
  connect(e);e.rooms.forEach(callback=>callback(room));peers(e);
}
export async function readLiveBackup(sectionId:string,epoch='',revision=-1,status=false,after=-1){
  const response=await fetch(`/api/admin/live?sectionId=${encodeURIComponent(sectionId)}&epoch=${encodeURIComponent(epoch)}&since=${revision}&after=${after}${status?'&status=1':''}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Supabase Live is unavailable.');return (await response.json()).room as LiveRoom|null;
}
async function refresh(e:Entry){
  if(e.loading||e.stopped)return;e.loading=true;const generation=e.generation;
  try{let room=await readLiveBackup(e.id,e.room?.epoch,e.room?.revision,false,e.document||e.publisher?e.docSequence:-1);if(e.stopped||generation!==e.generation)return;
    if(room?.active&&room.revision>0&&!e.document&&!e.publisher&&!room.document)room=await readLiveBackup(e.id);
    if(!e.stopped&&generation===e.generation)primeLiveRoom(e.id,room);
  }catch(error){if(!e.stopped)e.errors.forEach(callback=>callback(error instanceof Error?error:Error('Supabase Live is unavailable.')));}
  finally{e.loading=false;if(!e.stopped&&e.refs){clearTimeout(e.timer);e.timer=setTimeout(()=>void refresh(e),e.ready?6000:1500);}}
}
function retain(e:Entry){e.refs++;e.stopped=false;if(e.refs===1){connect(e);void refresh(e);}return()=>{e.refs--;if(!e.refs){e.stopped=true;clearTimeout(e.timer);clearTimeout(e.sendTimer);e.sendTimer=undefined;closeChannel(e);}};}
export function liveRealtimeReady(sectionId:string){return entry(sectionId).ready;}
export function watchLiveRealtimeReady(sectionId:string,callback:()=>void){const e=entry(sectionId);e.connections.add(callback);const release=retain(e);return()=>{e.connections.delete(callback);release();};}
export function watchLivePresentation(sectionId:string,callback:(room:LiveRoom|null)=>void,onError?:(error:Error)=>void){const e=entry(sectionId);e.rooms.add(callback);if(onError)e.errors.add(onError);const release=retain(e);if(e.room)callback(e.room);return()=>{e.rooms.delete(callback);if(onError)e.errors.delete(onError);release();};}
export function watchLiveDocument(sectionId:string,callback:(document:string)=>void){const e=entry(sectionId);e.documents.add(callback);const release=retain(e);if(e.document)callback(e.document);return()=>{e.documents.delete(callback);release();};}
export function watchLivePeers(sectionId:string,callback:(room:LivePeerRoom)=>void){const e=entry(sectionId);e.peers.add(callback);const release=retain(e);peers(e);return()=>{e.peers.delete(callback);release();};}
export async function signalLivePeer(args:{sectionId:string;epoch:string;deviceId:string;peerId:string;kind:'offer'|'answer'|'leave';sdp?:string}){
  const e=entry(args.sectionId);signal(e,args);
  // SDP can be ready just before the channel subscription completes.
  const until=Date.now()+5000;while(!e.ready&&!e.stopped&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
  if(!await send(e,'peer',args))throw Error('Live signaling is reconnecting.');
}
export function publishLiveDocument(sectionId:string,deviceId:string,epoch:string,sequence:number,state:LiveDocument){
  const e=entry(sectionId);if(e.room?.owner!==deviceId||e.room.epoch!==epoch||!e.room.active)return;
  if(!e.publisher)e.publisher={deviceId,epoch,sequence,state,sent:null,sentSequence:-1,resetVersion:0};else{e.publisher.sequence=sequence;e.publisher.state=state;}
  // The presenter already owns the native frame. Avoid serializing its embedded
  // fonts again on every capture just to notify an empty local subscriber set.
  if(e.documents.size)show(e,JSON.stringify(state),sequence);else e.docSequence=Math.max(e.docSequence,sequence);
  if(!e.sendTimer)e.sendTimer=setTimeout(()=>{e.sendTimer=undefined;void flush(e);},100);
}
export function endLiveBroadcast(sectionId:string,epoch:string){const e=entry(sectionId);void send(e,'ended',{epoch});e.publisher=undefined;}
export async function readLivePresentation(sectionId:string){const room=await readLiveBackup(sectionId);if(room)primeLiveRoom(sectionId,room);return room;}
