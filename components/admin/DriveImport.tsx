"use client";
import { useEffect, useRef, useState } from "react";
import { loadPicker } from "@/lib/googlePicker";
import DriveActionIcon from "./DriveActionIcon";
import iconStyles from "./DriveActionIcon.module.css";
import styles from "./DriveExport.module.css";

type SelectedFile = { id: string; name: string; bytes: number; type: string; revision: string };
export default function DriveImport({ sectionId, title, disabled, onSaved }: { sectionId: string; title: string; disabled?: boolean; onSaved?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const working = useRef(false);
  const disposed = useRef(false);
  const read = useRef<AbortController | null>(null);
  const picker = useRef<google.picker.Picker | null>(null);
  const [fileId, setFileId] = useState("");
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { disposed.current = false; return () => { disposed.current = true; read.current?.abort(); picker.current?.dispose(); }; }, []);
  async function request(body: object, signal?: AbortSignal) {
    const response = await fetch(`/api/admin/sections/${encodeURIComponent(sectionId)}/drive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(120_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load from Drive.");
    return data;
  }
  async function preview(id: string) {
    const data = await request({ action: "preview", fileId: id }, read.current ? AbortSignal.any([read.current.signal, AbortSignal.timeout(120_000)]) : undefined);
    if (!disposed.current && !read.current?.signal.aborted) { setFile(data.file); setFileId(data.file.id); }
  }
  async function browse() {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage(""); setSaved(false); setFile(null);
    const controller = new AbortController(); read.current = controller;
    try {
      const [, response] = await Promise.all([
        loadPicker(),
        fetch("/api/admin/drive/picker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "browse" }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) }),
      ]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to open Drive.");
      if (disposed.current || controller.signal.aborted) return;
      // A modal dialog would cover Google's Picker; reopen it after selection.
      dialog.current?.close();
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
      picker.current = new google.picker.PickerBuilder().addView(view).setOAuthToken(data.accessToken).setDeveloperKey(data.apiKey).setAppId(data.appId).setOrigin(window.location.origin).setTitle("Choose a JS, PDF or PPTX lesson").setCallback(result => {
        if (disposed.current || controller.signal.aborted) return;
        if (result.action === google.picker.Action.PICKED || result.action === google.picker.Action.CANCEL) {
          dialog.current?.showModal();
          picker.current?.dispose(); picker.current = null;
          if (result.action === google.picker.Action.PICKED && result.docs?.[0]?.id) {
            void preview(result.docs[0].id).catch(error => { if (!controller.signal.aborted && !disposed.current) setMessage(error instanceof Error ? error.message : "Unable to read this file."); }).finally(() => { working.current = false; if (!disposed.current) setBusy(false); });
          } else { working.current = false; setBusy(false); }
        }
      }).build();
      picker.current.setVisible(true);
    } catch (error) {
      if (!disposed.current && !controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to open Drive.");
      working.current = false; if (!disposed.current) setBusy(false);
    }
  }
  async function inspect() {
    if (working.current || !fileId.trim()) return;
    working.current = true; setBusy(true); setFile(null); setSaved(false); setMessage(""); read.current = new AbortController();
    try { await preview(fileId); }
    catch (error) { if (!disposed.current) setMessage(error instanceof Error ? error.message : "Unable to read this file."); }
    finally { working.current = false; if (!disposed.current) setBusy(false); }
  }
  async function connect() {
    if (working.current || !file) return;
    working.current = true; setBusy(true); setMessage("");
    try {
      await request({ action: "connect", fileId: file.id, revision: file.revision });
      onSaved?.();
      if (!disposed.current) { setSaved(true); setMessage(`${file.name} ${file.type === "tsx" ? "was imported into the project for display and editing" : "is connected"}. Reopen the lesson to load it.`); setFile(null); }
    } catch (error) { if (!disposed.current) setMessage(error instanceof Error ? error.message : "Unable to connect this file."); }
    finally { working.current = false; if (!disposed.current) setBusy(false); }
  }
  return <><button type="button" className={iconStyles.button} aria-label={`Upload ${title} from Drive`} title="Upload from Drive" disabled={disabled || busy} onClick={event => { event.stopPropagation(); setFile(null); setFileId(""); setMessage(""); setSaved(false); dialog.current?.showModal(); }}><DriveActionIcon direction="in" /></button>
    <dialog ref={dialog} className={styles.dialog} aria-label="Upload lesson from Google Drive" onClick={event => event.stopPropagation()} onCancel={event => { if (busy) event.preventDefault(); }}>
      <header className={styles.header}><span className={styles.mark}><DriveActionIcon direction="in" /></span><div><span className={styles.eyebrow}>EIU · DRIVE IMPORT</span><h2>Upload from Drive</h2></div><button type="button" aria-label="Close" disabled={busy} onClick={() => dialog.current?.close()}>×</button></header>
      <div className={styles.body}><p className={styles.description}>Choose a lesson JS, PDF or PPTX up to 50 MB for {title}. Connecting replaces this section’s current file. The selected Drive file stays in place and becomes the lesson source.</p>
        <button type="button" className={styles.setup} disabled={busy} onClick={() => void browse()}>Choose file in Google Drive</button>
        <label className={styles.field}>Or paste a Drive file link<input value={fileId} disabled={busy} onChange={event => { setFileId(event.target.value); setFile(null); setSaved(false); setMessage(""); }} /></label>
        <p className={styles.description}>For files outside this app, use the Drive chooser first to grant access.</p>
        <a className={styles.setup} href="/downloads/interactive-lesson-example.js" download>Download a plain JS lesson example</a>
        {file && <p>{file.name} · {/\.js$/i.test(file.name) ? "JS" : file.type.toUpperCase()} · {(file.bytes / 1024 / 1024).toFixed(2)} MB</p>}
      </div>
      <footer className={styles.footer}>{busy && <div className={`${styles.feedback} ${styles.progress}`} role="status"><span className={styles.spinner} />Loading Drive lesson…</div>}{message && <p role="status" className={`${styles.feedback} ${saved ? styles.success : styles.error}`}>{message}</p>}<div className={styles.footerActions}><button type="button" disabled={busy} className={styles.secondary} onClick={() => dialog.current?.close()}>Close</button>{!saved && (file ? <button type="button" disabled={busy} className={styles.primary} onClick={() => void connect()}>Connect to section</button> : <button type="button" disabled={busy || !fileId.trim()} className={styles.primary} onClick={() => void inspect()}>Check file</button>)}</div></footer>
    </dialog></>;
}
