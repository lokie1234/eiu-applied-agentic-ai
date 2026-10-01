"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminAccessPortal.module.css";

type LanguageLabel = "vi" | "en" | "vi_en";
type Course = { id: string; slug: string; title: string; description: string | null; status: "draft" | "active"; language_label: LanguageLabel };
type Section = { id: string; course_id: string; section_key: string; title: string; position: number; status: "draft" | "active" };
type Passcode = { id: string; course_id: string; code_hint: string; status: string; last_used_at: string | null; created_at: string };
type Payload = { success: boolean; message?: string; courses?: Course[]; sections?: Section[]; passcodes?: Passcode[]; generatedCode?: string };

const languageOptions: Array<{ value: LanguageLabel; label: string }> = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
  { value: "vi_en", label: "Vietnamese and English" },
];

export default function AdminAccessPortal({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<"access" | "catalog">("access");
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
  const [courseId, setCourseId] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newSections, setNewSections] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const apply = useCallback((payload: Payload) => {
    setCourses(payload.courses ?? []);
    setSections(payload.sections ?? []);
    setPasscodes(payload.passcodes ?? []);
  }, []);

  useEffect(() => {
    let disposed = false;
    void fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as Payload;
        if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load data.");
        if (!disposed) apply(payload);
      })
      .catch((caught) => { if (!disposed) setError(caught instanceof Error ? caught.message : "Unable to load data."); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [apply]);

  const activeCourses = useMemo(() => courses.filter((course) => course.status === "active"), [courses]);
  const effectiveCourseId = activeCourses.some((course) => course.id === courseId) ? courseId : activeCourses[0]?.id ?? "";
  const selectedCourse = activeCourses.find((course) => course.id === effectiveCourseId) ?? null;
  const selectedPasscode = passcodes.find((item) => item.course_id === effectiveCourseId) ?? null;

  async function mutate(body: Record<string, unknown>, key: string, success: string) {
    setBusy((current) => new Set(current).add(key));
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to save changes.");
      apply(payload); setNotice(success); return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save changes."); return false;
    } finally {
      setBusy((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  async function generatePasscode() {
    const response = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_course_passcode", courseId: effectiveCourseId }),
    });
    const payload = await response.json() as Payload;
    if (!response.ok || !payload.success || !payload.generatedCode) {
      throw new Error(payload.message || "Unable to generate a passcode.");
    }
    apply(payload);
    setGeneratedCode(payload.generatedCode);
  }

  async function handleGeneratePasscode() {
    const replacing = Boolean(selectedPasscode);
    if (replacing && !confirm("Generate a new passcode? The current code and its active sessions will be revoked.")) return;
    const key = `access:${effectiveCourseId}`;
    setBusy((current) => new Set(current).add(key));
    setError(""); setNotice("");
    try {
      await generatePasscode();
      setNotice(replacing ? "A new four-digit passcode was generated and the previous code was revoked." : "A four-digit folder passcode was generated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate a passcode.");
    } finally {
      setBusy((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  async function deletePasscode() {
    if (!selectedPasscode || !confirm("Remove this folder passcode and revoke its active sessions?")) return;
    await mutate({ action: "delete_course_passcode", courseId: effectiveCourseId }, `access:${effectiveCourseId}`, "Folder passcode removed.");
  }

  async function setLanguage(languageLabel: LanguageLabel) {
    await mutate({ action: "set_course_language", courseId: effectiveCourseId, languageLabel }, `language:${effectiveCourseId}`, "Folder language label updated.");
  }

  async function createCourse(event: FormEvent) {
    event.preventDefault(); const title = newCourse.trim();
    if (await mutate({ action: "create_course", title }, "catalog:create", `Course “${title}” created.`)) setNewCourse("");
  }

  async function createSection(event: FormEvent, course: Course) {
    event.preventDefault(); const title = (newSections[course.id] ?? "").trim();
    if (await mutate({ action: "create_section", courseId: course.id, title }, `section:${course.id}`, `Section “${title}” added.`)) setNewSections((current) => ({ ...current, [course.id]: "" }));
  }

  async function signOut() { await fetch("/api/signout", { method: "POST" }); window.location.replace("/"); }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>EIU · ADMIN CONTROL</span><h1>Course access</h1><p>{adminEmail} · One shared passcode per folder</p></div>
      <nav><Link href="/learn">Learning space</Link><Link href="/admin/ai">AI Knowledge</Link><button onClick={() => void signOut()}>Sign out</button></nav>
    </header>

    <div className={styles.tabs} role="tablist">
      <button className={tab === "access" ? styles.active : ""} onClick={() => setTab("access")}>Folder access</button>
      <button className={tab === "catalog" ? styles.active : ""} onClick={() => setTab("catalog")}>Courses & sections</button>
    </div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}

    <div className={styles.scrollArea}>
      {loading ? <div className={styles.loading}>Loading administration data…</div> : tab === "access" ? <div className={styles.passcodeLayout}>
        <aside className={styles.courseList}>
          <span>COURSE FOLDERS</span>
          {activeCourses.map((course) => <button key={course.id} className={effectiveCourseId === course.id ? styles.selectedCourse : ""} onClick={() => { setCourseId(course.id); setGeneratedCode(""); }}>
            <i>▰</i><b>{course.title}</b><small>{passcodes.some((item) => item.course_id === course.id) ? "Passcode active" : "No passcode"}</small>
          </button>)}
        </aside>

        <section className={styles.workspace}>
          <div className={styles.workspaceHead}><div><span>ACCESS SETTINGS</span><h2>{selectedCourse?.title}</h2><p>Anyone with this folder&apos;s shared passcode can open all of its sections.</p></div><div className={styles.statusDot} data-active={Boolean(selectedPasscode)}><i />{selectedPasscode ? "ACTIVE" : "INACTIVE"}</div></div>

          <div className={styles.settingsGrid}>
            <section className={styles.accessCard}>
              <div className={styles.cardHeading}><span>01</span><div><small>SHARED ACCESS</small><h3>Folder passcode</h3></div></div>
              <p>Click once to generate a secure four-digit code from 0000 to 9999. Each folder has only one active code.</p>
              {generatedCode && <div className={styles.generatedCode}><span>NEW PASSCODE</span><strong>{generatedCode}</strong><button type="button" onClick={() => void navigator.clipboard.writeText(generatedCode)}>Copy</button></div>}
              {selectedPasscode && <div className={styles.codeMeta}><span>Current</span><strong>{selectedPasscode.code_hint}</strong><span>Last used</span><strong>{selectedPasscode.last_used_at ? new Date(selectedPasscode.last_used_at).toLocaleString("en-GB") : "Never"}</strong></div>}
              <div className={styles.cardActions}><button type="button" onClick={() => void handleGeneratePasscode()} disabled={!effectiveCourseId || busy.has(`access:${effectiveCourseId}`)}>{busy.has(`access:${effectiveCourseId}`) ? "Generating…" : selectedPasscode ? "Generate new passcode" : "Generate passcode"}</button>{selectedPasscode && <button type="button" className={styles.danger} onClick={() => void deletePasscode()} disabled={busy.has(`access:${effectiveCourseId}`)}>Remove</button>}</div>
            </section>

            <section className={styles.languageCard}>
              <div className={styles.cardHeading}><span>02</span><div><small>DISPLAY LABEL</small><h3>Folder language</h3></div></div>
              <p>Choose the language label displayed on the course folder.</p>
              <div className={styles.languageOptions}>
                {languageOptions.map((option) => <button key={option.value} type="button" className={selectedCourse?.language_label === option.value ? styles.languageActive : ""} onClick={() => void setLanguage(option.value)} disabled={busy.has(`language:${effectiveCourseId}`)}><i>{selectedCourse?.language_label === option.value ? "✓" : ""}</i><span>{option.label}</span></button>)}
              </div>
            </section>
          </div>
        </section>
      </div> : <section className={styles.catalog}>
        <form className={styles.newCourse} onSubmit={createCourse}><div><span>COURSE STRUCTURE</span><h2>Courses & sections</h2></div><input value={newCourse} onChange={(event) => setNewCourse(event.target.value)} placeholder="New course name" required /><button disabled={busy.has("catalog:create")}>Create course</button></form>
        <div className={styles.courseGrid}>{courses.map((course) => <article key={course.id}><div className={styles.courseHead}><div><span>COURSE FOLDER</span><h3>{course.title}</h3><small>{languageOptions.find((item) => item.value === course.language_label)?.label}</small></div>{course.slug !== "applied-agentic-ai" && <button className={styles.danger} onClick={() => { if (confirm(`Delete “${course.title}”?`)) void mutate({ action: "delete_course", courseId: course.id }, `course:${course.id}`, "Course deleted."); }}>Delete</button>}</div><div className={styles.sectionList}>{sections.filter((section) => section.course_id === course.id && section.status === "active").map((section) => <div key={section.id}><span>{section.position.toString().padStart(2, "0")}</span><strong>{section.title}</strong>{!["section1", "section2"].includes(section.section_key) && <button onClick={() => { if (confirm(`Delete “${section.title}”?`)) void mutate({ action: "delete_section", sectionId: section.id }, `section:${course.id}`, "Section deleted."); }}>×</button>}</div>)}</div><form className={styles.newSection} onSubmit={(event) => createSection(event, course)}><input value={newSections[course.id] ?? ""} onChange={(event) => setNewSections((current) => ({ ...current, [course.id]: event.target.value }))} placeholder="Add section" required /><button disabled={busy.has(`section:${course.id}`)}>+</button></form></article>)}</div>
      </section>}
    </div>
  </main>;
}
