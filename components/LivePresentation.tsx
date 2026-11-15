"use client";
import { useEffect, useRef, useState } from 'react';
import { readLivePresentation, realtimeReady, watchLivePresentation, watchRealtimeReady, type LiveRoom } from '@/lib/realtime/client';
import { liveCommand as livePresentationCommand, readLiveBackup, resumeLiveSession, stageLiveDocument, endLiveSession } from '@/lib/livePresentationTransport';
import { applyLivePatch, type LiveDocument } from '@/lib/livePresentationProtocol';
import { diffLiveDocument, renderLiveDocument } from '@/lib/livePresentationDom';
import { createLivePeerController, createLivePeerFollower } from '@/lib/livePresentationPeer';
import styles from './LivePresentation.module.css';

export type LiveSelection = { sectionId: string; mode: 'control' | 'follow'; epoch: string; deviceId: string };
const pendingStops = new Map<string, ReturnType<typeof setTimeout>>();
export function liveDeviceId() {
  let id = sessionStorage.getItem('eiu-live-device');
  if (!id) { id=crypto.randomUUID();sessionStorage.setItem('eiu-live-device',id); }
  return id;
}
export function LiveSectionControl({ sectionId, onSelect }: { sectionId: string; onSelect: (selection: LiveSelection) => void }) {
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[online,setOnline]=useState(false),[conflict,setConflict]=useState(false);
  useEffect(()=>{const refresh=()=>setOnline(realtimeReady());refresh();return watchRealtimeReady(refresh);},[]);
  const select=async(mode:'control'|'follow')=>{
    setBusy(true);setError('');setConflict(false);
    try { const deviceId=liveDeviceId(),epoch=crypto.randomUUID();if(mode==='control')await livePresentationCommand('start',{sectionId,deviceId,epoch});onSelect({sectionId,deviceId,epoch,mode}); }
    catch(error){const message=error instanceof Error?error.message:'Không thể bắt đầu Live.';const owned=/Another device|no longer controls|no longer owns/.test(message);setConflict(owned);setError(owned?'Section đang có máy điều khiển. Trên PC, chọn Theo dõi; nếu là phiên cũ, hãy kết thúc phiên đó.':/timed out/.test(message)?'Kết nối Live đang chậm. Hãy thử lại.':message);}finally{setBusy(false);}
  };
  const release=async()=>{setBusy(true);try{await endLiveSession(sectionId);setConflict(false);setError('Đã kết thúc phiên cũ. Chọn Điều khiển để bắt đầu.');}catch(error){setError(error instanceof Error?error.message:'Chưa thể kết thúc phiên cũ.');}finally{setBusy(false);}};
  return <div className={styles.choice}><label><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> Live</label>{enabled&&<><button disabled={busy} onClick={()=>void select('control')}>Điều khiển</button><button disabled={busy} onClick={()=>void select('follow')}>Theo dõi</button>{!online&&<span>Đường Supabase dự phòng</span>}<small>Laptop: Điều khiển · PC: Theo dõi</small></>}{error&&<span role="alert">{error}</span>}{conflict&&<button disabled={busy} onClick={()=>void release()}>Kết thúc phiên cũ</button>}</div>;
}

export function LiveController({ selection, onStop }: { selection: LiveSelection; onStop: () => void }) {
  const [error,setError]=useState(''),[online,setOnline]=useState(false);
  useEffect(()=>{
    const queuedStop=pendingStops.get(selection.epoch);if(queuedStop){clearTimeout(queuedStop);pendingStops.delete(selection.epoch);}
    let disposed=false,initialized=false,previous:LiveDocument|null=null,pending:LiveDocument|null=null,sending=false,sequence=0;
    let retryTimer:ReturnType<typeof setTimeout>|undefined,retryDelay=400;
    const peer=createLivePeerController(selection.sectionId,selection.deviceId,selection.epoch);
    const frames=()=>[...document.querySelectorAll<HTMLIFrameElement>('iframe[data-request-id]')].filter(frame=>frame.dataset.requestId?.startsWith(selection.sectionId+':'));
    const configure=()=>{setOnline(realtimeReady());if(!initialized)return;frames().forEach(frame=>frame.contentWindow?.postMessage({type:'eiu-live-capture',enabled:true,requestId:frame.dataset.requestId},'*'));};
    const flush=async()=>{
      if(sending||disposed||!initialized||!pending||retryTimer)return;
      const state=pending;pending=null;sending=true;
      try {const patch=diffLiveDocument(previous,state);if(patch.nodes.length||patch.removed.length||previous?.page!==state.page||previous?.width!==state.width||previous?.height!==state.height){await livePresentationCommand('update',{...selection,sequence:++sequence,patch:JSON.stringify(patch)});previous=state;}retryDelay=400;setError('');}
      catch(error){previous=null;pending ||= state;setError(error instanceof Error?error.message:'Live connection interrupted.');if(!disposed&&!retryTimer){retryTimer=setTimeout(()=>{retryTimer=undefined;void flush();},retryDelay);retryDelay=Math.min(4000,retryDelay*2);}}
      finally{sending=false;if(!disposed&&pending&&pending!==state)void flush();}
    };
    const receive=(event:MessageEvent)=>{
      const frame=frames().find(frame=>frame.contentWindow===event.source&&frame.dataset.requestId===event.data?.requestId);if(!frame)return;
      if(event.data.type==='eiu-tsx-ready'){configure();return;}
      if(event.data.type==='eiu-live-document'){pending=event.data.state;stageLiveDocument(selection.epoch,event.data.state);peer.publish(event.data.state);void flush();}
      if(event.data.type==='eiu-live-error')setError('Slide này chưa thể đồng bộ Live.');
    };
    const ready=()=>{previous=null;if(realtimeReady()&&retryTimer){clearTimeout(retryTimer);retryTimer=undefined;}configure();void flush();};
    const unwatch=watchRealtimeReady(ready);window.addEventListener('message',receive);void resumeLiveSession(selection).then(()=>{if(!disposed){initialized=true;configure();}});
    const heartbeat=window.setInterval(()=>{if(!disposed&&initialized){if(pending)void flush();else if(!sending)void livePresentationCommand('update',{...selection,sequence:++sequence,patch:''}).catch(()=>setError('Live đang kết nối lại…'));}},10000);
    return()=>{disposed=true;if(retryTimer)clearTimeout(retryTimer);peer.close();unwatch();window.clearInterval(heartbeat);window.removeEventListener('message',receive);frames().forEach(frame=>frame.contentWindow?.postMessage({type:'eiu-live-capture',enabled:false,requestId:frame.dataset.requestId},'*'));pendingStops.set(selection.epoch,setTimeout(()=>{pendingStops.delete(selection.epoch);void livePresentationCommand('stop',selection).catch(()=>{});},250));};
  },[selection]);
  return <div className={styles.status}><span className={online?styles.dot:styles.offline}/><strong>Live · Điều khiển</strong><span>{error||(!online?'Đang kết nối lại…':'Đang phát thao tác')}</span><button onClick={onStop}>Dừng Live</button></div>;
}

const mirrorDocument=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; script-src 'unsafe-inline'"></head><body><script>const render=${renderLiveDocument.toString()},cache=new Map();window.addEventListener('message',event=>{if(event.source!==parent)return;if(event.data?.type==='eiu-live-ping'){parent.postMessage({type:'eiu-live-mirror-ready'},'*');return;}if(event.data?.type!=='eiu-live-mirror')return;try{render(document,event.data.state,cache);parent.postMessage({type:'eiu-live-mirror-rendered'},'*');}catch{parent.postMessage({type:'eiu-live-mirror-error'},'*');}});parent.postMessage({type:'eiu-live-mirror-ready'},'*');</script></body></html>`;
export function LiveFollower({ selection, title, onStop }: {selection:LiveSelection;title:string;onStop:()=>void}) {
  const frame=useRef<HTMLIFrameElement>(null),surface=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:960,height:540}),[bounds,setBounds]=useState({width:960,height:540}),[status,setStatus]=useState('Đang chờ máy điều khiển…'),[hasSlide,setHasSlide]=useState(false);
  const currentOwner=useRef<{owner:string;epoch:string}|null>(null);
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>{const box=entries[0].contentRect;setBounds({width:box.width,height:box.height});});if(surface.current)observer.observe(surface.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let disposed=false,peerConnected=false,documentState='',epoch='',revision=-1,loading=false,latest:LiveRoom=null,mirrorReady=false,backupAt=0,backupEpoch='',backupRevision=-1,primarySequence=-1,appliedBackupEpoch='',appliedBackupSequence=-1;
    const display=()=>{if(!documentState||!mirrorReady)return;const state=JSON.parse(documentState) as LiveDocument;setSize({width:state.width,height:state.height});frame.current?.contentWindow?.postMessage({type:'eiu-live-mirror',state},'*');setStatus(`Đang theo dõi · Slide ${state.page}`);};
    const refresh=async()=>{
      if(loading)return;loading=true;
      let loaded=false;
      try{const snapshot=await readLivePresentation(selection.sectionId);if(disposed)return;if(snapshot&&(snapshot.epoch===appliedBackupEpoch?snapshot.sequence>=appliedBackupSequence:snapshot.updatedAt>=backupAt)){epoch=snapshot.epoch;revision=snapshot.revision;documentState=snapshot.document;loaded=true;if(snapshot.document)display();else setStatus('Đang chờ máy điều khiển mở slide…');}}
      catch{if(!disposed)setStatus('Mất kết nối · Đang giữ màn hình gần nhất');}finally{loading=false;if(loaded&&!disposed&&latest&&latest.revision>revision)void receive(latest);}
    };
    const receive=async(room:LiveRoom)=>{
      if(disposed)return;latest=room;if(!room?.active){if(Date.now()-backupAt>15000)setStatus('Máy điều khiển đã dừng Live');return;}currentOwner.current=room;
      if(peerConnected)return;
      if(room.epoch===appliedBackupEpoch?room.sequence<appliedBackupSequence:room.updatedAt<backupAt)return;primarySequence=room.sequence;
      if(epoch!==room.epoch||revision<0||room.revision>revision+1){await refresh();return;}
      if(room.revision<=revision)return;
      try{documentState=applyLivePatch(documentState,room.patch);revision=room.revision;display();}catch{await refresh();}
    };
    const messages=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow)return;if(event.data?.type==='eiu-live-mirror-ready'){mirrorReady=true;display();}if(event.data?.type==='eiu-live-mirror-rendered')setHasSlide(true);if(event.data?.type==='eiu-live-mirror-error'){setHasSlide(false);setStatus('Chưa dựng được slide · Đang tải lại trạng thái…');revision=-1;void refresh();}};
    window.addEventListener('message',messages);
    const stop=watchLivePresentation(selection.sectionId,room=>void receive(room),()=>setStatus('Live không khả dụng. Kiểm tra kết nối hoặc quyền admin.'));
    const ready=()=>{if(peerConnected)return;if(!realtimeReady())setStatus('Mất kết nối · Đang giữ màn hình gần nhất');else{revision=-1;void refresh();}};const unwatch=watchRealtimeReady(ready);
    let backupTimer:ReturnType<typeof setTimeout>;
    const checkBackup=async()=>{
      if(!mirrorReady)frame.current?.contentWindow?.postMessage({type:'eiu-live-ping'},'*');
      try{
        const room=await readLiveBackup(selection.sectionId,backupEpoch,backupRevision);if(disposed)return;
        if(room){backupEpoch=room.epoch;backupRevision=room.revision;currentOwner.current=room;
          if(!room.active){setStatus('Máy điều khiển đã dừng Live');return;}
          if(!peerConnected&&room.document&&(!documentState||!realtimeReady()||room.epoch!==epoch||room.sequence>primarySequence)){
            documentState=room.document;backupAt=room.updatedAt;appliedBackupEpoch=room.epoch;appliedBackupSequence=room.sequence;epoch=room.epoch;revision=-1;display();setStatus(`Đang theo dõi · Supabase dự phòng · Slide ${(JSON.parse(documentState) as LiveDocument).page}`);
          }
        }
      }catch{if(!peerConnected&&!realtimeReady())setStatus('Mất cả hai đường kết nối · Đang giữ màn hình gần nhất');}
      finally{if(!disposed)backupTimer=setTimeout(()=>void checkBackup(),peerConnected?3000:realtimeReady()?1200:400);}
    };
    const peer=createLivePeerFollower(selection.sectionId,selection.deviceId,encoded=>{if(disposed)return;documentState=encoded;display();setStatus(`Đang theo dõi trực tiếp · Slide ${(JSON.parse(encoded) as LiveDocument).page}`);},connected=>{peerConnected=connected;if(!connected&&!disposed){revision=-1;void refresh();}});
    void checkBackup();
    return()=>{disposed=true;peer.close();clearTimeout(backupTimer);stop();unwatch();window.removeEventListener('message',messages);};
  },[selection]);
  const scale=Math.min(bounds.width/size.width,bounds.height/size.height);
  return <div className={styles.follower}><div className={styles.status}><strong>Live · Theo dõi</strong><span>{title} · {status}</span><button onClick={()=>void surface.current?.requestFullscreen()}>Toàn màn hình</button><button onClick={()=>{const owner=currentOwner.current;if(owner)void livePresentationCommand('stop',{sectionId:selection.sectionId,deviceId:owner.owner,epoch:owner.epoch}).then(()=>setStatus('Đã kết thúc Live')).catch(()=>setStatus('Chưa thể dừng. Kiểm tra kết nối.'));}}>Kết thúc Live</button><button onClick={onStop}>Thoát theo dõi</button></div><div ref={surface} className={styles.surface}><iframe ref={frame} title={`Live ${title}`} sandbox="allow-scripts" srcDoc={mirrorDocument} style={{width:size.width,height:size.height,transform:`translate(-50%,-50%) scale(${scale})`}}/><div className={styles.guard} aria-label="Màn hình chỉ theo dõi"/>{!hasSlide&&<div className={styles.waiting} role="status">{status}</div>}</div></div>;
}
