"use client";
import { useEffect, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { IdentityField } from "@/lib/learningIdentity";
import styles from "./SignInCard.module.css";

export default function LearnerInformationDialog({ fields, information, onChange, onSubmit, onCancel, loading, error }: { fields: IdentityField[]; information: Record<string, string>; onChange?: (id: string, value: string) => void; onSubmit: (event: FormEvent) => void; onCancel?: () => void; loading: boolean; error: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={ref} className={styles.identityDialog} aria-labelledby="learner-dialog-title" aria-describedby="learner-dialog-description" onCancel={event => { event.preventDefault(); if (!loading) onCancel?.(); }}>
    <header className={styles.dialogHeader}><span className={styles.eyebrow}>EIU LEARNING SPACE</span><button className={styles.dialogClose} type="button" aria-label="Close learner information" disabled={loading} onClick={onCancel}>×</button></header>
    <div className={styles.dialogHeading}><span className={styles.dialogMark} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><div><h2 id="learner-dialog-title">A little about you</h2><p id="learner-dialog-description">Complete your information to enter the learning space.</p></div></div>
    <form noValidate className={styles.form} onSubmit={onSubmit} aria-busy={loading}>
      <div className={styles.dialogFields}>{fields.map((field, index) => <label key={field.id} htmlFor={`learner-${field.id}`}>{field.label}<input id={`learner-${field.id}`} type={field.type} min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined} step={field.type === "number" ? "any" : undefined} value={information[field.id] || ""} onChange={event => onChange?.(field.id, event.target.value)} disabled={loading} maxLength={200} autoComplete={field.id === "name" ? "name" : field.type === "email" ? "email" : "off"} autoFocus={index === 0} aria-required="true" aria-invalid={Boolean(error)} />{field.type === "number" && (field.min !== undefined || field.max !== undefined) && <small className={styles.numberHint}>{field.min !== undefined && field.max !== undefined ? `${field.min} ? ${field.max}` : field.min !== undefined ? `Minimum: ${field.min}` : `Maximum: ${field.max}`}</small>}</label>)}</div>
      {error && <div className={styles.dialogError} role="alert">{error}</div>}
      <p className={styles.dialogNote}>Your details stay linked to your submissions, quizzes, and feedback.</p>
      <div className={styles.dialogActions}><button type="button" className={styles.dialogCancel} disabled={loading} onClick={onCancel}>Cancel</button><button className={styles.primary} type="submit" disabled={loading}>{loading ? <><span className={styles.spinner} aria-hidden="true" />Signing in…</> : <>Continue<span aria-hidden="true">→</span></>}</button></div>
    </form>
  </dialog>, document.body);
}
