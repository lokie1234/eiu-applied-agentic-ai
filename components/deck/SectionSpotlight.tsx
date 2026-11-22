'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { watchSpotlight, watchRealtimeReady, realtimeReady } from '@/lib/realtime/client';
import { SPOTLIGHT_SPIN_MS, SPOTLIGHT_PAUSE_MS, spotlightRevealAt, spotlightSlide, type SpotlightDraw, type SpotlightView } from '@/lib/mis311Spotlight';
import { ASSIGNMENT_WHEEL_SECTION_ID, validWheelCount } from '@/lib/sectionWheel';
import { createTsxDocument } from '@/lib/tsxDocument';
import type { SectionWheelScope } from './SectionWheelContext';
import styles from './SectionSpotlight.module.css';

const SPIN_MS = SPOTLIGHT_SPIN_MS;

// Adapted from the supplied EIU HTML. Convex alone chooses the winner;
// the SVG only animates the authorized result and never maintains a local roster.
function Wheel({ members, draw, duration, spinIndex, isSpinning, onSpin, onStop, frozenTransform, disabled }: { members: SpotlightView['members']; draw: SpotlightDraw | null; duration: number; spinIndex: number; isSpinning: boolean; onSpin: () => void; onStop: (transform: string) => void; frozenTransform: string | null; disabled: boolean }) {
  const id = useId().replace(/:/g, '');
  const rotor = useRef<SVGGElement>(null);
  // The parent retains this roster while a draw is active; results only append
  // missing target identities below, preserving the existing sector order.
  const roster=members;
  const names = useMemo(() => {
    const list=[...roster];
    if (draw?.targets) {
      for (const target of draw.targets) {
        if (!list.some(member => member.id === target.subject)) list.push({ id: target.subject, username: target.username });
      }
    } else if (draw && !list.some(member => member.id === draw.subject)) {
      list.push({ id: draw.subject, username: draw.username });
    }
    return list;
  }, [draw, roster]);
  const count = names.length || 8, angle = 360 / count;

  const targets = useMemo(() => draw?.targets?.length ? draw.targets : (draw ? [{ subject: draw.subject, username: draw.username }] : []), [draw]);
  const rotations = useMemo(() => {
    if (!draw || !targets.length) return [0];
    const turns: number[] = [];
    for (let k = 0; k < targets.length; k++) {
      const target = targets[k];
      const targetIndex = Math.max(0, names.findIndex(m => m.id === target.subject));
      const targetAngle = ((360 - (targetIndex + 0.5) * angle) % 360 + 360) % 360;
      if (k === 0) {
        turns.push(2160 + 360 - (targetIndex + 0.5) * angle);
      } else {
        const prev = turns[k - 1];
        const base = prev + 2160;
        const currentMod = (base % 360 + 360) % 360;
        let delta = ((targetAngle - currentMod) % 360 + 360) % 360;
        if (delta < 45) delta += 360;
        turns.push(base + delta);
      }
    }
    return turns;
  }, [draw, targets, names, angle]);

  const activeIndex = Math.min(spinIndex, rotations.length - 1);
  const fromTurn = activeIndex === 0 ? 0 : rotations[activeIndex - 1];
  const toTurn = draw?rotations[activeIndex]:2160;

  const themes = [['#082945','#F7F4ED'],['#F7F4ED','#041C31'],['#123F68','#FBFAF7'],['#E9CA8B','#041C31'],['#18547F','#FBFAF7'],['#2D7FB4','#FBFAF7'],['#B39159','#041C31'],['#041C31','#F4DFB0']];
  const point = (degrees: number, radius: number) => { const rad = (degrees - 90) * Math.PI / 180; return [250 + Math.cos(rad) * radius, 250 + Math.sin(rad) * radius]; };
  return <div className={styles.wheelWrap}>
    <svg viewBox="0 0 500 500" className={styles.wheelSvg} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-hub`} cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#18547F"/><stop offset="60%" stopColor="#082945"/><stop offset="100%" stopColor="#041C31"/></radialGradient>
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F4DFB0"/><stop offset="50%" stopColor="#B39159"/><stop offset="100%" stopColor="#9D7944"/></linearGradient>
      </defs>
      <circle cx="250" cy="250" r="236" fill="#041C31" stroke={`url(#${id}-gold)`} strokeWidth="6"/>
      <circle cx="250" cy="250" r="222" fill="none" stroke="#e9ca8b47" strokeWidth="1.5"/>
      <g ref={rotor} key={isSpinning ? `${draw?.requestId || 'ready'}-${activeIndex}` : `${draw?.requestId || 'ready'}-done`} className={isSpinning ? styles.wheel : styles.wheelStationary} style={isSpinning ? { '--spotlight-from': `${fromTurn}deg`, '--spotlight-turn': `${toTurn}deg`, animationDuration: `${Math.max(1, duration)}ms` } as CSSProperties : draw ? { transform: frozenTransform ?? `rotate(${toTurn}deg)`, transformOrigin: '250px 250px' } as CSSProperties : { transformOrigin: '250px 250px' } as CSSProperties}>
        {Array.from({length:count}, (_, i) => {
          const [fill,text] = themes[i===count-1&&count>1&&i%themes.length===0?2:i%themes.length];
          const [x1,y1] = point(i*angle,218), [x2,y2] = point((i+1)*angle,218), [px,py] = point(i*angle,212);
          const name = names[i]?.username || '';
          return <g key={names[i]?.id || i}><title>{name}</title>{count===1?<circle cx="250" cy="250" r="218" fill={fill}/>:<path d={`M250 250L${x1} ${y1}A218 218 0 ${angle>180?1:0} 1 ${x2} ${y2}Z`} fill={fill} stroke="#041C31" strokeWidth="2"/>}
            <g transform={`rotate(${(i+.5)*angle} 250 250)`}><text x="250" y="250" textAnchor="middle" fill={text} fontSize={count>30?7:count>18?10:count>8?13.5:15} fontWeight="700" transform="rotate(-90 250 250) translate(136 5)">{name.length>18?`${name.slice(0,17)}\u2026`:name}</text></g>
            <circle cx={px} cy={py} r="3" fill="#F4DFB0" opacity=".85"/>
          </g>;
        })}
      </g>
      <circle cx="250" cy="250" r="48" fill="none" stroke="#e9ca8b73" strokeWidth="2"/>
      <circle cx="250" cy="250" r="42" fill={`url(#${id}-hub)`} stroke={`url(#${id}-gold)`} strokeWidth="4"/>
      <text x="250" y="255" textAnchor="middle" fill="#F4DFB0" fontSize="13" fontWeight="800" letterSpacing="1.4">{isSpinning?'STOP':'SPIN'}</text>
      <g><path d="M250 44L235 12Q250 4 265 12Z" fill={`url(#${id}-gold)`} stroke="#041C31" strokeWidth="2.5" strokeLinejoin="round"/><circle cx="250" cy="18" r="4.5" fill="#041C31" stroke="#F4DFB0" strokeWidth="1.5"/></g>
    </svg>
    <button type="button" className={styles.hubTrigger} aria-label={isSpinning?'Stop wheel':'Spin wheel'} disabled={disabled} onClick={()=>isSpinning?onStop(rotor.current?window.getComputedStyle(rotor.current).transform||'none':'none'):onSpin()}/>
  </div>;
}

type Controls={teaching:boolean;assignment?:SectionWheelScope['practice']};
function WheelIcon(){return <svg viewBox="0 0 36 36" width="25" height="25" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="19" r="13"/><path d="M18 6v26M5 19h26M9 10l18 18M9 28l18-18"/><circle cx="18" cy="19" r="4"/><path d="m14 1 4 8 4-8Z"/></svg>;}
function SettingsIcon(){return <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.8"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg>;}
function AssignmentWheelFrame({sectionId,code,background,templateKey,assignmentKey,frame:frameRef}:{sectionId:string}&NonNullable<SectionWheelScope['practice']>){
  const document=useMemo(()=>createTsxDocument(`window.eiuExternalWheel=true;\n${code}`,6,background,templateKey,`${sectionId}:6`,true,true,assignmentKey),[sectionId,code,background,templateKey,assignmentKey]);
  return <iframe ref={frameRef} title="Practice assignment wheel" data-request-id={`${sectionId}:6`} srcDoc={document} sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox" className={styles.assignmentFrame}/>;
}
export default function SectionSpotlight({ sectionId, frame, controls }: { sectionId: string; frame?: RefObject<HTMLIFrameElement | null>; controls?:Controls }) {
  const [targetOpen,setTargetOpen]=useState(false),[targetEnabled,setTargetEnabled]=useState(false),[targetSubjects,setTargetSubjects]=useState<string[]>([]),[settingsMembers,setSettingsMembers]=useState<SpotlightView['members']>([]);
  const [snapshot, setSnapshot] = useState<SpotlightView | null>(null);
  const [available,setAvailable]=useState<boolean|null>(null);
  const context = useRef<{ epoch: string; subject: string; teaching: boolean } | null>(null);
  const [slide, setSlide] = useState<number | null>(null), [draw, setDraw] = useState<SpotlightDraw | null>(null);
  const [notice, setNotice] = useState<SpotlightDraw | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [revealedCount,setRevealedCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [spinIndex, setSpinIndex] = useState(0);
  const [spinDuration, setSpinDuration] = useState(SPIN_MS);
  const [isSpinning, setIsSpinning] = useState(false);
  const [frozenTransform,setFrozenTransform]=useState<string|null>(null);
  const stopRequested=useRef(false),stopAnimation=useRef<(()=>void)|null>(null);
  const [wheelMembers, setWheelMembers] = useState<SpotlightView['members']>([]);
  const seen = useRef(new Set<string>()), ended = useRef(false), request = useRef<AbortController | null>(null);
  const latest = useRef<SpotlightView | null>(null), activeDraw = useRef<SpotlightDraw | null>(null), spinning = useRef(false);
  const attempt = useRef<{ requestId: string; slide: number; epoch: string; createdAt: number } | null>(null);
  const refreshAccess = useRef<() => Promise<void>>(() => Promise.resolve());
  const wheelDialog = useRef<HTMLDialogElement>(null), noticeDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog=useRef<HTMLDialogElement>(null),settingsRequest=useRef<AbortController|null>(null);
  const rosterRequest = useRef<AbortController | null>(null);
  const [settingsOpen,setSettingsOpen]=useState(false),[settingsCount,setSettingsCount]=useState('1'),[settingsBusy,setSettingsBusy]=useState(false),[settingsLoaded,setSettingsLoaded]=useState(false),[settingsError,setSettingsError]=useState('');
  const dismissNotice = useCallback(() => setNotice(null), []);
  useEffect(() => {
    const controller = new AbortController();ended.current = false;
    let pending: Promise<void> | null = null, live: SpotlightView | null = null, stopLive: (() => void) | null = null, refreshedEpoch = '';
    const clear = () => {
      rosterRequest.current?.abort();rosterRequest.current = null;
      request.current?.abort();request.current = null;activeDraw.current = null;spinning.current = false;attempt.current = null;
      context.current = null;latest.current = null;setSnapshot(null);setNotice(null);setSlide(null);setDraw(null);setRevealed(false);setRevealedCount(0);setSpinIndex(0);setIsSpinning(false);stopRequested.current=false;setWheelMembers([]);setBusy(false);setError('');
      settingsRequest.current?.abort();setSettingsOpen(false);setSettingsBusy(false);setTargetOpen(false);setTargetEnabled(false);setTargetSubjects([]);setSettingsMembers([]);
      stopLive?.();stopLive=null;
    };
    const install = (value: SpotlightView) => {
      const verified = context.current;
      if (controller.signal.aborted || ended.current || !verified || value.epoch !== verified.epoch || value.viewerSubject !== verified.subject || value.teaching !== verified.teaching) return;
      if (latest.current?.epoch === value.epoch && (value.revision ?? 0) < (latest.current.revision ?? 0)) return;
      if(value.enabled===false){clear();setAvailable(false);return;}
      latest.current = value;setSnapshot(value);
    };
    function refresh(): Promise<void> {
      if (controller.signal.aborted || ended.current) return Promise.resolve();
      if (pending) return pending;
      const full = !realtimeReady();
      pending = (async () => {
        try {
          const response = await fetch(`/api/sections/${sectionId}/spotlight${full ? '' : '?context=1'}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
          if (controller.signal.aborted || ended.current) return;
          if (!response.ok) { clear();if(response.status===403)setAvailable(false);return; }
          const data = await response.json();
          if (controller.signal.aborted || ended.current) return;
          const verified = { epoch: data.epoch, subject: data.viewerSubject ?? data.snapshot?.viewerSubject, teaching: data.teaching ?? data.snapshot?.teaching };
          if (typeof verified.epoch !== 'string' || typeof verified.subject !== 'string' || typeof verified.teaching !== 'boolean') return;
          const previous = context.current;
          const changed = previous && (previous.epoch !== verified.epoch || previous.subject !== verified.subject || previous.teaching !== verified.teaching);
          if (changed) clear();
          context.current = verified;
          setAvailable(true);
          if (!previous || changed) {
            seen.current = new Set();
            try { const saved = JSON.parse(sessionStorage.getItem(`spotlight-seen:${sectionId}:${verified.subject}`) || '[]');if (Array.isArray(saved)) seen.current = new Set(saved.filter(id => typeof id === 'string').slice(-30)); } catch { /* Storage is optional. */ }
          }
          if (data.snapshot) install(data.snapshot);
          if (live) install(live);
          if (verified.teaching) { stopLive?.();stopLive = null; }
          else if (!stopLive) stopLive = watchSpotlight(sectionId, value => {
            if (controller.signal.aborted || ended.current) return;
            live = value;install(value);
            if (value.ready && value.viewerSubject === context.current?.subject && value.epoch !== context.current.epoch && refreshedEpoch !== value.epoch) {
              refreshedEpoch = value.epoch;
              if (pending) void pending.then(() => refresh());else void refresh();
            }
          });
        } catch { /* Root realtime subscription can still restore the classroom. */ }
      })().finally(() => { pending = null; });
      return pending;
    }
    refreshAccess.current = refresh;
    // MIS 301 already owns one verified classroom bridge. Its toolbar only
    // needs an additional context lookup when the count is actually saved.
    const assignmentMode=sectionId===ASSIGNMENT_WHEEL_SECTION_ID;
    const readiness = assignmentMode?()=>{}:watchRealtimeReady(() => { if (!realtimeReady() || !context.current) void refresh(); });
    const terminate = (event: Event) => {
      if ((event as CustomEvent).detail?.sectionId !== sectionId) return;
      ended.current = true;controller.abort();stopLive?.();stopLive = null;clear();
    };
    if(!assignmentMode){window.addEventListener('focus', refresh);void refresh();}window.addEventListener('eiu-section-terminated', terminate);
    return () => { ended.current = true;controller.abort();request.current?.abort();rosterRequest.current?.abort();settingsRequest.current?.abort();request.current = null;stopLive?.();readiness();context.current = null;latest.current = null;refreshAccess.current = () => Promise.resolve();window.removeEventListener('focus', refresh);window.removeEventListener('eiu-section-terminated', terminate); };
  }, [sectionId]);
  const spin = useCallback(async (page: number) => {
    if (ended.current || (context.current && !context.current.teaching)) return;
    if (!context.current) { setSlide(page);setBusy(true);await refreshAccess.current(); }
    const verified = context.current;
    if (ended.current) return;
    if (!verified?.teaching) { setBusy(false);setSlide(null);return; }
    if (request.current) { setSlide(attempt.current?.slide ?? page);return; }
    if (spinning.current && activeDraw.current) {setSlide(activeDraw.current.slide);return;}

    const controller = new AbortController();request.current = controller;
    if (!attempt.current || attempt.current.slide !== page || attempt.current.epoch !== verified.epoch || attempt.current.createdAt < Date.now() - 110000) attempt.current = { requestId: crypto.randomUUID(), slide: page, epoch: verified.epoch, createdAt: Date.now() };
    const currentAttempt = attempt.current;
    setSlide(page);setDraw(null);setRevealed(false);setRevealedCount(0);setSpinIndex(0);stopRequested.current=false;setFrozenTransform(null);setIsSpinning(true);setBusy(true);setError('');
    if (wheelDialog.current) wheelDialog.current.scrollTop = 0;
    try {
      const response = await fetch(`/api/sections/${sectionId}/spotlight`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide: page, requestId: currentAttempt.requestId, epoch: verified.epoch }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const data = await response.json();
      if (controller.signal.aborted || ended.current) return;
      if (!response.ok) { if (response.status < 500) attempt.current = null;throw Error(data.message || 'Unable to draw.'); }
      if (context.current?.epoch !== verified.epoch) return;
      attempt.current = null;activeDraw.current = data.draw;spinning.current = true;setIsSpinning(!stopRequested.current);
      setWheelMembers(previous=>previous.length?previous:(data.members||[]));setSpinIndex(0);setDraw(data.draw);
    } catch (reason) { if (!controller.signal.aborted) {spinning.current=false;setIsSpinning(false);setError(reason instanceof Error ? reason.message : 'Unable to draw.');} }
    finally { if (request.current === controller) { request.current = null;setBusy(false); } }
  }, [sectionId]);
  useEffect(() => {
    if(!frame)return;
    const open = (event: MessageEvent) => {
      const target = frame?.current, message = event.data;
      if (!target || event.source !== target.contentWindow || message?.type !== 'eiu-spotlight-open' || message.requestId !== target.dataset.requestId
        || message.requestId !== `${sectionId}:${message.slide}` || !spotlightSlide(message.slide) || ended.current) return;
      void spin(message.slide);
    };
    window.addEventListener('message', open);return () => window.removeEventListener('message', open);
  }, [frame, sectionId, spin]);
  const stop=(transform:string)=>{
    if(ended.current||stopRequested.current||(!spinning.current&&!request.current))return;
    stopRequested.current=true;spinning.current=false;
    setFrozenTransform(transform);setIsSpinning(false);setRevealed(true);
    stopAnimation.current?.();
  };
  useEffect(() => {
    if (!draw) return;
    if(!spinning.current&&!stopRequested.current)return;
    let spinTimer: number | undefined, nextTimer: number | undefined, shown=0;
    const total = draw.targets?.length || 1;
    const valid=()=>activeDraw.current?.requestId===draw.requestId&&!ended.current&&!stopRequested.current;
    const cancel=()=>{if(spinTimer!==undefined)window.clearTimeout(spinTimer);if(nextTimer!==undefined)window.clearTimeout(nextTimer);};
    const finish=()=>{spinning.current=false;setIsSpinning(false);setBusy(false);};
    const halt=()=>{cancel();spinning.current=false;setIsSpinning(false);setRevealed(true);};
    const runSpin=(index:number)=>{
      if(!valid())return;
      setSpinIndex(index);
      const delay=Math.max(0,spotlightRevealAt(draw,index)-Date.now());
      setSpinDuration(delay);
      spinTimer=window.setTimeout(()=>{
        if(!valid())return;
        shown=index+1;setRevealed(true);setRevealedCount(shown);
        if(shown<total)nextTimer=window.setTimeout(()=>runSpin(index+1),Math.min(SPOTLIGHT_PAUSE_MS,Math.max(0,spotlightRevealAt(draw,index+1)-Date.now())));else finish();
      },delay);
    };
    stopAnimation.current=halt;
    if(stopRequested.current)halt();else runSpin(0);
    return ()=>{cancel();if(stopAnimation.current===halt)stopAnimation.current=null;};
  }, [draw]);
  useEffect(() => {
    const verified = context.current;
    if (!snapshot || snapshot.teaching || !verified || snapshot.viewerSubject !== verified.subject || snapshot.epoch !== verified.epoch || ended.current) return;
    const selected = snapshot.draws.filter(row => row.subject === verified.subject && !seen.current.has(row.requestId) && row.revealAt > Date.now() - 120000).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!selected) return;
    const timer = window.setTimeout(() => {
      if (ended.current || context.current?.epoch !== verified.epoch || context.current?.subject !== verified.subject) return;
      seen.current.add(selected.requestId);
      try { sessionStorage.setItem(`spotlight-seen:${sectionId}:${verified.subject}`, JSON.stringify([...seen.current].slice(-30))); } catch { /* Storage is optional. */ }
      setNotice(selected);
    }, Math.max(0, selected.revealAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [snapshot, notice, sectionId]);
  // Exactly ten seconds from the selected learner's own notification opening.
  useEffect(() => { if (!notice) return;const timer = window.setTimeout(dismissNotice, 10000);return () => window.clearTimeout(timer); }, [notice, dismissNotice]);
  useEffect(() => {
    if (slide !== null && wheelDialog.current && !wheelDialog.current.open) wheelDialog.current.showModal();
    if (slide === null && wheelDialog.current?.open) wheelDialog.current.close();
  }, [slide]);
  useEffect(() => {
    if (notice && noticeDialog.current && !noticeDialog.current.open) noticeDialog.current.showModal();
    if (!notice && noticeDialog.current?.open) noticeDialog.current.close();
  }, [notice]);
  useEffect(()=>{if(settingsOpen&&!settingsDialog.current?.open)settingsDialog.current?.showModal();if(!settingsOpen&&settingsDialog.current?.open)settingsDialog.current.close();},[settingsOpen]);
  const loadLiveSettings=async()=>{
    if(ended.current||settingsRequest.current)return;
    setSettingsBusy(true);setSettingsLoaded(false);setSettingsError('');
    const controller=new AbortController();settingsRequest.current=controller;
    try{const response=await fetch(`/api/sections/${sectionId}/spotlight?settings=1`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});const data=await response.json();if(controller.signal.aborted||ended.current)return;if(!response.ok||!validWheelCount(data.count))throw Error(data.message||'Unable to load settings.');setSettingsCount(String(data.count));setSettingsMembers(data.members||wheelMembers);setTargetSubjects(data.targetSubjects||[]);setTargetEnabled(Boolean(data.targetSubjects?.length));setSettingsLoaded(true);}
    catch(reason){if(!controller.signal.aborted)setSettingsError(reason instanceof Error?reason.message:'Unable to load settings.');}
    finally{if(settingsRequest.current===controller){settingsRequest.current=null;setSettingsBusy(false);}}
  };
  const openSettings=async()=>{
    if(ended.current||settingsRequest.current)return;
    setTargetOpen(false);setSettingsOpen(true);setSettingsError('');
    await loadLiveSettings();
  };
  const saveSettings=async()=>{
    const count=Number(settingsCount);if(!validWheelCount(count)||settingsRequest.current||ended.current||!controls?.teaching)return;
    if(!settingsLoaded||(targetEnabled&&!targetSubjects.length))return;
    const controller=new AbortController();settingsRequest.current=controller;setSettingsBusy(true);setSettingsError('');
    try{await refreshAccess.current();if(controller.signal.aborted||ended.current)return;const verified=context.current;if(!verified?.teaching)throw Error('Teaching access required.');const response=await fetch(`/api/sections/${sectionId}/spotlight`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({count:targetEnabled?targetSubjects.length:count,epoch:verified.epoch,targetSubjects:targetEnabled?targetSubjects:[]}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const data=await response.json();if(controller.signal.aborted||ended.current)return;if(!response.ok)throw Error(data.message||'Unable to save settings.');setSettingsOpen(false);}
    catch(reason){if(!controller.signal.aborted)setSettingsError(reason instanceof Error?reason.message:'Unable to save settings.');}
    finally{if(settingsRequest.current===controller){settingsRequest.current=null;setSettingsBusy(false);}}
  };
  const openWheel = async () => {
    if (ended.current) return;
    setSlide(activeDraw.current?.slide ?? 0);
    if (sectionId === ASSIGNMENT_WHEEL_SECTION_ID || activeDraw.current || rosterRequest.current) return;
    const controller = new AbortController();rosterRequest.current = controller;
    try {
      const response = await fetch(`/api/sections/${sectionId}/spotlight`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      const data = await response.json(), verified = context.current;
      if (!response.ok || controller.signal.aborted || ended.current || activeDraw.current || !verified?.teaching) return;
      if (data.snapshot?.epoch === verified.epoch && data.snapshot.viewerSubject === verified.subject && data.snapshot.teaching) setWheelMembers(data.snapshot.members || []);
    } catch { /* A spin independently refreshes the authorized roster. */ }
    finally { if (rosterRequest.current === controller) rosterRequest.current = null; }
  };
  const close = () => { rosterRequest.current?.abort();rosterRequest.current = null;setSlide(null);frame?.current?.contentWindow?.postMessage({ type: 'eiu-spotlight-closed', requestId: frame.current.dataset.requestId }, '*'); };
  const drawTargets = useMemo(() => draw?.targets || (draw ? [{ subject: draw.subject, username: draw.username }] : []), [draw]);
  const countTier = useMemo(() => {
    const total = draw ? drawTargets.length : (Number(settingsCount) || 1);
    if (total <= 4) return 'few';
    if (total <= 12) return 'medium';
    if (total <= 24) return 'normal';
    if (total <= 40) return 'compact';
    return 'dense';
  }, [draw, drawTargets.length, settingsCount]);
  if (typeof document === 'undefined') return null;
  const launcher=controls?.teaching&&available!==false?<div className={styles.launcher} onKeyDown={event=>event.stopPropagation()}><button type="button" aria-label="Open Class Spotlight" title="Wheel of Name" disabled={sectionId===ASSIGNMENT_WHEEL_SECTION_ID&&!controls.assignment?.code} onClick={()=>void openWheel()}><WheelIcon/></button></div>:null;
  return <>{launcher}{createPortal(<>
    <dialog ref={wheelDialog} className={`${styles.dialog} ${styles.wheelCard} ${sectionId===ASSIGNMENT_WHEEL_SECTION_ID?styles.assignment:styles.floating}`} aria-labelledby="spotlight-title" onCancel={close} onKeyDown={event => event.stopPropagation()}>
      <header className={styles.header}><h2 id="spotlight-title">Wheel of Name</h2><div className={styles.dialogActions}>{controls?.teaching&&<button type="button" className={styles.close} aria-label="Class Spotlight settings" title="Learners per draw" disabled={busy||isSpinning} onClick={()=>void openSettings()}><SettingsIcon/></button>}<button type="button" className={styles.close} onClick={close} aria-label="Close wheel">×</button></div></header>
      {sectionId===ASSIGNMENT_WHEEL_SECTION_ID ? slide!==null&&controls?.assignment&&<AssignmentWheelFrame sectionId={sectionId} {...controls.assignment}/> : <div className={styles.wheelLayout}>
      <div className={styles.wheelStage}><Wheel members={wheelMembers} draw={draw} duration={spinDuration} spinIndex={spinIndex} isSpinning={isSpinning} disabled={busy&&!isSpinning} frozenTransform={frozenTransform} onStop={stop} onSpin={() => slide !== null && void spin(slide)} />
      {!draw && <p className={styles.status} role="status">{busy ? 'Connecting to the classroom...' : error || 'Ready to select learners'}</p>}
      {draw && isSpinning && <p className={styles.status} role="status">{`Spinning (${spinIndex + 1}/${draw.targets?.length || 1})…`}</p>}
      </div><section className={styles.resultsPanel} aria-label="Selected names">
      <div className={styles.result} aria-live="polite">{!draw ? '' : !revealed && revealedCount === 0 ? 'Spinning…' : <ol className={styles.targets} data-tier={countTier}>{drawTargets.slice(0,revealedCount).map((target,index)=><li className={`${styles.nameCard} ${styles.nameReveal}`} key={target.subject}><span className={styles.nameBadge}>{index+1}</span><span className={styles.nameText} title={target.username}>{target.username}</span></li>)}</ol>}</div>
      </section></div>}
    </dialog>
    <dialog ref={noticeDialog} className={`${styles.dialog} ${styles.congrat}`} aria-labelledby="spotlight-congrat" onCancel={dismissNotice} onKeyDown={event => event.stopPropagation()}>
      <button type="button" className={styles.close} onClick={dismissNotice} aria-label="Close congratulations">×</button>
      <span className={styles.star} aria-hidden="true">✦</span><h2 id="spotlight-congrat">Congrat!!!!!</h2><p className={styles.name}>{notice?.username}</p><p>Please answer the question</p>
    </dialog>
    <dialog ref={settingsDialog} className={`${styles.dialog} ${styles.settings}`} aria-labelledby="spotlight-settings-title" onCancel={()=>setSettingsOpen(false)} onKeyDown={event=>event.stopPropagation()}>
      <header className={styles.header}><h2 id="spotlight-settings-title">Wheel settings</h2><button type="button" className={styles.targetTrigger} aria-label="Target selection" aria-expanded={targetOpen} disabled={settingsBusy||!settingsLoaded} onClick={()=>setTargetOpen(open=>!open)}>!</button><button type="button" className={styles.close} aria-label="Close wheel settings" onClick={()=>setSettingsOpen(false)}>×</button></header>
      <label>Learners per draw<input type="number" min="1" step="1" value={settingsCount} disabled={settingsBusy||targetEnabled} onChange={event=>setSettingsCount(event.target.value)}/></label>
      {targetOpen&&<section className={styles.targetSettings} aria-label="Target names"><label><span>Use selected names</span><input type="checkbox" checked={targetEnabled} disabled={settingsBusy} onChange={event=>setTargetEnabled(event.target.checked)}/></label><div className={styles.targetNames}>{settingsMembers.map(member=><label key={member.id}><input type="checkbox" checked={targetSubjects.includes(member.id)} disabled={settingsBusy||!targetEnabled} onChange={event=>setTargetSubjects(ids=>event.target.checked?[...ids,member.id]:ids.filter(id=>id!==member.id))}/><span>{member.username}</span></label>)}</div>{!settingsMembers.length&&<p>No eligible names yet. Ask learners to open this section, then reopen settings.</p>}<p>{targetEnabled?targetSubjects.length+' names selected. All selected names are drawn, in a shuffled order.':'Target selection is off. Draws use the eligible class roster.'}</p></section>}
      <p>The draw selects up to this many eligible learners without repeating a person.</p>
      {sectionId===ASSIGNMENT_WHEEL_SECTION_ID&&<p>Practice parts repeat in order when more than seven learners are selected. Reset the completed draw before changing the group size.</p>}
      {settingsError&&<p role="alert">{settingsError}</p>}
      <button type="button" className={styles.spin} disabled={settingsBusy||!settingsLoaded||!validWheelCount(Number(settingsCount))||(targetEnabled&&!targetSubjects.length)} onClick={()=>void saveSettings()}>{settingsBusy?'Please wait…':'Save'}</button>
    </dialog>
  </>, document.body)}</>;
}
