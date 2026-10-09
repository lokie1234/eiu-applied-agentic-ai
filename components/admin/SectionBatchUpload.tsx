"use client";

import { useState } from "react";
import styles from "./AdminAccessPortal.module.css";

type Target = { id: string; title: string; content_path?: string | null; section_key: string };
type Item = { id: number; file: File; sectionId: string; state: "ready" | "queued" | "uploading" | "done" | "error"; progress: number };

export default function SectionBatchUpload({ sections, coreCourse, upload, disabled = false }: {
  sections: Target[]; coreCourse: boolean;
  disabled?: boolean;
  upload: (section: Target, file: File, progress: (value: number) => void) => Promise<boolean>;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const patch = (id: number, update: Partial<Item>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  function select(files: FileList | File[]) {
    if (running || disabled) return;
    const available = [...sections.filter((section) => !section.content_path), ...sections.filter((section) => section.content_path)];
    setItems(Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((file, index) => ({
      id: index, file, sectionId: available[index]?.id || "", state: "ready", progress: 0,
    })));
  }
  const pending = items.filter((item) => item.state !== "done");
  const valid = pending.length > 0 && new Set(items.map((item) => item.sectionId)).size === items.length && pending.every((item) => {
    const section = sections.find((target) => target.id === item.sectionId);
    return section && item.file.size > 0 && item.file.size <= 50 * 1024 * 1024 && /\.(pdf|tsx|pptx)$/i.test(item.file.name) &&
      (!coreCourse || !["section1", "section2"].includes(section.section_key) || /\.pptx$/i.test(item.file.name));
  });
  async function start() {
    if (!valid || running || disabled) return;
    setRunning(true);
    for (const item of pending) patch(item.id, { state: "queued" });
    try {
      for (const item of pending) {
        const target = sections.find((section) => section.id === item.sectionId)!;
        patch(item.id, { state: "uploading", progress: 0 });
        const ok = await upload(target, item.file, (progress) => patch(item.id, { progress }));
        patch(item.id, { state: ok ? "done" : "error" });
      }
    } finally { setRunning(false); }
  }
  return <div className={styles.batchUpload}>
    <div className={`${styles.batchDropZone} ${dragging ? styles.sectionDropTarget : ""}`}
      onDragOver={(event) => { event.preventDefault(); if (!running && !disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files); }}>
      <div><strong>Upload files to Drive</strong><p>Files are saved to your selected Drive destination and connected to sections. Empty sections are paired first.</p></div>
      <label className={styles.sectionUploadButton}>Choose local files<input type="file" multiple hidden accept=".pdf,.tsx,.pptx" disabled={running || disabled}
        onChange={(event) => { if (event.currentTarget.files) select(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
    </div>
    {items.length > 0 && <>
      <div className={styles.batchFileList}>{items.map((item) => <div key={item.id} className={styles.batchFileRow}>
        <span title={item.file.name}>{item.file.name}<small>{(item.file.size / 1024 / 1024).toFixed(1)} MB</small></span>
        <select aria-label={`Section for ${item.file.name}`} value={item.sectionId} disabled={running || item.state === "done"}
          onChange={(event) => patch(item.id, { sectionId: event.target.value, state: "ready" })}>
          <option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}{section.content_path ? " · Replace file" : ""}</option>)}
        </select>
        <span role="status">{item.state === "uploading" ? item.progress < 100 ? `${item.progress}%` : "Saving…" : { ready: "Ready", queued: "Queued", done: "✓ Done", error: "Failed · retry" }[item.state]}</span>
      </div>)}</div>
      <div className={styles.batchActions}><span>{items.filter((item) => item.state === "done").length}/{items.length} complete · 1 file per section</span>
        <button type="button" className={styles.addSectionButton} disabled={!valid || running || disabled} onClick={() => void start()}>{running ? "Uploading…" : `Upload ${pending.length} files to Drive`}</button>
        <button type="button" className={styles.removeBtn} disabled={running} onClick={() => setItems([])}>Clear</button>
      </div>
      {!valid && pending.length > 0 && <p>Choose a different section for each file. PDF / TSX / PPTX, up to 50 MB each; built-in lessons accept PPTX.</p>}
    </>}
  </div>;
}
