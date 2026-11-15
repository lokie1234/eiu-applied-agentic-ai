"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLearningLanguage } from '@/lib/learningLanguage';
import { liveRealtimeReady,watchLiveRealtimeReady,watchLivePresentation,watchLiveDocument,endLiveBroadcast } from '@/lib/livePresentationRealtime';
import { liveCommand as livePresentationCommand, resumeLiveSession, stageLiveDocument, endLiveSession } from '@/lib/livePresentationTransport';
import { type LiveDocument } from '@/lib/livePresentationProtocol';
import { renderLiveDocument } from '@/lib/livePresentationDom';
import { createLivePeerController, createLivePeerFollower } from '@/lib/livePresentationPeer';
import styles from './LivePresentation.module.css';

export type LiveSelection = { sectionId: string; mode: 'control' | 'follow'; epoch: string; deviceId: string };
const pendingStops = new Map<string, ReturnType<typeof setTimeout>>();
function liveStatus(status:string,t:(english:string)=>string){
  const slide=status.match(/^(Following|Following directly|Following via Supabase backup) · Slide (\d+)$/);
  return slide?`${t(slide[1])} · ${t('Slide')} ${slide[2]}`:t(status);
}
function LiveIndicator({ label, interrupted = false, children }: { label:string; interrupted?:boolean; children:React.ReactNode }) {
  const host=()=>document.fullscreenElement&&!document.fullscreenElement.contains(document.body)?document.fullscreenElement:document.body;
  const [target,setTarget]=useState<Element>(host);
  useEffect(()=>{const changed=()=>setTarget(host());document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
  // Keep Live chrome outside the deck viewport: its direct children occupy a full slide row.
  return createPortal(<details className={styles.indicator}>
    <summary aria-label={label} title={label} data-live-indicator="true" data-interrupted={interrupted || undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M7.1 7.1a7 7 0 0 0 0 9.8M16.9 7.1a7 7 0 0 1 0 9.8M4.3 4.3a11 11 0 0 0 0 15.4M19.7 4.3a11 11 0 0 1 0 15.4"/></svg>
    </summary>
    <div className={styles.liveMenu}><p>{label}</p>{children}</div>
  </details>,target);
}
export function liveDeviceId() {
  let id = sessionStorage.getItem('eiu-live-device');
  if (!id) { id=crypto.randomUUID();sessionStorage.setItem('eiu-live-device',id); }
  return id;
}
export function LiveSectionControl({ sectionId, onSelect }: { sectionId: string; onSelect: (selection: LiveSelection) => void }) {
  const {t}=useLearningLanguage(),menuId=useId(),choice=useRef<HTMLDivElement>(null);
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
  useEffect(()=>{if(!enabled)return;const close=(event:PointerEvent)=>{if(!choice.current?.contains(event.target as Node))setEnabled(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[enabled]);
  const select=async(mode:'control'|'follow')=>{
    setBusy(true);setError('');setConflict(false);
    try { const deviceId=liveDeviceId(),epoch=crypto.randomUUID();if(mode==='control')await livePresentationCommand('start',{sectionId,deviceId,epoch});onSelect({sectionId,deviceId,epoch,mode}); }
    catch(error){const message=error instanceof Error?error.message:'Unable to start Live.';const owned=/Another device|no longer controls|no longer owns/.test(message);setConflict(owned);setError(owned?'This section already has a controller. Choose Follow on the PC, or end the old session.':/timed out/.test(message)?'Live is taking longer to connect. Please try again.':message);}finally{setBusy(false);}
  };
  const release=async()=>{setBusy(true);try{await endLiveSession(sectionId);setConflict(false);setError('The old session has ended. Choose Control to start.');}catch(error){setError(error instanceof Error?error.message:'Unable to end the old session.');}finally{setBusy(false);}};
  return <div ref={choice} data-live-section data-energy-exclude className={styles.choice} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setEnabled(false);choice.current?.querySelector('button')?.focus();}}}>
    <button type="button" className={styles.liveTrigger} aria-expanded={enabled} aria-controls={menuId} onClick={()=>setEnabled(value=>!value)}><span aria-hidden="true" className={styles.liveMark}/>Live</button>
    {enabled&&<div id={menuId} className={styles.choiceMenu} role="group" aria-label={t('Choose Live mode')}>
      <button type="button" disabled={busy} onClick={()=>void select('control')}>{t('Control')}</button><button type="button" disabled={busy} onClick={()=>void select('follow')}>{t('Follow')}</button>
      {error&&<p role="alert">{t(error)}</p>}{conflict&&<button type="button" disabled={busy} onClick={()=>void release()}>{t('End old session')}</button>}
    </div>}
  </div>;
}

export function LiveController({ selection, onStop }: { selection: LiveSelection; onStop: () => void }) {
  const {t}=useLearningLanguage();
  const [error,setError]=useState(''),[online,setOnline]=useState(false);
  useEffect(()=>{
    const queuedStop=pendingStops.get(selection.epoch);if(queuedStop){clearTimeout(queuedStop);pendingStops.delete(selection.epoch);}
    let disposed=false,initialized=false;
    const peer=createLivePeerController(selection.sectionId,selection.deviceId,selection.epoch);
    const frames=()=>[...document.querySelectorAll<HTMLIFrameElement>('iframe[data-request-id]')].filter(frame=>frame.dataset.requestId?.startsWith(selection.sectionId+':'));
    const configure=()=>{setOnline(liveRealtimeReady(selection.sectionId));if(!initialized)return;frames().forEach(frame=>frame.contentWindow?.postMessage({type:'eiu-live-capture',enabled:true,requestId:frame.dataset.requestId},'*'));};
    const receive=(event:MessageEvent)=>{
      const frame=frames().find(frame=>frame.contentWindow===event.source&&frame.dataset.requestId===event.data?.requestId);if(!frame)return;
      if(event.data.type==='eiu-tsx-ready'){configure();return;}
      if(event.data.type==='eiu-live-document'&&initialized){stageLiveDocument(selection.epoch,event.data.state);peer.publish(event.data.state);setError('');}
      if(event.data.type==='eiu-live-error')setError('This slide could not be mirrored.');
    };
    const ready=()=>configure();
    const unwatch=watchLiveRealtimeReady(selection.sectionId,ready);window.addEventListener('message',receive);void resumeLiveSession(selection).then(()=>{if(!disposed){initialized=true;configure();}});
    const heartbeat=window.setInterval(()=>{if(!disposed&&initialized)void livePresentationCommand('update',{...selection,patch:''}).catch(()=>setError('Reconnecting Live…'));},10000);
    return()=>{disposed=true;peer.close();unwatch();window.clearInterval(heartbeat);window.removeEventListener('message',receive);frames().forEach(frame=>frame.contentWindow?.postMessage({type:'eiu-live-capture',enabled:false,requestId:frame.dataset.requestId},'*'));pendingStops.set(selection.epoch,setTimeout(()=>{pendingStops.delete(selection.epoch);void livePresentationCommand('stop',selection).catch(()=>{});},250));};
  },[selection]);
  return <LiveIndicator label={`Live · ${t('Control')} · ${t(error||(!online?'Reconnecting Live…':'Sharing presentation'))}`} interrupted={Boolean(error)||!online}><button onClick={()=>{endLiveBroadcast(selection.sectionId,selection.epoch);onStop();}}>{t('Stop Live')}</button></LiveIndicator>;
}

const mirrorDocument=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; script-src 'unsafe-inline'"></head><body><script>const render=${renderLiveDocument.toString()},cache=new Map();window.addEventListener('message',event=>{if(event.source!==parent)return;if(event.data?.type==='eiu-live-ping'){parent.postMessage({type:'eiu-live-mirror-ready'},'*');return;}if(event.data?.type!=='eiu-live-mirror')return;try{render(document,event.data.state,cache);parent.postMessage({type:'eiu-live-mirror-rendered'},'*');}catch{parent.postMessage({type:'eiu-live-mirror-error'},'*');}});parent.postMessage({type:'eiu-live-mirror-ready'},'*');</script></body></html>`;
export function LiveFollower({ selection, title, onStop }: {selection:LiveSelection;title:string;onStop:()=>void}) {
  const {t}=useLearningLanguage();
  const frame=useRef<HTMLIFrameElement>(null),surface=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:960,height:540}),[bounds,setBounds]=useState({width:960,height:540}),[status,setStatus]=useState('Waiting for the controller…'),[hasSlide,setHasSlide]=useState(false);
  const currentOwner=useRef<{owner:string;epoch:string}|null>(null);
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>{const box=entries[0].contentRect;setBounds({width:box.width,height:box.height});});if(surface.current)observer.observe(surface.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let disposed=false,peerConnected=false,documentState='',backupState='',mirrorReady=false;
    const display=()=>{if(!documentState||!mirrorReady)return;const state=JSON.parse(documentState) as LiveDocument;setSize({width:state.width,height:state.height});frame.current?.contentWindow?.postMessage({type:'eiu-live-mirror',state},'*');setStatus(`Following · Slide ${state.page}`);};
    const messages=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow)return;if(event.data?.type==='eiu-live-mirror-ready'){mirrorReady=true;display();}if(event.data?.type==='eiu-live-mirror-rendered')setHasSlide(true);if(event.data?.type==='eiu-live-mirror-error'){setHasSlide(false);setStatus('Unable to render slide · Reloading state…');}};
    window.addEventListener('message',messages);
    const stop=watchLivePresentation(selection.sectionId,room=>{if(room){currentOwner.current=room;if(!room.active)setStatus('The controller has stopped Live');}},()=>{if(!documentState)setStatus('Live is unavailable. Check your connection or admin access.');});
    const documents=watchLiveDocument(selection.sectionId,encoded=>{backupState=encoded;if(disposed||peerConnected)return;documentState=encoded;display();});
    const peer=createLivePeerFollower(selection.sectionId,selection.deviceId,encoded=>{if(disposed)return;documentState=encoded;display();setStatus(`Following directly · Slide ${(JSON.parse(encoded) as LiveDocument).page}`);},connected=>{peerConnected=connected;if(!connected&&!disposed&&backupState){documentState=backupState;display();}});
    const ping=window.setInterval(()=>{if(!mirrorReady)frame.current?.contentWindow?.postMessage({type:'eiu-live-ping'},'*');},500);
    return()=>{disposed=true;peer.close();stop();documents();window.clearInterval(ping);window.removeEventListener('message',messages);};
  },[selection]);
  const scale=Math.min(bounds.width/size.width,bounds.height/size.height);
  return <div className={styles.follower}><LiveIndicator label={`Live · ${t('Follow')} · ${title} · ${liveStatus(status,t)}`} interrupted={!hasSlide}><button onClick={()=>void surface.current?.requestFullscreen()}>{t('Fullscreen')}</button><button onClick={()=>{const owner=currentOwner.current;if(owner)void livePresentationCommand('stop',{sectionId:selection.sectionId,deviceId:owner.owner,epoch:owner.epoch}).then(()=>setStatus('Live has ended')).catch(()=>setStatus('Unable to stop Live. Check your connection.'));}}>{t('End Live')}</button><button onClick={onStop}>{t('Leave Live')}</button></LiveIndicator><div ref={surface} className={styles.surface}><iframe ref={frame} title={`Live ${title}`} sandbox="allow-scripts" srcDoc={mirrorDocument} style={{width:size.width,height:size.height,transform:`translate(-50%,-50%) scale(${scale})`}}/><div className={styles.guard} aria-label={t('Read-only screen')}/>{!hasSlide&&<div className={styles.waiting} role="status">{liveStatus(status,t)}</div>}</div></div>;
}
