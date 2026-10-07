"use client";

import { useRef, useState } from "react";
import type { CourseSystemIcon } from "@/lib/auth/types";
import { compressAndResizeIcon } from "@/lib/courseIconImage";
import styles from "./AdminAccessPortal.module.css";

export default function CourseSystemIcons({ icons, editable, disabled = false, onSave }: {
  icons: CourseSystemIcon[]; editable: boolean; disabled?: boolean;
  onSave: (icons: CourseSystemIcon[]) => Promise<boolean>;
}) {
  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inFlight = useRef(false);
  const locked = disabled || Boolean(processing) || !editable;

  async function save(updated: CourseSystemIcon[]) {
    if (inFlight.current || locked) return;
    inFlight.current = true; setError(""); setProcessing("Saving icons…");
    try { if (!await onSave(updated)) setError("Unable to save icons. Please try again."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save icons."); }
    finally { inFlight.current = false; setProcessing(""); }
  }
  async function add(file: File | Blob, name = "") {
    if (inFlight.current || locked) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Choose a PNG, JPG, WEBP or SVG image up to 10 MB."); return;
    }
    inFlight.current = true; setError(""); setProcessing("Preparing icon…");
    try {
      const url = await compressAndResizeIcon(file, 64, 64, true);
      setProcessing("Saving icon…");
      const next = [...icons, { id: `icon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), url, scale: 1 }];
      if (!await onSave(next)) setError("Unable to save the icon. Please try again.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to process this image."); }
    finally { inFlight.current = false; setProcessing(""); }
  }
  function addFile(file?: File) {
    if (file) void add(file, file.name.replace(/\.[^/.]+$/, ""));
  }

  return <div className={styles.systemIconsBlock}>
    <div className={styles.systemIconsHeader}>
      <div className={styles.systemIconsTitleArea}><div className={styles.badgeIndex}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg></div><div><h3>Tech Stack Icons ({icons.length})</h3><p>{editable ? "Paste with Ctrl+V or upload" : "Course technology & tools"}</p></div></div>
      {editable && <div className={styles.systemIconsHeaderActions}><label className={styles.iconUploadBtn}>Upload icon<input type="file" aria-label="Upload course icon" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={locked} hidden onChange={e => { addFile(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/></label></div>}
    </div>
    {editable && <div className={`${styles.iconPasteZone} ${dragging ? styles.iconPasteZoneDragActive : ""} ${processing ? styles.iconPasteZoneBusy : ""}`} tabIndex={locked ? -1 : 0} aria-label="Paste or drop course icon" aria-busy={Boolean(processing)}
      onPaste={e => { if (locked) return; const image = Array.from(e.clipboardData.items).find(item => item.type.startsWith("image/")); const file = image?.getAsFile(); if (file) { e.preventDefault(); void add(file); } }}
      onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); if (!locked) addFile(Array.from(e.dataTransfer.files).find(file => file.type.startsWith("image/"))); }}>
      <div className={styles.pasteZoneContent}>{processing ? <><span className={styles.iconLoadingSpinner} aria-hidden="true"/><span role="status">{processing}</span></> : <><span className={styles.pasteShortcut}>Ctrl + V</span><span className={styles.pasteZoneText}>{dragging ? "Drop your image here" : "Paste an image or drag an icon here"}</span></>}</div>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {icons.length ? <div className={styles.systemIconsGrid}>{icons.map(icon => <div key={icon.id} className={styles.systemIconItem}>
      <div className={styles.systemIconPreviewWrap}>
        {/* Prepared 64px icons are already compressed and may use data URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon.url} alt={icon.name || "Course icon"} className={styles.systemIconAdminImg}/>
      </div>
      {editable ? <><input key={`${icon.id}:${icon.name}`} className={styles.systemIconNameInput} defaultValue={icon.name} maxLength={120} aria-label={`Label for ${icon.name || "course icon"}`} placeholder="Label (optional)" disabled={locked} onBlur={e => { const name = e.currentTarget.value.trim(); if (name !== icon.name) void save(icons.map(item => item.id === icon.id ? { ...item, name } : item)); }}/><button type="button" className={styles.systemIconDeleteBtn} disabled={locked} aria-label={`Delete icon ${icon.name || icon.id}`} onClick={() => void save(icons.filter(item => item.id !== icon.id))}>✕</button></> : <span>{icon.name}</span>}
    </div>)}</div> : <div className={styles.noIconsNotice}>{editable ? "No icons added yet. Paste an image or choose Upload icon." : "No course icons yet."}</div>}
  </div>;
}
