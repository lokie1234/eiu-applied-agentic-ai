"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_SECTION_BYTES } from "@/lib/sectionLimits";
import styles from "./DriveExport.module.css";
import iconStyles from "./DriveActionIcon.module.css";
import PcActionIcon from "./PcActionIcon";

type Destination = { id: string; label: string };
export default function SectionFileUpload({ sectionId, title, builtin, disabled, onSaved }: {
  sectionId: string; title: string; builtin?: boolean; disabled?: boolean; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function open() {
    if (working.current) return;
    working.current = true;
    const read = new AbortController(); controller.current = read;
    setBusy(true); setFile(null); setSaved(false); setMessage(""); setDestinations([]); setDestinationId("");
    if (input.current) input.current.value = "";
    dialog.current?.showModal();
    try {
      const response = await fetch("/api/admin/drive/destinations", { cache: "no-store", signal: AbortSignal.any([read.signal, AbortSignal.timeout(30_000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load Drive destinations.");
      if (read.signal.aborted) return;
      const options: Destination[] = data.destinations ?? [];
      setDestinations(options);
      if (options.length === 1) setDestinationId(options[0].id);
      if (!options.length) setMessage("Add a Drive destination in Admin Access before uploading.");
    } catch (error) {
      if (!read.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to load upload options.");
    } finally { working.current = false; if (!read.signal.aborted) setBusy(false); }
  }
  async function upload() {
    if (working.current || !file || !destinationId) return;
    working.current = true; setBusy(true); setMessage("");
    const upload = new AbortController(); controller.current = upload;
    try {
      const form = new FormData(); form.set("file", file); form.set("destinationId", destinationId); form.set("replaceLesson", "1");
      const response = await fetch(`/api/admin/sections/${encodeURIComponent(sectionId)}/content`, { method: "POST", body: form, signal: AbortSignal.any([upload.signal, AbortSignal.timeout(120_000)]) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to upload this file.");
      if (upload.signal.aborted) return;
      setSaved(true); setFile(null); if (input.current) input.current.value = "";
      setMessage(data.message); onSaved();
    } catch (error) {
      if (!upload.signal.aborted) setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Upload timed out. Refresh the section to check whether it completed before retrying.");
    } finally { working.current = false; if (!upload.signal.aborted) setBusy(false); }
  }
  return <>
    <button type="button" className={iconStyles.button} aria-label={`Upload ${title} from PC`} title="Upload from PC" disabled={disabled || busy} onClick={event => { event.stopPropagation(); void open(); }}>
      <PcActionIcon direction="upload" />
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-label={`Upload file for ${title}`} onClick={event => event.stopPropagation()} onCancel={event => { if (busy) event.preventDefault(); }}>
      <header className={styles.header}><h2>Upload from PC</h2><button type="button" aria-label="Close" disabled={busy} onClick={() => dialog.current?.close()}>×</button></header>
      <div className={styles.body}>
        <p className={styles.description}>Choose {builtin ? "a PPTX attachment" : "a PDF, PPTX or compiled lesson JS"} up to 50 MB for {title}. The file is saved to Drive and connected to this section{builtin ? " as an attachment" : ", replacing its current lesson"}.</p>
        <label className={styles.field}>File from your computer<input ref={input} type="file" accept={builtin ? ".pptx" : ".pdf,.pptx,.js"} disabled={busy} onChange={event => {
          const chosen = event.target.files?.[0]; setSaved(false); setMessage(""); setFile(null);
          if (!chosen) return;
          if (!chosen.size || chosen.size > MAX_SECTION_BYTES || !(builtin ? /\.pptx$/i : /\.(pdf|pptx|js)$/i).test(chosen.name)) {
            setMessage(`Choose a nonempty ${builtin ? "PPTX" : "PDF, PPTX or JS"} file up to 50 MB.`); event.target.value = ""; return;
          }
          setFile(chosen);
        }} /></label>
        <label className={styles.field}>Save to Drive<select value={destinationId} disabled={busy} onChange={event => setDestinationId(event.target.value)}><option value="">Choose destination</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <footer className={styles.footer}>
        {busy && <p className={`${styles.feedback} ${styles.progress}`} role="status">Processing upload…</p>}
        {message && <p className={`${styles.feedback} ${saved ? styles.success : styles.error}`} role={saved ? "status" : "alert"}>{message}</p>}
        <div className={styles.footerActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => dialog.current?.close()}>Close</button><button type="button" className={styles.primary} disabled={busy || !file || !destinationId} onClick={() => void upload()}>Upload file</button></div>
      </footer>
    </dialog>
  </>;
}
