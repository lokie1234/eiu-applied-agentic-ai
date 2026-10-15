"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DriveActionIcon from "./DriveActionIcon";
import iconStyles from "./DriveActionIcon.module.css";
import styles from "./DriveExport.module.css";

type Destination = { id: string; label: string };
type Task = { sectionId: string; sourceId?: string; builtin?: boolean; note?: string; name: string; unavailable?: string; status?: "done" | "failed"; message?: string };
export default function DriveExport({ groupId, courseId, sectionId, label = "Save to Drive", compact = false, disabled = false, allowReplace = false, onSaved }: { groupId?: string; courseId?: string; sectionId?: string; label?: string; compact?: boolean; disabled?: boolean; allowReplace?: boolean; onSaved?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const working = useRef(false);
  const planRequest = useRef<AbortController | null>(null);
  useEffect(() => () => planRequest.current?.abort(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"progress" | "success" | "warning" | "error">("progress");
  async function request(payload: object, signal?: AbortSignal) {
    const response = await fetch("/api/admin/drive/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationId, groupId, courseId, sectionId, ...payload }), signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || "Unable to save document."); return data;
  }
  async function open() {
    if (working.current) return;
    working.current = true;
    const controller = new AbortController();
    planRequest.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    setReplacement(null); if (fileInput.current) fileInput.current.value = "";
    dialog.current?.showModal(); setFeedbackTone("progress"); setMessage("Loading files and Drive destinations..."); setTasks([]); setDestinationId(""); setBusy(true);
    try {
      const results = await Promise.allSettled([
        fetch("/api/admin/drive/destinations", { cache: "no-store", signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); return data.destinations as Destination[]; }),
        request({ action: "plan" }, signal),
      ]);
      if (controller.signal.aborted) return;
      const [destinationsResult, planResult] = results;
      if (destinationsResult.status === "fulfilled") setDestinations(destinationsResult.value); else throw destinationsResult.reason;
      if (planResult.status === "fulfilled") {
        setTasks(planResult.value.tasks);
        setMessage(planResult.value.tasks.length ? "" : "No section files are available to save.");
        if (!planResult.value.tasks.length) setFeedbackTone("warning");
      } else throw planResult.reason;
    } catch (error) { if (!controller.signal.aborted) { setFeedbackTone("error"); setMessage(error instanceof Error ? error.message : "Unable to load export options."); } }
    finally { if (planRequest.current === controller) planRequest.current = null; working.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  async function save() {
    if (working.current || !destinationId) return;
    working.current = true; setBusy(true); setFeedbackTone("progress"); setMessage("Preparing files for Drive...");
    let failures = 0; let completed = tasks.filter(task => task.status === "done").length;
    try {
      if (replacement && sectionId && allowReplace) {
        const form = new FormData(); form.set("file", replacement); form.set("destinationId", destinationId);
        setMessage(`Saving interactive JS: ${replacement.name}`);
        const response = await fetch(`/api/admin/sections/${encodeURIComponent(sectionId)}/content`, { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to update the interactive lesson.");
        setFeedbackTone("success"); setMessage(data.contentSource === "project-tsx" ? "Interactive JS saved to Drive. Slides continue to use their project source." : "Interactive JS saved to Drive. This section now uses the new file.");
        setReplacement(null); if (fileInput.current) fileInput.current.value = "";
        setTasks([]); onSaved?.(); return;
      }
      for (const [index, task] of tasks.entries()) {
        if (task.unavailable || task.status === "done") continue;
        setMessage(`Saving ${completed + 1} of ${tasks.filter(item => !item.unavailable).length}: ${task.name}`);
        try {
          await request({ action: task.builtin ? "save_builtin" : "save", sectionId: task.sectionId, sourceId: task.sourceId, name: task.name });
          completed++;
          setTasks(current => current.map((item, i) => i === index ? { ...item, status: "done", message: undefined } : item));
        } catch (error) {
          failures++;
          setTasks(current => current.map((item, i) => i === index ? { ...item, status: "failed", message: error instanceof Error ? error.message : "Unable to save document." } : item));
        }
      }
      const unavailable = tasks.filter(task => task.unavailable).length;
      const target = destinations.find(item => item.id === destinationId)?.label ?? "your Drive destination";
      setFeedbackTone(failures || unavailable ? "warning" : "success");
      setMessage(`${completed} document(s) saved to ${target}.${failures ? ` ${failures} failed. Retry to save the remaining files.` : ""}${unavailable ? ` ${unavailable} unavailable file(s) skipped.` : ""}`);
      if (completed) onSaved?.();
    } catch (error) { setFeedbackTone("error"); setMessage(error instanceof Error ? error.message : "Unable to update the interactive lesson."); }
    finally { working.current = false; setBusy(false); }
  }
  const remaining = tasks.some(task => !task.unavailable && task.status !== "done");
  return <><button type="button" className={`${iconStyles.button} ${compact ? styles.compact : ""}`} aria-label={label} title={label} disabled={disabled || busy} onClick={event => { event.stopPropagation(); void open(); }}><DriveActionIcon /></button>
    <dialog ref={dialog} className={styles.dialog} onClick={event => event.stopPropagation()} onCancel={event => { if (busy) event.preventDefault(); }} aria-label="Save documents to Google Drive">
      <header className={styles.header}><span className={styles.mark}><DriveActionIcon /></span><div><span className={styles.eyebrow}>{"EIU \u00b7 DRIVE EXPORT"}</span><h2>{groupId ? "Save folder to Drive" : courseId ? "Save course to Drive" : "Save section to Drive"}</h2></div><button type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Close">{"\u00d7"}</button></header>
      <div className={styles.body}>
        <p className={styles.description}>{groupId ? "Save your folder and courses to Drive. Interactive lessons export ready-to-run JS. Other stored section files can use Drive as their source." : courseId ? "Save section files to Drive. Project lessons keep using their project source; other stored files can use Drive as their source." : "Save this file to Drive. Project lessons keep using their project source; other stored files can use Drive as their source. Built-in lessons keep their interactive features."}</p>
        <label className={styles.field}>Drive target<select value={destinationId} disabled={busy} onChange={event => { setDestinationId(event.target.value); setTasks(current => current.map(item => ({ ...item, status: undefined, message: undefined }))); setMessage(""); }}><option value="">Choose a Drive destination</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <Link className={styles.setup} href="/admin/drive">Set up Drive destinations {"\u2197"}</Link>
        {allowReplace && sectionId && <div className={styles.replacement}><label className={styles.field}>Update interactive lesson<input ref={fileInput} type="file" accept=".js" disabled={busy} onChange={event => { const file = event.target.files?.[0] ?? null; setReplacement(file); setMessage(""); }} /></label><p className={styles.description}>Choose a lesson JS file. The current lesson stays available until the new file is validated and saved to Drive.</p></div>}
        {!replacement && <ul className={styles.list}>{tasks.map((task, index) => <li key={`${task.sectionId}-${task.sourceId ?? (task.builtin ? "builtin" : "published")}`}><label className={styles.field}>File name<input value={task.name} disabled={busy || task.status === "done" || !!task.unavailable || task.builtin} maxLength={150} onChange={event => setTasks(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><span className={task.unavailable || task.status === "failed" ? styles.failure : styles.fileStatus}>{task.unavailable ?? (task.status === "done" ? "Saved to Drive" : task.message ?? task.note ?? "Ready to save")}</span></li>)}</ul>}
      </div>
      <footer className={styles.footer}>
        {message && <div role="status" aria-live="polite" aria-atomic="true" className={`${styles.feedback} ${styles[feedbackTone]}`}>
          {busy ? <span className={styles.spinner} aria-hidden="true" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" />{feedbackTone === "success" ? <path d="m8 12 3 3 5-6" /> : <path d="M12 7v6m0 3v1" />}</svg>}
          <div><strong>{busy ? "System is working" : feedbackTone === "success" ? "Successfully saved to Drive" : feedbackTone === "warning" ? "Export needs attention" : "Unable to complete export"}</strong><p>{message}</p></div>
        </div>}
        <div className={styles.footerActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => dialog.current?.close()}>Close</button><button type="button" className={styles.primary} disabled={busy || !destinationId || (!remaining && !replacement)} onClick={() => void save()}>{busy ? "Working..." : replacement ? "Save interactive JS" : tasks.some(task => task.status === "failed") ? "Retry remaining files" : "Save to Drive"}</button></div>
      </footer>
    </dialog></>;
}
