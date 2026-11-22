'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useLearningLanguage} from '@/lib/learningLanguage';
import type {PasscodeSimulation as Preview,SimulationCredential} from '@/lib/passcodeSimulationTypes';
import styles from './PasscodeSimulation.module.css';
export default function PasscodeSimulation({onSelect}:{onSelect:(preview:Preview)=>void}){
 const {t}=useLearningLanguage(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),request=useRef<AbortController|null>(null);
 const [open,setOpen]=useState(false),[rows,setRows]=useState<SimulationCredential[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 const close=()=>{if(busy)return;request.current?.abort();request.current=null;dialog.current?.close();setOpen(false);setRows([]);setQuery('');setError('');setLoading(false);trigger.current?.focus();};
 const load=async()=>{
  if(request.current)return;setOpen(true);setLoading(true);setError('');setRows([]);const controller=new AbortController();request.current=controller;
  try{const response=await fetch('/api/admin/passcode-simulation',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});const data=await response.json();if(controller.signal.aborted)return;if(!response.ok||data.success!==true||!Array.isArray(data.credentials))throw Error(data.message||'Unable to load passcodes.');setRows(data.credentials);}
  catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to load passcodes.');}finally{if(request.current===controller){request.current=null;setLoading(false);}}
 };
 const handleSimulate=useCallback(async(id:string)=>{
  if(request.current)return;const controller=new AbortController();request.current=controller;setBusy(id);setError('');
  try{const response=await fetch('/api/admin/passcode-simulation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credentialId:id}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});const data=await response.json();if(controller.signal.aborted)return;if(!response.ok||data.success!==true||!data.preview||!Array.isArray(data.preview.sections))throw Error(data.message||'Unable to simulate this passcode.');onSelect(data.preview);dialog.current?.close();setOpen(false);setRows([]);setQuery('');}
  catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to simulate this passcode.');}finally{if(request.current===controller){request.current=null;setBusy('');}}
 },[onSelect]);
 const filtered=rows.filter(row=>(row.code+' '+row.label+' '+row.kind).toLowerCase().includes(query.toLowerCase()));
 return <><button ref={trigger} type="button" className={styles.trigger} data-passcode-simulation onClick={()=>void load()}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/></svg>Passcode simulation</button>
 {open&&<dialog ref={dialog} className={styles.dialog} aria-labelledby="passcode-simulation-title" onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>event.stopPropagation()}>
  <header><div><h2 id="passcode-simulation-title">Passcode simulation</h2><p>{t('Choose an existing passcode to preview exactly the content it unlocks.','Chọn passcode để xem đúng nội dung mà mã đó mở được.')}</p></div><button type="button" aria-label={t('Close','Đóng')} disabled={Boolean(busy)} onClick={close}>×</button></header>
  <input className={styles.search} aria-label={t('Find a passcode','Tìm passcode')} placeholder={t('Search passcode or course…','Tìm passcode hoặc khóa học…')} value={query} disabled={Boolean(busy)} onChange={event=>setQuery(event.target.value)}/>
  {loading&&<p role="status">{t('Loading passcodes…','Đang tải passcode…')}</p>}
  {error&&<p className={styles.error} role="alert">{t(error)}{!rows.length&&<button type="button" onClick={()=>void load()}>{t('Retry','Thử lại')}</button>}</p>}
  {!loading&&['global','specialized'].map(group=>{const entries=filtered.filter(row=>group==='global'?row.kind==='global':row.kind!=='global');return entries.length?<section key={group}><h3>{group==='global'?'Global':'Specialized'}</h3><div className={styles.list}>{entries.map(row=><article key={row.id} className={styles.row}>
   <div className={styles.identity}><code>{row.code}</code><span className={styles.mode}>{row.mode==='facilitator'?'Teaching':'Learning'}</span></div>
   <div className={styles.scope}><strong>{row.kind==='global'?'Global':row.kind==='course'?'Course':row.kind==='folder'?'Folder':'Section'} · {row.label}</strong><span>{row.available?`${row.courseCount} ${t(row.courseCount===1?'course':'courses','khóa học')} · ${row.sectionCount} ${t(row.sectionCount===1?'section':'sections','học phần')}`:t('Inactive or ambiguous passcode','Passcode chưa hoạt động hoặc bị trùng')}</span></div>
   <button type="button" data-credential-id={row.id} disabled={!row.available||Boolean(busy)} aria-label={`${t('Simulate','Mô phỏng')} ${row.code} · ${row.label} · ${row.mode}`} onClick={event=>void handleSimulate(event.currentTarget.dataset.credentialId!)}>{busy===row.id?t('Opening…','Đang mở…'):t('Simulate','Mô phỏng')}</button>
  </article>)}</div></section>:null;})}
  {!loading&&!error&&!filtered.length&&<p>{t('No matching passcodes.','Không có passcode phù hợp.')}</p>}
 </dialog>}</>;
}
