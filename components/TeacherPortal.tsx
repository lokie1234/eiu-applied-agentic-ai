"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CourseManagerHeader from "./admin/CourseManagerHeader";
import CourseSystemIcons from "./admin/CourseSystemIcons";
import SectionBatchUpload from "./admin/SectionBatchUpload";
import EiuConfirmDialog, { type EiuDialogState } from "./admin/EiuConfirmDialog";
import type { CourseSystemIcon } from "@/lib/auth/types";
import { createUploadQueue } from "@/lib/uploadQueue";
import admin from "./admin/AdminAccessPortal.module.css";
import layout from "./TeacherPortal.module.css";
import { uploadSectionFile } from "@/lib/uploadSectionFile";

type Course = { id: string; slug?: string; title: string; summary: string; languageLabel: string; canEdit: boolean; folderGroupId?: string; folderGroupName?: string; systemIcons?: CourseSystemIcon[] };
type Folder = { id: string; name: string; description?: string; order: number };
type Section = { id: string; course_id: string; section_key: string; content_path: string | null; title: string; canEdit: boolean; source_filename: string | null; content_type: string };
type WorkspaceData = { courses: Course[]; sections: Section[]; folderGroups: Folder[]; createdCourseIds?: string[]; createdFolderGroupId?: string };
const languages: Record<string, string> = { vi: "Vietnamese", en: "English", vi_en: "Vietnamese & English" };

async function api(body?: Record<string, unknown>): Promise<WorkspaceData> {
  const res = await fetch("/api/admin/access", body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load your workspace. Please try again.");
  return data;
}

function BookIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/></svg>;
}

export default function TeacherPortal({ name }: { name: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState("fg-ai-agentic");
  const [folderFilter, setFolderFilter] = useState("");
  const [title, setTitle] = useState("");
  const [multipleCourses, setMultipleCourses] = useState(false);
  const [multipleSections, setMultipleSections] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<EiuDialogState>({ isOpen: false, title: "", message: "" });
  const [newSection, setNewSection] = useState("");
  const [courseId, setCourseId] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const inFlight = useRef(false);
  const uploadQueue = useRef(createUploadQueue());
  const pendingUploads = useRef(new Set<string>());
  const [uploadCount, setUploadCount] = useState(0);
  const draggedSection = useRef<string | null>(null);

  function applyData(data: WorkspaceData) {
    setCourses(data.courses); setSections(data.sections); setFolders(data.folderGroups);
    setSelectedCourses(current => new Set([...current].filter(id => data.courses.some(c => c.id === id && c.canEdit))));
    setSelectedSections(current => new Set([...current].filter(id => data.sections.some(s => s.id === id && s.canEdit))));
  }

  useEffect(() => {
    let active = true;
    api().then(data => { if (active) applyData(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function request(body: Record<string, unknown> | undefined, message: string, processing: string) {
    if (inFlight.current || pendingUploads.current.size) return false;
    inFlight.current = true; setBusy(processing); setError(""); setNotice("");
    try {
      const data = await api(body); applyData(data);
      if (body?.action === "create_course") {
        setTitle(""); setScope("mine"); setSearch("");
        setCourseId(data.createdCourseIds?.[0] ?? ""); setNewSection("");
        setFolderFilter(String(body.folderGroupId ?? ""));
      }
      if (body?.action === "create_folder_group") {
        setNewFolderName(""); setNewFolderDescription(""); setShowNewFolder(false);
        setTargetFolderId(data.createdFolderGroupId ?? ""); setFolderFilter(data.createdFolderGroupId ?? "");
        setSearch(""); setNewSection("");
      }
      if (body?.action === "set_course_folder_group") setFolderFilter("");
      if (body?.action === "create_section") setNewSection("");
      setNotice(message);
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save changes."); return false; }
    finally { inFlight.current = false; setBusy(""); }
  }

  async function upload(section: Section, file: File, onProgress?: (value: number) => void): Promise<boolean> {
    if (!section.canEdit || pendingUploads.current.has(section.id) || inFlight.current) return false;
    pendingUploads.current.add(section.id); setUploadCount(pendingUploads.current.size);
    return uploadQueue.current(async () => {
    inFlight.current = true; setBusy(`Uploading ${file.name}`); setError(""); setNotice(""); setProgress(0);
    try {
      await uploadSectionFile(`/api/admin/sections/${section.id}/content`, file, value => { setProgress(value); onProgress?.(value); });
      applyData(await api()); setNotice(`Content saved for “${section.title}”.`);
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to upload content."); return false; }
    finally { pendingUploads.current.delete(section.id); setUploadCount(pendingUploads.current.size); inFlight.current = false; setBusy(""); setProgress(0); }
    });
  }

  const ownCourses = courses.filter(c => c.canEdit);
  const targetFolder = folders.find(folder => folder.id === targetFolderId) ?? folders[0];
  const visibleCourses = courses.filter(c => (scope === "all" || c.canEdit) && (!folderFilter || c.folderGroupId === folderFilter) && `${c.title} ${c.folderGroupName ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const visibleFolders = folders.filter(folder => (!folderFilter || folder.id === folderFilter) && (!search.trim() || folder.name.toLowerCase().includes(search.trim().toLowerCase()) || visibleCourses.some(c => c.folderGroupId === folder.id)));
  const selected = visibleCourses.find(c => c.id === courseId) ?? visibleCourses[0];
  const courseSections = sections.filter(s => s.course_id === selected?.id);
  const allSectionsOwned = courseSections.every(s => s.canEdit);
  const disabled = Boolean(busy) || loading || uploadCount > 0;
  const deletableCourses = visibleCourses.filter(c => c.canEdit && !sections.some(s => s.course_id === c.id && !s.canEdit));
  const editableSections = courseSections.filter(s => s.canEdit);

  function selectCourse(id: string) { setCourseId(id); setNewSection(""); setSelectedSections(new Set()); setNotice(""); }
  function confirmAction(title: string, body: Record<string, unknown>, success: string) {
    setDialog({ isOpen: true, title, message: "This permanently removes the selected content and its files.", detail: "This action cannot be undone.", variant: "danger", confirmLabel: "Delete", onConfirm: async () => { await request(body, success, "Deleting content…"); } });
  }
  function toggleSelection(id: string, set: typeof setSelectedCourses) {
    set(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function reorderSection(sourceId: string, targetId: string) {
    if (!selected?.canEdit || !allSectionsOwned || disabled || sourceId === targetId) return;
    const ids = courseSections.map(s => s.id);
    const source = ids.indexOf(sourceId), target = ids.indexOf(targetId);
    if (source < 0 || target < 0) return;
    ids.splice(source, 1); ids.splice(target, 0, sourceId);
    void request({ action: "reorder_sections", courseId: selected.id, sectionIds: ids }, "Section order saved.", "Saving section order…");
  }
  function moveCourse(folderId: string, id: string, direction: number) {
    const members = courses.filter(c => c.folderGroupId === folderId);
    if (!members.every(c => c.canEdit)) return;
    const ids = members.map(c => c.id), index = ids.indexOf(id);
    if (index < 0 || index + direction < 0 || index + direction >= ids.length) return;
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void request({ action: "reorder_courses", folderGroupId: folderId, courseIds: ids }, "Course order saved.", "Saving course order…");
  }
  function moveSection(index: number, direction: number) {
    if (!selected) return;
    const ids = courseSections.map(s => s.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void request({ action: "reorder_sections", courseId: selected.id, sectionIds: ids }, "Section order saved.", "Saving section order…");
  }

  return (
    <main className={`${admin.page} ${layout.workspace}`}>
      <CourseManagerHeader role="teacher" identity={name} onSignOut={() => {
        void fetch("/api/signout", { method: "POST" }).then(res => {
          if (!res.ok) throw new Error("Unable to sign out. Please try again.");
          window.location.replace("/");
        }).catch(err => setError(err.message));
      }} />

      <div className={admin.topControlRow}>
        <div className={admin.tabsTrack} aria-label="Course view">
          {(["mine", "all"] as const).map(value => <button key={value} type="button" className={`${admin.tabBtn} ${scope === value ? admin.tabBtnActive : ""}`} aria-pressed={scope === value} onClick={() => { setScope(value); setSearch(""); setFolderFilter(""); setNewSection(""); }}>
            {value === "mine" ? "My courses" : "All courses"}<span className={admin.tabBadge}>{value === "mine" ? ownCourses.length : courses.length}</span>
          </button>)}
        </div>
        <div className={layout.toolbar}>
          <button className={layout.button} type="button" disabled={disabled} aria-expanded={showNewFolder} aria-controls="new-folder-form" onClick={() => setShowNewFolder(!showNewFolder)}>+ New folder</button>
          <input className={layout.input} value={search} onChange={e => { setSearch(e.target.value); setNewSection(""); }} placeholder="Search courses…" aria-label="Search courses" />
          <button className={layout.button} type="button" disabled={disabled} onClick={() => void request(undefined, "Workspace refreshed.", "Refreshing workspace…")}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className={admin.error} role="alert">{error}</div>}
      {notice && <div className={admin.notice} role="status">{notice}</div>}
      {busy && <div className={admin.processingBanner} role="status"><span className={admin.processingSpinner} aria-hidden="true"/><span>{busy}{progress > 0 ? ` · ${progress}% transferred` : ""}</span></div>}

      <div className={`${admin.scrollArea} ${layout.canvas}`}>
        <div className={layout.overview}>
          <div><span className={layout.eyebrow}>YOUR TEACHING SPACE</span><h2>Course Setup & Structure</h2><p>Build your courses, organize lessons and publish learning materials.</p></div>
          <div className={layout.metrics} aria-label="Workspace overview"><div><b>{ownCourses.length}</b><span>My courses</span></div><div><b>{sections.filter(s => s.canEdit).length}</b><span>My sections</span></div><div><b>{courses.length}</b><span>In the library</span></div></div>
        </div>

        <div className={layout.courses}>
          <aside className={layout.sidebar} aria-label="Course library">
            {showNewFolder && <section className={`${layout.card} ${layout.createCard} ${layout.folderCreate}`}>
              <span className={layout.eyebrow}>ORGANIZE YOUR LIBRARY</span><h3>Create a folder</h3><p>Group related courses in a folder, just like the admin library.</p>
              <form id="new-folder-form" className={layout.form} onSubmit={e => { e.preventDefault(); void request({ action: "create_folder_group", name: newFolderName, description: newFolderDescription }, "Folder created. You can add a course to it now.", "Creating folder…"); }}>
                <label htmlFor="new-folder-name">FOLDER NAME</label><input id="new-folder-name" className={layout.input} value={newFolderName} onChange={e => setNewFolderName(e.target.value)} maxLength={120} placeholder="e.g. Business Analytics" required disabled={disabled}/>
                <label htmlFor="new-folder-description">DESCRIPTION (OPTIONAL)</label><textarea id="new-folder-description" className={layout.input} value={newFolderDescription} onChange={e => setNewFolderDescription(e.target.value)} rows={2} maxLength={2000} disabled={disabled}/>
                <button className={layout.primary} disabled={disabled || !newFolderName.trim()}>+ Create folder</button>
              </form>
            </section>}
            <section className={`${layout.card} ${layout.createCard}`}>
              <span className={layout.eyebrow}>START SOMETHING NEW</span><h3>Create a course</h3><p>Your course and its sections belong to you.</p>
              <form className={layout.form} onSubmit={e => { e.preventDefault(); void request({ action: "create_course", title, ...(multipleCourses ? { titles: title.split(/\r?\n/).map(value => value.trim()).filter(Boolean) } : {}), folderGroupId: targetFolder?.id }, "Courses created. Add your sections below.", "Creating your courses…"); }}>
                <label className={layout.checkLabel}><input type="checkbox" checked={multipleCourses} onChange={e => { setMultipleCourses(e.target.checked); setTitle(""); }} disabled={disabled}/>Create multiple courses</label>
                <label htmlFor="new-course-title">{multipleCourses ? "COURSE TITLES · ONE PER LINE" : "COURSE TITLE"}</label>{multipleCourses ? <textarea id="new-course-title" className={layout.input} value={title} onChange={e => setTitle(e.target.value)} rows={4} required disabled={disabled}/> : <input id="new-course-title" className={layout.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. MIS 311" required maxLength={120} disabled={disabled}/>}
                <label htmlFor="new-course-folder">PARENT FOLDER</label><select id="new-course-folder" className={layout.input} value={targetFolder?.id ?? ""} onChange={e => setTargetFolderId(e.target.value)} disabled={disabled || !folders.length} required>{folders.map(folder => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select>
                <button className={layout.primary} disabled={disabled || !title.trim() || !targetFolder}>{multipleCourses ? "+ Create courses" : "+ Create course"}</button>
              </form>
            </section>
            <section className={`${layout.card} ${layout.libraryCard}`}>
              <div className={layout.libraryHeading}><h3>{scope === "mine" ? "My courses" : "Course library"}</h3><span>{visibleCourses.length}</span></div>
              <div className={layout.folderFilter}><label className={layout.srOnly} htmlFor="course-folder-filter">Filter courses by folder</label><select id="course-folder-filter" className={layout.input} value={folderFilter} onChange={e => { setFolderFilter(e.target.value); setNewSection(""); }}><option value="">All folders</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
              {deletableCourses.length > 0 && <div className={layout.bulkToolbar}><label className={layout.checkLabel}><input type="checkbox" checked={deletableCourses.every(c => selectedCourses.has(c.id))} onChange={e => setSelectedCourses(e.target.checked ? new Set(deletableCourses.map(c => c.id)) : new Set())} disabled={disabled}/>Select courses</label><button className={layout.danger} disabled={disabled || !selectedCourses.size} onClick={() => confirmAction(`Delete ${selectedCourses.size} selected courses?`, { action: "delete_courses", courseIds: [...selectedCourses] }, "Selected courses deleted.")}>Delete selected ({selectedCourses.size})</button></div>}
              {loading ? <p className={layout.emptySmall}>Loading courses…</p> : visibleFolders.length ? <div className={layout.courseList}>{visibleFolders.map(folder => <div key={folder.id}><div className={layout.folderHeading}><span>{folder.name}</span><small>{visibleCourses.filter(c => c.folderGroupId === folder.id).length}</small></div>{visibleCourses.filter(c => c.folderGroupId === folder.id).map(c => <div className={layout.courseRow} key={c.id}>
                {deletableCourses.some(item => item.id === c.id) && <input type="checkbox" aria-label={`Select course ${c.title}`} checked={selectedCourses.has(c.id)} disabled={disabled} onChange={() => toggleSelection(c.id, setSelectedCourses)}/>}
                <button type="button" className={`${layout.course} ${selected?.id === c.id ? layout.selected : ""}`} aria-pressed={selected?.id === c.id} onClick={() => selectCourse(c.id)}>
                <span className={layout.courseIcon}><BookIcon/></span><span className={layout.courseIdentity}><b>{c.title}</b><small>{c.canEdit ? "Your course" : "Read only"} · {sections.filter(s => s.course_id === c.id).length} sections</small></span>
                </button>{!search && courses.filter(item => item.folderGroupId === folder.id).every(item => item.canEdit) && courses.filter(item => item.folderGroupId === folder.id).length > 1 && <div className={layout.courseOrder}><button className={layout.iconButton} disabled={disabled || courses.filter(item => item.folderGroupId === folder.id)[0]?.id === c.id} aria-label={`Move course ${c.title} up`} onClick={() => moveCourse(folder.id, c.id, -1)}>↑</button><button className={layout.iconButton} disabled={disabled || courses.filter(item => item.folderGroupId === folder.id).at(-1)?.id === c.id} aria-label={`Move course ${c.title} down`} onClick={() => moveCourse(folder.id, c.id, 1)}>↓</button></div>}
              </div>)}{!visibleCourses.some(c => c.folderGroupId === folder.id) && <p className={layout.folderEmpty}>{scope === "mine" ? "No courses of yours in this folder yet." : "No courses in this folder yet."}</p>}</div>)}</div> : <p className={layout.emptySmall}>{search ? "No courses match your search." : "No folders in the library yet."}</p>}
            </section>
          </aside>

          <section className={layout.detail} aria-label="Selected course" aria-busy={Boolean(busy)}>
            {selected ? <>
              <div className={`${layout.card} ${layout.courseHeader}`}>
                <div><div className={layout.courseMeta}><span className={layout.eyebrow}>COURSE WORKSPACE</span><span className={`${layout.badge} ${selected.canEdit ? layout.owned : ""}`}>{selected.canEdit ? "Your course" : "Read only"}</span></div><h2>{selected.title}</h2><p>{selected.summary || "Add a description to introduce this course."}</p><div className={layout.metadata}><span>{selected.folderGroupName}</span><span>{languages[selected.languageLabel] ?? selected.languageLabel}</span><span>{courseSections.length} sections</span></div></div>
                <Link className={layout.button} href="/learn">Open Learning Space ↗</Link>
              </div>

              {selected.canEdit ? <details key={selected.id} className={`${layout.card} ${layout.settings}`}>
                <summary>Course settings <span>Title, description & language</span></summary>
                <div className={layout.settingsBody}>
                  <form key={`title-${selected.title}`} className={layout.form} onSubmit={e => { e.preventDefault(); void request({ action: "update_course_title", courseId: selected.id, title: new FormData(e.currentTarget).get("title") }, "Course title saved.", "Saving course title…"); }}>
                    <label htmlFor="course-title">COURSE TITLE</label><input id="course-title" className={layout.input} name="title" defaultValue={selected.title} maxLength={120} required disabled={disabled}/><button className={layout.button} disabled={disabled}>Save title</button>
                  </form>
                  <div className={layout.form}><label htmlFor="course-language">LANGUAGE</label><select id="course-language" className={layout.input} value={selected.languageLabel} disabled={disabled} onChange={e => void request({ action: "set_course_language", courseId: selected.id, languageLabel: e.target.value }, "Course language saved.", "Saving language…")}><option value="vi">Vietnamese</option><option value="en">English</option><option value="vi_en">Vietnamese & English</option></select></div>
                  <div className={`${layout.form} ${layout.fullWidth}`}><label htmlFor="course-parent-folder">PARENT FOLDER</label><select id="course-parent-folder" className={layout.input} value={selected.folderGroupId ?? ""} disabled={disabled} onChange={e => void request({ action: "set_course_folder_group", courseId: selected.id, folderGroupId: e.target.value }, "Course moved to folder.", "Moving course…")}>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
                  <form key={`summary-${selected.summary}`} className={`${layout.form} ${layout.fullWidth}`} onSubmit={e => { e.preventDefault(); void request({ action: "update_course_summary", courseId: selected.id, summary: new FormData(e.currentTarget).get("summary") }, "Course description saved.", "Saving description…"); }}>
                    <label htmlFor="course-summary">DESCRIPTION</label><textarea id="course-summary" className={layout.input} rows={3} name="summary" defaultValue={selected.summary} disabled={disabled}/><button className={layout.button} disabled={disabled}>Save description</button>
                  </form>
                  <div className={`${layout.dangerZone} ${layout.fullWidth}`}><div><b>Delete course</b><p>{allSectionsOwned ? "Permanently remove this course and its sections." : "This course includes another user's sections and cannot be deleted."}</p></div><button className={layout.danger} disabled={disabled || !allSectionsOwned} onClick={() => confirmAction(`Delete course “${selected.title}”?`, { action: "delete_course", courseId: selected.id }, "Course deleted.")}>Delete course</button></div>
                </div>
              </details> : <div className={layout.readOnly}><span className={layout.badge}>VIEW ONLY</span><p>This course belongs to another teacher or the admin. You can view its lessons in Learning Space.</p></div>}

              <section className={`${layout.card} ${layout.sectionsCard}`}>
                <div className={layout.sectionHeading}><div><span className={layout.eyebrow}>LEARNING CONTENT</span><h3>Sections <span>{courseSections.length}</span></h3></div><p>PDF, TSX & PPTX materials</p></div>
                {selected.canEdit && <form className={layout.addSection} onSubmit={e => { e.preventDefault(); void request({ action: "create_section", courseId: selected.id, title: newSection, ...(multipleSections ? { titles: newSection.split(/\r?\n/).map(value => value.trim()).filter(Boolean) } : {}) }, "Sections created. Upload their learning materials below.", "Creating sections…"); }}><label className={layout.checkLabel}><input type="checkbox" checked={multipleSections} disabled={disabled} onChange={e => { setMultipleSections(e.target.checked); setNewSection(""); }}/>Add multiple sections</label><label htmlFor="new-section-title">{multipleSections ? "NEW SECTIONS · ONE PER LINE" : "NEW SECTION"}</label><div>{multipleSections ? <textarea id="new-section-title" className={layout.input} value={newSection} onChange={e => setNewSection(e.target.value)} rows={4} required disabled={disabled}/> : <input id="new-section-title" className={layout.input} value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="e.g. Introduction & learning objectives" maxLength={120} required disabled={disabled}/>}<button className={layout.primary} disabled={disabled || !newSection.trim()}>{multipleSections ? "+ Add sections" : "+ Add section"}</button></div></form>}
                {editableSections.length > 0 && <div className={layout.contentTools}>
                  <p className={admin.sectionUploadHelp}>PDF / TSX / PPTX · Up to 50 MB. PPTX files remain unchanged, including audio, animations and add-ins.</p>
                  <SectionBatchUpload key={selected.id} sections={editableSections} coreCourse={selected.slug === "applied-agentic-ai"} disabled={disabled} upload={(target, file, progress) => { const section = editableSections.find(s => s.id === target.id); return section ? upload(section, file, progress) : Promise.resolve(false); }}/>
                  <div className={layout.bulkToolbar}><label className={layout.checkLabel}><input type="checkbox" checked={editableSections.every(s => selectedSections.has(s.id))} disabled={disabled} onChange={e => setSelectedSections(e.target.checked ? new Set(editableSections.map(s => s.id)) : new Set())}/>Select sections</label><button className={layout.danger} disabled={disabled || !editableSections.some(s => selectedSections.has(s.id))} onClick={() => confirmAction("Delete selected sections?", { action: "delete_sections", sectionIds: editableSections.filter(s => selectedSections.has(s.id)).map(s => s.id) }, "Selected sections deleted.")}>Delete selected sections ({editableSections.filter(s => selectedSections.has(s.id)).length})</button></div>
                </div>}
                {courseSections.length ? <div className={layout.sectionList}>{courseSections.map((s, index) => <article className={layout.section} key={s.id} draggable={!disabled && selected.canEdit && allSectionsOwned} onDragStart={e => { if ((e.target as HTMLElement).closest("input,button,a,label,textarea")) { e.preventDefault(); return; } draggedSection.current = s.id; e.dataTransfer.setData("text/plain", s.id); }} onDragOver={e => { if (s.canEdit && !disabled) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (!s.canEdit || disabled) return; const file = e.dataTransfer.files[0]; if (file) void upload(s, file); else if (draggedSection.current) reorderSection(draggedSection.current, s.id); draggedSection.current = null; }}>
                  {s.canEdit && <label className={layout.sectionSelect}><input type="checkbox" checked={selectedSections.has(s.id)} disabled={disabled} aria-label={`Select section ${s.title}`} onChange={() => toggleSelection(s.id, setSelectedSections)}/>Select section</label>}
                  <div className={layout.sectionInfo}><span className={layout.sectionNumber}>{String(index + 1).padStart(2, "0")}</span><div><h4>{s.title}</h4><p>{s.source_filename || "No material uploaded yet"}</p><span className={`${layout.badge} ${s.source_filename ? layout.owned : ""}`}>{s.source_filename ? s.content_type.toUpperCase() : "Awaiting content"}</span></div></div>
                  {s.canEdit ? <>
                    <div className={layout.sectionActions}><label className={`${layout.button} ${disabled ? layout.disabled : ""}`}>{s.source_filename ? "Replace material" : "Upload material"}<input type="file" className={layout.fileInput} disabled={disabled} aria-label={`Upload material for ${s.title}`} accept=".pdf,.tsx,.pptx" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void upload(s, file); e.currentTarget.value = ""; }}/></label>
                      {selected.canEdit && allSectionsOwned && <><button className={layout.iconButton} disabled={disabled || index === 0} aria-label={`Move ${s.title} up`} onClick={() => moveSection(index, -1)}>↑</button><button className={layout.iconButton} disabled={disabled || index === courseSections.length - 1} aria-label={`Move ${s.title} down`} onClick={() => moveSection(index, 1)}>↓</button></>}
                    </div>
                    <details className={layout.sectionEdit}><summary>Edit section</summary><form key={s.title} onSubmit={e => { e.preventDefault(); void request({ action: "rename_section", sectionId: s.id, title: new FormData(e.currentTarget).get("title") }, "Section title saved.", "Saving section title…"); }}><label className={layout.srOnly} htmlFor={`title-${s.id}`}>Section title</label><input id={`title-${s.id}`} className={layout.input} name="title" defaultValue={s.title} required maxLength={120} disabled={disabled}/><button className={layout.button} disabled={disabled}>Save title</button><button type="button" className={layout.danger} disabled={disabled} onClick={() => confirmAction(`Delete section “${s.title}”?`, { action: "delete_section", sectionId: s.id }, "Section deleted.")}>Delete section</button></form></details>
                  </> : <span className={layout.badge}>Read only</span>}
                  {s.source_filename && <a className={layout.button} href={`/api/sections/${encodeURIComponent(s.id)}/content?download=1`} download={s.source_filename}>↓ Download original</a>}
                </article>)}</div> : <div className={layout.empty}><BookIcon/><h4>{selected.canEdit ? "Ready for your first lesson" : "No sections yet"}</h4><p>{selected.canEdit ? "Add a section, then upload a PDF, interactive TSX or PowerPoint." : "Learning materials will appear here when the owner adds them."}</p></div>}
              </section>
              <CourseSystemIcons key={`icons-${selected.id}`} icons={selected.systemIcons ?? []} editable={selected.canEdit} disabled={disabled} onSave={icons => request({ action: "update_course_system_icons", courseId: selected.id, systemIcons: icons }, "Course icons saved.", "Saving course icons…")} />
            </> : <div className={`${layout.card} ${layout.emptyCanvas}`}><span className={layout.emptyIcon}><BookIcon/></span><span className={layout.eyebrow}>YOUR NEXT COURSE STARTS HERE</span><h2>{loading ? "Loading your workspace…" : search ? "No matching courses" : scope === "mine" ? "Make room for your next idea." : "A fresh learning library"}</h2><p>{search ? "Try a different title in the search field." : "Create a course on the left, add your sections and bring your learning materials together."}</p>{scope === "mine" && !search && <button className={layout.button} onClick={() => setScope("all")}>Browse all courses →</button>}</div>}
          </section>
        </div>
      </div>
      <EiuConfirmDialog dialog={dialog} onClose={() => setDialog(current => ({ ...current, isOpen: false }))}/>
    </main>
  );
}
