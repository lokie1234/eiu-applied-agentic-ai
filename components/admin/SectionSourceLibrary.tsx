"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SectionSourceLibrary.module.css";

type Source = { id: string; original_filename: string; exported_filename: string; file_type: string; byte_size: number; status: string; created_at: string };
type Upload = { name?: string; file: File; id: string; status: "ready" | "uploading" | "done" | "failed"; message?: string };

export default function SectionSourceLibrary(props: { sectionId: string; sectionTitle: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <button className={styles.launcher} type="button" onClick={() => { setOpen(true); dialog.current?.showModal(); }}>Source files</button>
    <dialog ref={dialog} className={styles.dialog} aria-label={`Source files for ${props.sectionTitle}`} onClose={() => setOpen(false)}>
      <div className={styles.dialogHeader}><strong>Section source library</strong><button type="button" onClick={() => dialog.current?.close()} aria-label="Close source library">×</button></div>
      {open && <SourceFiles {...props} />}
    </dialog>
  </>;
}

function SourceFiles({ sectionId, sectionTitle }: { sectionId: string; sectionTitle: string }) {
  const [destinations, setDestinations] = useState<{ id: string; label: string }[]>([]);
  const [destinationId, setDestinationId] = useState("");
  useEffect(() => { void fetch("/api/admin/drive/destinations", { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setDestinations(data.destinations); setDestinationId(data.destinations[0]?.id ?? ""); }).catch(error => setError(error.message)); }, []);
  const [sources, setSources] = useState<Source[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/admin/sections/${encodeURIComponent(sectionId)}/sources`;
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load source files.");
    setSources(data.sources);
  }, [endpoint]);
  useEffect(() => { void refresh().catch(error => setError(error.message)); }, [refresh]);

  async function uploadFiles() {
    setBusy(true); setError("");
    try {
      for (const item of uploads.filter(item => item.status === "ready" || item.status === "failed")) {
        setUploads(current => current.map(row => row.id === item.id ? { ...row, status: "uploading", message: undefined } : row));
        try {
          const body = new FormData(); body.set("file", item.file); body.set("sourceId", item.id); body.set("destinationId", destinationId); body.set("name", item.name ?? "");
          const response = await fetch(endpoint, { method: "POST", body });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Upload failed.");
          setUploads(current => current.map(row => row.id === item.id ? { ...row, status: "done" } : row));
        } catch (error) {
          setUploads(current => current.map(row => row.id === item.id ? { ...row, status: "failed", message: error instanceof Error ? error.message : "Upload failed." } : row));
        }
      }
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to refresh the list."); }
    finally { setBusy(false); }
  }

  return <section className={styles.library} aria-label={`Source files for ${sectionTitle}`}>
    <div className={styles.heading}><div><h3>Source files · {sectionTitle}</h3><p>Original documents are saved to Drive. Additional sources keep your published lesson unchanged.</p></div><button type="button" onClick={() => void refresh().then(() => setError("")).catch(error => setError(error.message))} disabled={busy}>Refresh</button></div>
    <label className={styles.field}>Drive destination<select value={destinationId} disabled={busy || uploads.some(item => item.status === "failed")} onChange={event => setDestinationId(event.target.value)}><option value="">Choose a destination</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><a href="/admin/drive">Manage Drive destinations ↗</a>
    <label className={styles.picker}>+ Choose PDF, PPTX, TSX<input type="file" accept=".pdf,.pptx,.tsx" multiple disabled={busy} onChange={event => {
      const selected = Array.from(event.target.files ?? []);
      setUploads(current => [...current.filter(item => item.status !== "done"), ...selected.map(file => ({ file, id: crypto.randomUUID(), status: "ready" as const }))]);
      event.target.value = "";
    }} /></label>
    {!!uploads.length && <><ul className={styles.list}>{uploads.map(item => <li key={item.id}><strong>{item.file.name}</strong><label className={styles.field}>Drive file name<input placeholder="Use default name" value={item.name ?? ""} maxLength={150} disabled={busy || item.status === "done" || item.status === "failed"} onChange={event => setUploads(current => current.map(row => row.id === item.id ? { ...row, name: event.target.value } : row))} /></label><span>{item.status === "uploading" ? "Saving to Drive…" : item.status === "done" ? "Saved" : item.status === "failed" ? item.message : "Ready"}</span></li>)}</ul><button className={styles.upload} type="button" disabled={busy || !destinationId || !uploads.some(item => item.status === "ready" || item.status === "failed")} onClick={() => void uploadFiles()}>{busy ? "Saving…" : "Save source files to Drive"}</button></>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <ul className={styles.list}>{sources.map(source => <li key={source.id}><strong>{source.original_filename}</strong><span>{source.file_type.toUpperCase()} · {(source.byte_size / 1024 / 1024).toFixed(2)} MB · {source.status === "ready" ? "Saved to Drive" : source.status === "failed" ? "Incomplete · Retry needed" : "Saving"}</span></li>)}</ul>
    {!sources.length && !error && <p className={styles.empty}>No source files in this section yet.</p>}
  </section>;
}
