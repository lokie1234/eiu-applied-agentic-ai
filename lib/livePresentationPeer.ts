"use client";
import { signalLivePeer, watchLivePeers } from './livePresentationRealtime';
import { applyLivePatch, type LiveDocument } from './livePresentationProtocol';
import { diffLiveDocument } from './livePresentationDom';

async function gathered(peer:RTCPeerConnection){
  if(peer.iceGatheringState==='complete')return;
  await new Promise<void>(resolve=>{const timeout=setTimeout(done,1800);function done(){clearTimeout(timeout);peer.removeEventListener('icegatheringstatechange',changed);resolve();}function changed(){if(peer.iceGatheringState==='complete')done();}peer.addEventListener('icegatheringstatechange',changed);});
}
// Host candidates keep same-network traffic direct without sending data to a STUN/TURN service.
// Other networks transparently continue through the authenticated server transports.
export function createLivePeerController(sectionId:string,deviceId:string,epoch:string){
  const connections=new Map<string,{peer:RTCPeerConnection;offer:string;channel?:RTCDataChannel;previous:LiveDocument|null}>();let latest:LiveDocument|null=null,closed=false,message=0;
  const send=(entry:{channel?:RTCDataChannel;previous:LiveDocument|null})=>{
    const channel=entry.channel;if(!latest||channel?.readyState!=='open'||channel.bufferedAmount>256000)return;
    const patch=diffLiveDocument(entry.previous,latest);if(!patch.nodes.length&&!patch.removed.length&&entry.previous?.width===latest.width&&entry.previous?.height===latest.height)return;
    const encoded=JSON.stringify(patch),total=Math.ceil(encoded.length/12000),id=++message;
    for(let part=0;part<total;part++)channel.send(JSON.stringify({id,part,total,data:encoded.slice(part*12000,(part+1)*12000)}));
    entry.previous=latest;
  };
  const stop=typeof RTCPeerConnection==='undefined'?()=>{}:watchLivePeers(sectionId,room=>{
    if(!room||room.epoch!==epoch||room.owner!==deviceId)return;
    for(const [id,entry]of connections)if(!room.peers.some(peer=>peer.id===id)){entry.peer.close();connections.delete(id);}
    for(const offer of room.peers){const old=connections.get(offer.id);if(old?.offer===offer.offer)continue;if(old){old.peer.close();connections.delete(offer.id);}
      const peer=new RTCPeerConnection({iceServers:[]}),entry:{peer:RTCPeerConnection;offer:string;channel?:RTCDataChannel;previous:LiveDocument|null}={peer,offer:offer.offer,previous:null};connections.set(offer.id,entry);
      peer.ondatachannel=event=>{entry.channel=event.channel;event.channel.onopen=()=>send(entry);};
      void(async()=>{try{await peer.setRemoteDescription({type:'offer',sdp:offer.offer});await peer.setLocalDescription(await peer.createAnswer());await gathered(peer);if(!closed)await signalLivePeer({sectionId,deviceId,epoch,peerId:offer.id,kind:'answer',sdp:peer.localDescription!.sdp});}catch{peer.close();connections.delete(offer.id);}})();
    }
  });
  return {publish(state:LiveDocument){latest=state;for(const entry of connections.values())send(entry);},close(){closed=true;stop();for(const entry of connections.values())entry.peer.close();connections.clear();}};
}
export function createLivePeerFollower(sectionId:string,deviceId:string,onDocument:(document:string)=>void,onConnection:(connected:boolean)=>void){
  let peer:RTCPeerConnection|null=null,epoch='',closed=false,document='',connected=false;const peerId=crypto.randomUUID();let stop=()=>{};
  if(typeof RTCPeerConnection==='undefined')return {close(){}};
  const buffers=new Map<number,{parts:string[];total:number;bytes:number}>();
  stop=watchLivePeers(sectionId,room=>{
    if(closed)return;
    if(!room){peer?.close();peer=null;onConnection(false);return;}
    if(epoch!==room.epoch){peer?.close();peer=null;epoch=room.epoch;document='';buffers.clear();}
    if(!peer){
      peer=new RTCPeerConnection({iceServers:[]});const current=peer,channel=peer.createDataChannel('presentation',{ordered:true});
      const disconnected=()=>{if(peer!==current)return;peer=null;connected=false;buffers.clear();document='';current.close();onConnection(false);};
      channel.onopen=()=>{connected=true;onConnection(true);};channel.onclose=disconnected;channel.onerror=disconnected;
      current.onconnectionstatechange=()=>{if(current.connectionState==='failed')disconnected();};
      channel.onmessage=event=>{try{
        const packet=JSON.parse(event.data);if(!Number.isInteger(packet.id)||!Number.isInteger(packet.part)||!Number.isInteger(packet.total)||packet.total<1||packet.total>100||packet.part<0||packet.part>=packet.total||typeof packet.data!=='string'||packet.data.length>12000)throw Error('Invalid packet');
        let buffer=buffers.get(packet.id);if(!buffer){if(buffers.size>2)buffers.clear();buffer={parts:[],total:packet.total,bytes:0};buffers.set(packet.id,buffer);}if(buffer.parts[packet.part]!==undefined)return;buffer.parts[packet.part]=packet.data;buffer.bytes+=packet.data.length;if(buffer.bytes>900000)throw Error('Oversized packet');
        if(buffer.parts.filter(Boolean).length===buffer.total){document=applyLivePatch(document,buffer.parts.join(''));buffers.delete(packet.id);onDocument(document);}
      }catch{channel.close();onConnection(false);}};
      void(async()=>{try{await current.setLocalDescription(await current.createOffer());await gathered(current);if(!closed&&peer===current)await signalLivePeer({sectionId,deviceId,epoch,peerId,kind:'offer',sdp:current.localDescription!.sdp});}catch{current.close();onConnection(false);}})();
    }
    const answer=room.peers.find(item=>item.id===peerId)?.answer;
    if(answer&&peer&&!peer.currentRemoteDescription)void peer.setRemoteDescription({type:'answer',sdp:answer}).catch(()=>onConnection(false));
  });
  return {close(){closed=true;stop();peer?.close();buffers.clear();if(connected)onConnection(false);if(epoch)void signalLivePeer({sectionId,deviceId,epoch,peerId,kind:'leave'}).catch(()=>{});}};
}
