"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./admin/TeacherAccounts.module.css";
import layout from "./TeacherPortal.module.css";
import { uploadSectionFile } from "@/lib/uploadSectionFile";
type Course = { id: string; title: string; summary: string; languageLabel: string; canEdit: boolean };
type Section = { id: string; course_id: string; title: string; canEdit: boolean; source_filename: string | null };
async function api(body?: Record<string, unknown>) {
  const res = await fetch("/api/admin/access", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await res.json(); if (!res.ok) throw new Error(data.message); return data;
}
export default function TeacherPortal({ name }: { name: string }) {
  const [courses, setCourses] = useState<Course[]>([]); const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState(""); const [newSection, setNewSection] = useState(""); const [courseId, setCourseId] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [progress, setProgress] = useState(0);
  useEffect(() => {
    let active = true;
    api().then(data => { if (active) { setCourses(data.courses); setSections(data.sections); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function request(body: Record<string, unknown>) {
    if (busy) return; setBusy(true); setError("");
    try { const data = await api(body); setCourses(data.courses); setSections(data.sections); if (body.action === "create_course") setTitle(""); if (body.action === "create_section") setNewSection(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save changes."); } finally { setBusy(false); }
  }
  async function upload(section: Section, file: File) {
    if (busy) return; setBusy(true); setError(""); setProgress(0);
    try { await uploadSectionFile(`/api/admin/sections/${section.id}/content`, file, setProgress); const data = await api(); setCourses(data.courses); setSections(data.sections); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to upload content."); } finally { setBusy(false); }
  }
  const selected = courses.find(c => c.id === courseId) ?? courses[0];
  const courseSections = sections.filter(s => s.course_id === selected?.id);
  return <main className={layout.page}><header className={layout.header}><div><h1>Teacher Workspace</h1><p>{name} · Create courses and manage your own sections</p></div><nav><Link href="/learn">View all courses</Link><Link href="/change-password">Change password</Link><button className={styles.button} onClick={async () => { await fetch("/api/signout", { method: "POST" }); window.location.replace("/"); }}>Sign out</button></nav></header>
    {error && <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p>}{busy && <p role="status">Processing… {progress > 0 ? `${progress}%` : ""}</p>}
    <div className={layout.content}><div className={layout.courses}><aside className={`${styles.card} ${layout.sidebar}`}><h2>Courses</h2><form className={styles.form} onSubmit={e => { e.preventDefault(); void request({ action: "create_course", title }); }}><label>NEW COURSE TITLE<input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required maxLength={120}/></label><button className={styles.primary} disabled={busy || loading}>+ Create course</button></form>
      {courses.map(c => <button className={`${layout.course} ${selected?.id === c.id ? layout.selected : ""}`} key={c.id} onClick={() => setCourseId(c.id)}><b>{c.title}</b><small>{c.canEdit ? "Your course" : "Read only"}</small></button>)}</aside>
      <section className={`${styles.card} ${layout.detail}`}><h2>{selected?.title ?? (loading ? "Loading…" : "No courses yet")}</h2>{selected && <><p>{selected.summary}</p>{selected.canEdit ? <>
        <form key={selected.id} className={styles.form} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void request({ action: "update_course_title", courseId: selected.id, title: form.get("title") }); }}><label>COURSE TITLE<input className={styles.input} name="title" defaultValue={selected.title} maxLength={120} required/></label><button className={styles.button} disabled={busy}>Save course title</button></form>
        <form key={`summary-${selected.id}`} className={styles.form} onSubmit={e => { e.preventDefault(); void request({ action: "update_course_summary", courseId: selected.id, summary: new FormData(e.currentTarget).get("summary") }); }}><label>DESCRIPTION<input className={styles.input} name="summary" defaultValue={selected.summary}/></label><button className={styles.button} disabled={busy}>Save description</button></form>
        <label>Language <select className={styles.select} value={selected.languageLabel} disabled={busy} onChange={e => void request({ action: "set_course_language", courseId: selected.id, languageLabel: e.target.value })}><option value="vi">Vietnamese</option><option value="en">English</option><option value="vi_en">Vietnamese & English</option></select></label>
        <button className={styles.danger} disabled={busy} onClick={() => { if (window.confirm(`Delete course “${selected.title}” and all your sections?`)) void request({ action: "delete_course", courseId: selected.id }); }}>Delete course</button>
        <form className={styles.form} onSubmit={e => { e.preventDefault(); void request({ action: "create_section", courseId: selected.id, title: newSection }); }}><label>NEW SECTION<input className={styles.input} value={newSection} onChange={e => setNewSection(e.target.value)} maxLength={120} required/></label><button className={styles.primary} disabled={busy}>+ Add section</button></form>
      </> : <p className={styles.badge}>Read only · Owned by another teacher or the admin</p>}
      {courseSections.map((s, index) => <article className={layout.section} key={s.id}><h3>{index + 1}. {s.title}</h3><p>{s.source_filename || "No content file uploaded"}</p>{s.canEdit ? <div className={layout.sectionActions}>
        <form onSubmit={e => { e.preventDefault(); void request({ action: "rename_section", sectionId: s.id, title: new FormData(e.currentTarget).get("title") }); }}><input className={styles.input} name="title" aria-label={`Section title for ${s.title}`} defaultValue={s.title} required maxLength={120}/><button className={styles.button} disabled={busy}>Save title</button></form>
        <label className={styles.button}>Upload PDF / TSX / PPTX<input type="file" hidden disabled={busy} accept=".pdf,.tsx,.pptx" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void upload(s, file); e.currentTarget.value = ""; }}/></label>
        {selected.canEdit && courseSections.every(item => item.canEdit) && index > 0 && <button className={styles.button} disabled={busy} onClick={() => { const ids = courseSections.map(item => item.id); [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]]; void request({ action: "reorder_sections", courseId: selected.id, sectionIds: ids }); }}>↑ Move up</button>}
        <button className={styles.danger} disabled={busy} onClick={() => { if (window.confirm(`Delete section “${s.title}”?`)) void request({ action: "delete_section", sectionId: s.id }); }}>Delete</button>
      </div> : <span className={styles.badge}>Read only</span>}</article>)}
      </>}
      </section></div></div>
  </main>;
}
