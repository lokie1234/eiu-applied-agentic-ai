"use client";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
type Destination = { id: string; label: string; folder_id: string };
let pickerLoading: Promise<void> | null = null;
function loadPicker() {
  if (typeof google !== "undefined" && google.picker) return Promise.resolve();
  if (!pickerLoading) pickerLoading = new Promise<void>((resolve, reject) => {
    const init = () => gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Unable to load Google Picker.")), timeout: 15000, ontimeout: () => reject(new Error("Google Picker timed out.")) });
    if (typeof gapi !== "undefined") return init();
    const script = document.createElement("script"); script.src = "https://apis.google.com/js/api.js"; script.async = true;
    script.onload = init; script.onerror = () => reject(new Error("Unable to load Google Picker.")); document.head.appendChild(script);
  }).catch(error => { pickerLoading = null; throw error; });
  return pickerLoading;
}
export default function FolderPicker({ configured }: { configured: boolean }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [id, setId] = useState(""); const [label, setLabel] = useState(""); const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/admin/drive/destinations", { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setDestinations(data.destinations); }).catch(error => setMessage(error.message)); }, []);
  async function save(action = "save", target = id) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/drive/destinations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: target || undefined, label, link }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setDestinations(data.destinations); setId(""); setLabel(""); setLink(""); setMessage(action === "delete" ? "Destination removed. Files in Drive are unchanged." : "Drive destination saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save folder."); }
    finally { setBusy(false); }
  }
  async function browse() {
    setBusy(true); setMessage("");
    try {
      await loadPicker();
      const response = await fetch("/api/admin/drive/picker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "browse" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder");
      const picker = new google.picker.PickerBuilder().addView(view).setOAuthToken(data.accessToken).setDeveloperKey(data.apiKey).setAppId(data.appId).setOrigin(window.location.origin).setTitle("Choose a Drive destination").setCallback(result => {
        if (result.action === google.picker.Action.PICKED) { const folder = result.docs?.[0]; if (folder) { setLink("https://drive.google.com/drive/folders/" + folder.id); setLabel(current => current || folder.name || "Drive folder"); } }
        if (result.action === google.picker.Action.PICKED || result.action === google.picker.Action.CANCEL) { setBusy(false); picker.dispose(); }
      }).build(); picker.setVisible(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open Drive."); setBusy(false); }
  }
  return <>
    <form className={styles.destinationForm} onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>Display name<input value={label} onChange={event => setLabel(event.target.value)} placeholder="Course materials" maxLength={100} required disabled={busy} /></label>
      <label>Drive folder link<input value={link} onChange={event => setLink(event.target.value)} placeholder="https://drive.google.com/drive/folders/…" required disabled={busy} /></label>
      <div className={styles.actions}><button type="button" disabled={busy || !configured} onClick={() => void browse()}>Browse Drive</button><button type="submit" disabled={busy}>{busy ? "Working…" : id ? "Save changes" : "Add destination"}</button>{id && <button type="button" disabled={busy} onClick={() => { setId(""); setLabel(""); setLink(""); }}>Cancel</button>}</div>
    </form>
    <p className={styles.note}>Choose a folder with Browse Drive to grant access. You can rename destinations or replace their links at any time.</p>
    <div className={styles.folders}>{destinations.map(folder => <div key={folder.id}><div><strong>{folder.label}</strong><a href={"https://drive.google.com/drive/folders/" + folder.folder_id} target="_blank" rel="noreferrer">Open folder ↗</a></div><div className={styles.actions}><button type="button" disabled={busy} onClick={() => { setId(folder.id); setLabel(folder.label); setLink("https://drive.google.com/drive/folders/" + folder.folder_id); }}>Edit</button><button type="button" disabled={busy} onClick={() => { if (window.confirm("Remove this destination? Files in Drive will be kept.")) void save("delete", folder.id); }}>Remove</button></div></div>)}</div>
    {!destinations.length && <p className={styles.note}>Add a destination to make it available in folder and section exports.</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}
  </>;
}
