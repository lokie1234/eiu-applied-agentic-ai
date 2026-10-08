"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import styles from "./SectionSourceLibrary.module.css";
type Destination = { id: string; label: string };
type Task = { sectionId: string; sourceId?: string; name: string; unavailable?: string; status?: "done" | "failed"; message?: string };
export default function DriveExport({ groupId, courseId, sectionId, label = "Save to Drive" }: { groupId?: string; courseId?: string; sectionId?: string; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]); const [destinationId, setDestinationId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]); const [planned, setPlanned] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function open() {
    dialog.current?.showModal(); setMessage(""); setTasks([]); setPlanned(false);
    try { const response = await fetch("/api/admin/drive/destinations", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setDestinations(data.destinations); setDestinationId(data.destinations[0]?.id ?? ""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load destinations."); }
  }
  async function request(payload: object) {
    const response = await fetch("/api/admin/drive/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationId, groupId, courseId, sectionId, ...payload }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message); return data;
  }
  async function preview() {
    setBusy(true); setMessage("");
    try { const data = await request({ action: "plan" }); setTasks(data.tasks); setPlanned(true); if (!data.tasks.length) setMessage("No stored PDF, PPTX or TSX documents are available in this selection."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to read documents."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMessage(""); let failures = 0; let completed = tasks.filter(task => task.status === "done").length;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]; if (task.unavailable || task.status === "done") continue;
      setMessage("Saving " + (completed + 1) + " of " + tasks.filter(item => !item.unavailable).length + "…");
      try { await request({ action: "save", sectionId: task.sectionId, sourceId: task.sourceId, name: task.name }); completed++; setTasks(current => current.map((item,index) => index === i ? { ...item, status: "done", message: undefined } : item)); }
      catch (error) { failures++; setTasks(current => current.map((item,index) => index === i ? { ...item, status: "failed", message: error instanceof Error ? error.message : "Unable to save document." } : item)); }
    }
    setMessage(completed + " document(s) saved." + (failures ? " " + failures + " failed. Retry to save the remaining files." : "")); setBusy(false);
  }
  return <><button type="button" className={styles.launcher} onClick={() => void open()}>{label}</button><dialog ref={dialog} className={styles.dialog} onCancel={event => { if (busy) event.preventDefault(); }} aria-label="Save documents to Google Drive"><div className={styles.dialogHeader}><strong>{groupId || courseId ? "Save folder to Google Drive" : "Save section to Google Drive"}</strong><button type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Close">×</button></div><section className={styles.library}>
    <p>{groupId ? "A Drive folder with the same name as your web folder will contain the section documents." : "Save the existing section documents to your selected Drive destination."}</p>
    <label className={styles.field}>Drive destination<select value={destinationId} disabled={busy} onChange={event => { setDestinationId(event.target.value); setPlanned(false); setTasks([]); }}><option value="">Choose a destination</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <Link href="/admin/drive">Manage Drive destinations ↗</Link>
    {!planned && <button className={styles.upload} type="button" disabled={busy || !destinationId} onClick={() => void preview()}>{busy ? "Loading…" : "Review documents"}</button>}
    <ul className={styles.list}>{tasks.map((task,i) => <li key={task.sectionId + (task.sourceId ?? "published")}><label className={styles.field}>File name<input value={task.name} disabled={busy || task.status === "done" || !!task.unavailable} maxLength={150} onChange={event => setTasks(current => current.map((item,index) => index === i ? { ...item, name: event.target.value } : item))} /></label><span>{task.unavailable ?? (task.status === "done" ? "Saved to Drive" : task.message ?? "Ready · Edit the name or keep the default")}</span></li>)}</ul>
    {planned && tasks.some(task => !task.unavailable && task.status !== "done") && <button type="button" className={styles.upload} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : tasks.some(task => task.status === "failed") ? "Retry remaining files" : "Save to Drive"}</button>}
    {message && <p role="status" className={styles.error}>{message}</p>}
  </section></dialog></>;
}
