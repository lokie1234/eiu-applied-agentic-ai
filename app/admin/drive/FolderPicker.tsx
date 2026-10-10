"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
type Destination = { id: string; label: string; folder_id: string };
import { loadPicker } from "@/lib/googlePicker";
export default function FolderPicker({ configured }: { configured: boolean }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const working = useRef(false);
  function reset() { setId(""); setLabel(""); setSelectedFolder(null); }
  useEffect(() => { void fetch("/api/admin/drive/destinations", { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setDestinations(data.destinations); }).catch(error => setMessage(error.message)); }, []);
  async function save(action = "save", target = id) {
    if (working.current || (action === "save" && (!selectedFolder || !label.trim()))) return;
    working.current = true;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/drive/destinations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: target || undefined, label: label.trim(), link: selectedFolder ? "https://drive.google.com/drive/folders/" + selectedFolder.id : undefined }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setDestinations(data.destinations); reset(); setMessage(action === "delete" ? "Destination removed. Files in Drive are unchanged." : "Drive destination saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save folder."); }
    finally { working.current = false; setBusy(false); }
  }
  async function browse() {
    if (working.current || !configured) return;
    working.current = true;
    setBusy(true); setMessage("");
    try {
      await loadPicker();
      const response = await fetch("/api/admin/drive/picker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "browse" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder");
      const picker = new google.picker.PickerBuilder().addView(view).setOAuthToken(data.accessToken).setDeveloperKey(data.apiKey).setAppId(data.appId).setOrigin(window.location.origin).setTitle("Choose a Drive destination").setCallback(result => {
        if (result.action === google.picker.Action.PICKED) { const folder = result.docs?.[0]; if (folder?.id) { setSelectedFolder({ id: folder.id, name: folder.name || "Drive folder" }); setLabel(current => id ? current : folder.name || "Drive folder"); } }
        if (result.action === google.picker.Action.PICKED || result.action === google.picker.Action.CANCEL) { working.current = false; setBusy(false); picker.dispose(); }
      }).build(); picker.setVisible(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open Drive."); working.current = false; setBusy(false); }
  }
  return <>
    <form className={styles.destinationForm} onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className={styles.folderSelection}>
        <span className={styles.driveMark}><Image src="/branding/apps/google-drive.svg" width={28} height={28} alt="" /></span>
        <div><strong>{selectedFolder ? selectedFolder.name : "Choose a destination folder"}</strong><p>{selectedFolder ? id ? "Folder selected · Ready to save" : "Folder selected · Ready to add" : "Choose a folder to receive files saved from the web."}</p></div>
        <button className={styles.browseButton} type="button" disabled={busy || !configured} onClick={() => void browse()}>Browse folders<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
      </div>
      {selectedFolder && <label className={styles.destinationName}>Display name<input value={label} onChange={event => setLabel(event.target.value)} placeholder="Course materials" maxLength={100} required disabled={busy} /></label>}
      <div className={styles.formFooter}><p className={styles.note}>{configured ? "Web section files will be saved here." : "Drive browsing is not configured yet."}</p><div className={styles.actions}>{(id || selectedFolder) && <button className={styles.secondaryButton} type="button" disabled={busy} onClick={reset}>Cancel</button>}<button className={styles.button} type="submit" disabled={busy || !selectedFolder || !label.trim()}>{busy ? "Working…" : id ? "Save changes" : "Add destination"}</button></div></div>
    </form>
    <div className={styles.savedHeading}><h3>Saved destinations</h3><span>{destinations.length}</span></div>
    <div className={styles.folders}>{destinations.map(folder => <div key={folder.id}><span className={styles.folderBadge}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3Z"/></svg></span><div className={styles.folderDetails}><strong>{folder.label}</strong><a href={"https://drive.google.com/drive/folders/" + folder.folder_id} target="_blank" rel="noreferrer">Open in Drive ↗</a></div><div className={styles.actions}><button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => { setId(folder.id); setLabel(folder.label); setSelectedFolder({ id: folder.folder_id, name: folder.label }); setMessage(""); }}>Edit</button><button className={styles.removeButton} type="button" disabled={busy} onClick={() => { if (window.confirm("Remove this destination? Files in Drive will be kept.")) void save("delete", folder.id); }}>Remove</button></div></div>)}</div>
    {!destinations.length && <div className={styles.emptyState}><strong>No destinations yet</strong><p>Choose your first folder with Browse folders.</p></div>}
    {message && <p className={styles.notice} role="status">{message}</p>}
  </>;
}
