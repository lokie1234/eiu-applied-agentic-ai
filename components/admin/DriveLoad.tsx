"use client";
import { useRef, useState } from "react";
import { loadPicker } from "@/lib/googlePicker";
import styles from "./SectionSourceLibrary.module.css";

type Section = { id: string; title: string; courseTitle?: string; content_path?: string | null };
type Item = { fileId: string; name: string; sectionId: string; state: "ready" | "done" | "failed"; message?: string };
export default function DriveLoad({ sections, label = "Load from Drive", onLoaded }: { sections: Section[]; label?: string; onLoaded: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function add(files: {id: string; name: string}[]) {
    setItems(current => {
      const unique = files.filter(file => !current.some(item => item.fileId === file.id));
      const available = [...sections.filter(section => !section.content_path), ...sections.filter(section => section.content_path)].filter(section => !current.some(item => item.sectionId === section.id));
      return [...current, ...unique.map((file, index) => ({fileId:file.id,name:file.name,sectionId:available[index]?.id || "",state:"ready" as const}))];
    });
  }
  async function browse() {
    if (busy) return;
    setBusy(true);setError("");
    try {
      await loadPicker();
      const response = await fetch("/api/admin/drive/picker", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"browse"})});
      const payload = await response.json();if (!response.ok) throw Error(payload.message);
      // Native dialogs sit above Picker's overlay; restore our dialog after selection.
      dialog.current?.close();
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
      const picker = new google.picker.PickerBuilder().addView(view).enableFeature(google.picker.Feature.MULTISELECT_ENABLED).setOAuthToken(payload.accessToken).setDeveloperKey(payload.apiKey).setAppId(payload.appId).setOrigin(window.location.origin).setTitle("Choose PDF, PPTX or TSX files for your sections").setCallback(result => {
        if (result.action === google.picker.Action.PICKED) add((result.docs || []).map(file => ({id:file.id,name:file.name || "Drive file"})));
        if ([google.picker.Action.PICKED,google.picker.Action.CANCEL].includes(result.action as google.picker.Action)) {picker.dispose();setBusy(false);dialog.current?.showModal();}
      }).build();picker.setVisible(true);
    } catch (error) {setError(error instanceof Error ? error.message : "Unable to open Drive.");setBusy(false);if (dialog.current && !dialog.current.open) dialog.current.showModal();}
  }
  const pending = items.filter(item => item.state !== "done");
  const valid = pending.length > 0 && pending.every(item => sections.some(section => section.id === item.sectionId)) && new Set(items.map(item => item.sectionId)).size === items.length;
  async function connect() {
    if (busy || !valid) return;
    setBusy(true);setError("");
    try {
      for (const item of pending) {
        try {
          const response = await fetch(`/api/admin/sections/${encodeURIComponent(item.sectionId)}/content`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"link",fileId:item.fileId})});
          const payload = await response.json();if (!response.ok || !payload.success) throw Error(payload.message || "Unable to load file.");
          setItems(current => current.map(row => row.fileId === item.fileId ? {...row,state:"done",name:payload.sourceFilename,message:"Connected to deck"} : row));
        } catch (error) {setItems(current => current.map(row => row.fileId === item.fileId ? {...row,state:"failed",message:error instanceof Error ? error.message : "Unable to load file."} : row));}
      }
      await onLoaded();
    } catch {setError("Files were processed, but the catalog could not refresh. Close and reopen course setup.");}
    finally {setBusy(false);}
  }
  return <><button type="button" className={styles.launcher} disabled={!sections.length} onClick={() => {setItems([]);setError("");setLink("");dialog.current?.showModal();}}>{label}</button>
    <dialog ref={dialog} className={styles.dialog} aria-label="Load files from Google Drive" onCancel={event => {if (busy) event.preventDefault();}}>
      <div className={styles.dialogHeader}><strong>Load from Drive</strong><button type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Close">×</button></div>
      <section className={styles.library} aria-busy={busy}><div className={styles.heading}><div><h3>Connect Drive files to your deck</h3><p>Files stay in Drive. Choose one PDF, PPTX or TSX per section, up to 50 MB each. Connecting a file replaces that section’s current file; built-in lessons accept PPTX attachments only.</p></div></div>
      <button type="button" disabled={busy} onClick={() => void browse()}>Browse Drive</button>
      <form onSubmit={event => {event.preventDefault();if(link.trim()){add([{id:link.trim(),name:"Drive file"}]);setLink("");}}}><label className={styles.field}>Or paste a Drive file link / ID<input value={link} disabled={busy} onChange={event => setLink(event.target.value)} placeholder="https://drive.google.com/file/d/…/view" /></label><button type="submit" disabled={busy || !link.trim()}>Add file</button></form>
      <p className={styles.empty}>Use Browse Drive to grant the app access to files not previously selected.</p>
      <ul className={styles.list}>{items.map(item => <li key={item.fileId}><strong>{item.name}</strong><label className={styles.field}>Section<select value={item.sectionId} disabled={busy || item.state === "done"} onChange={event => setItems(current => current.map(row => row.fileId === item.fileId ? {...row,sectionId:event.target.value,state:"ready",message:undefined} : row))}><option value="">Choose section</option>{sections.map(section => <option key={section.id} value={section.id}>{section.courseTitle ? section.courseTitle + " / " : ""}{section.title}{section.content_path ? " — Replace file" : ""}</option>)}</select></label><span>{item.message || "Ready"}</span>{item.state !== "done" && <button type="button" disabled={busy} onClick={() => setItems(current => current.filter(row => row !== item))}>Remove</button>}</li>)}</ul>
      {busy && <p role="status">loading..... Connecting Drive files. Please wait.</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {items.length > 0 && <button type="button" className={styles.upload} disabled={busy || !valid} onClick={() => void connect()}>{busy ? "loading....." : "Load selected files into deck"}</button>}
      </section>
    </dialog></>;
}
