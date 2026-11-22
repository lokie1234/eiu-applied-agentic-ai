'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLearningLanguage} from '@/lib/learningLanguage';
import styles from './CatalogEditButton.module.css';

export default function CatalogEditButton({kind,id,title,description=''}:{kind:'folder'|'course'|'section';id:string;title:string;description?:string}){
  const {t}=useLearningLanguage(),router=useRouter(),dialog=useRef<HTMLDialogElement>(null),name=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),request=useRef<AbortController|null>(null);
  const [open,setOpen]=useState(false),[value,setValue]=useState(title),[detail,setDetail]=useState(description),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(open&&!dialog.current?.open){dialog.current?.showModal();name.current?.focus();}if(!open&&dialog.current?.open){dialog.current.close();trigger.current?.focus();}},[open]);
  useEffect(()=>()=>request.current?.abort(),[]);
  const close=()=>{if(!request.current){dialog.current?.close();setOpen(false);setError('');trigger.current?.focus();}};
  const save=async()=>{
    if(request.current||!value.trim())return;
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/catalog',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,title:value,description:detail}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const data=await response.json();
      if(controller.signal.aborted)return;
      if(!response.ok||data.success!==true)throw Error(data.message||'Unable to save changes.');
      dialog.current?.close();setOpen(false);trigger.current?.focus();router.refresh();
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to save changes. Please retry.');}
    finally{if(request.current===controller){request.current=null;setBusy(false);}}
  };
  return <>
    <button ref={trigger} type="button" className={styles.gear} data-energy-exclude aria-label={`${t('Edit','Chỉnh sửa')} ${title}`} title={t('Edit name and description','Sửa tên và mô tả')} onClick={event=>{event.stopPropagation();setValue(title);setDetail(description);setError('');setOpen(true);}}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3-.6 2.2-2 .9-2-.6L2.9 8l1.5 1.7-.2 2.2-1.5 1.7 1.5 2.6 2.2-.4 1.8 1.3.5 2.2h3l.7-2.1 2-.9 2.1.6 1.5-2.6-1.5-1.7.2-2.2 1.5-1.7-1.5-2.6-2.2.4-1.8-1.3L12 3Z"/><circle cx="10.7" cy="11.2" r="3"/></svg>
    </button>
    {open&&<dialog ref={dialog} className={styles.dialog} aria-labelledby={`catalog-edit-${kind}-${id}`} onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>event.stopPropagation()}>
      <header><h2 id={`catalog-edit-${kind}-${id}`}>{t('Edit name and description','Sửa tên và mô tả')}</h2><button type="button" aria-label={t('Close','Đóng')} disabled={busy} onClick={close}>×</button></header>
      <form onSubmit={event=>{event.preventDefault();void save();}}>
        <label>{t('Name','Tên')}<input ref={name} aria-label={t('Name','Tên')} value={value} maxLength={120} required disabled={busy} onChange={event=>setValue(event.target.value)}/></label>
        <label>{t('Description','Mô tả')}<textarea aria-label={t('Description','Mô tả')} rows={5} maxLength={4000} value={detail} disabled={busy} onChange={event=>setDetail(event.target.value)}/></label>
        {error&&<p role="alert">{t(error)}</p>}
        <footer><button type="button" disabled={busy} onClick={close}>{t('Cancel','Hủy')}</button><button type="submit" disabled={busy||!value.trim()}>{busy?t('Saving…','Đang lưu…'):t('Save','Lưu')}</button></footer>
      </form>
    </dialog>}
  </>;
}
