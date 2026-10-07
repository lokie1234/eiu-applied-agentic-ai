"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SectionSourceLibrary.module.css";

type Source = { id: string; original_filename: string; exported_filename: string; file_type: string; byte_size: number; status: string; created_at: string };
type Upload = { file: File; id: string; status: "ready" | "uploading" | "done" | "failed"; message?: string };

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
  const [sources, setSources] = useState<Source[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/admin/sections/${encodeURIComponent(sectionId)}/sources`;
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Không tải được thư viện nguồn.");
    setSources(data.sources);
  }, [endpoint]);
  useEffect(() => { void refresh().catch(error => setError(error.message)); }, [refresh]);

  async function uploadFiles() {
    setBusy(true); setError("");
    try {
      for (const item of uploads.filter(item => item.status === "ready" || item.status === "failed")) {
        setUploads(current => current.map(row => row.id === item.id ? { ...row, status: "uploading", message: undefined } : row));
        try {
          const body = new FormData(); body.set("file", item.file); body.set("sourceId", item.id);
          const response = await fetch(endpoint, { method: "POST", body });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Upload thất bại.");
          setUploads(current => current.map(row => row.id === item.id ? { ...row, status: "done" } : row));
        } catch (error) {
          setUploads(current => current.map(row => row.id === item.id ? { ...row, status: "failed", message: error instanceof Error ? error.message : "Upload thất bại." } : row));
        }
      }
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Không tải được danh sách."); }
    finally { setBusy(false); }
  }

  return <section className={styles.library} aria-label={`Source files for ${sectionTitle}`}>
    <div className={styles.heading}><div><h3>Source files · {sectionTitle}</h3><p>Bản gốc lưu trên Drive. Upload thêm không thay bài đang dạy.</p></div><button type="button" onClick={() => void refresh().then(() => setError("")).catch(error => setError(error.message))} disabled={busy}>Refresh</button></div>
    <label className={styles.picker}>+ Chọn PDF, PPTX, TSX<input type="file" accept=".pdf,.pptx,.tsx" multiple disabled={busy} onChange={event => {
      const selected = Array.from(event.target.files ?? []);
      setUploads(current => [...current.filter(item => item.status !== "done"), ...selected.map(file => ({ file, id: crypto.randomUUID(), status: "ready" as const }))]);
      event.target.value = "";
    }} /></label>
    {!!uploads.length && <><ul className={styles.list}>{uploads.map(item => <li key={item.id}><strong>{item.file.name}</strong><span>{item.status === "uploading" ? "Đang lưu vào Drive…" : item.status === "done" ? "Đã lưu" : item.status === "failed" ? item.message : "Sẵn sàng"}</span></li>)}</ul><button className={styles.upload} type="button" disabled={busy || !uploads.some(item => item.status === "ready" || item.status === "failed")} onClick={() => void uploadFiles()}>{busy ? "Đang lưu…" : "Lưu file nguồn vào Drive"}</button></>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <ul className={styles.list}>{sources.map(source => <li key={source.id}><strong>{source.original_filename}</strong><span>{source.file_type.toUpperCase()} · {(source.byte_size / 1024 / 1024).toFixed(2)} MB · {source.status === "ready" ? "Đã lưu trên Drive" : source.status === "failed" ? "Chưa lưu xong · cần thử lại" : "Đang lưu"}</span><small>{source.exported_filename}</small></li>)}</ul>
    {!sources.length && !error && <p className={styles.empty}>Chưa có file nguồn trong section này.</p>}
  </section>;
}
