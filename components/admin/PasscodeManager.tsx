"use client";
import { useState } from "react";
import type { AccessCodes, AccessMode } from "@/lib/auth/passcodes";
import EiuConfirmDialog, { type EiuDialogState } from "./EiuConfirmDialog";
import styles from "./PasscodeManager.module.css";
import LearnerInformationSettings from "./LearnerInformationSettings";
import type { LearningIdentityPolicy } from "@/lib/learningIdentity";

type Course = { folderGroupId?: string; id: string; title: string; metadata: { hidden?: boolean; hiddenSectionIds?: string[]; passcode?: string; facilitatorPasscode?: string } };
type Folder = { hidden?: boolean; id: string; name: string; accessCodes?: AccessCodes };
type Target = { kind: "global" | "folder" | "course"; id: string; label: string; codes: AccessCodes; parentLocked?: boolean; path?: string; hidden?: boolean };
type Save = (body: Record<string, unknown>) => Promise<boolean>;

function CodeEditor({ target, mode, onSave, disabled = false }: { target: Target; mode: AccessMode; onSave: Save; disabled?: boolean }) {
  const current = target.codes[mode] || "";
  const [code, setCode] = useState(current);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function save(generate = false, clear = false) {
    if (busy || disabled) return;
    setBusy(true); setNotice("");
    try {
      await onSave({ action: "set_access_passcode", kind: target.kind, id: target.id, mode, code: clear ? "" : code.trim(), generate });
    } finally { setBusy(false); }
  }
  return <article className={`${styles.codeCard} ${mode === "facilitator" ? styles.teaching : ""}`}>
    <span className={styles.badge}>{current ? "CODE ACTIVE" : mode === "facilitator" ? "NOT CONFIGURED" : target.kind === "global" ? "NOT CONFIGURED" : target.parentLocked ? "INHERITED LOCK" : "FREE ACCESS"}</span>
    <h3>{mode === "learner" ? "Learning access" : "Teaching access"}</h3>
    <p>{mode === "learner" ? "Lessons, interactions, and quizzes." : "Open quizzes and view interactions. No admin or content-management access."}</p>
    <label>Passcode<input aria-label={`${target.kind === "global" ? "global " : ""}${mode} passcode`} value={code} onChange={event => setCode(event.target.value)} maxLength={32} autoComplete="off" spellCheck={false} disabled={busy || disabled} placeholder={mode === "learner" && target.kind !== "global" ? "Free" : "Not set"} /></label>
    <small>{current ? "Active in this scope. Changing or clearing this code revokes its sessions." : target.kind === "global" ? "Opens all visible courses, including courses added later." : mode === "facilitator" ? "Teaching requires a teaching code; a parent teaching code also applies." : target.parentLocked ? "A parent Learning code still protects this scope." : "No lock at this level. Child Learning codes still apply to free browsing."}</small>
    <div className={styles.actions}>
      <button type="button" disabled={disabled || busy || !code.trim() || code === current} onClick={() => void save()}>Save</button>
      <button type="button" disabled={busy || disabled} onClick={() => void save(true)}>Generate</button>
      <button type="button" disabled={disabled || busy || !current} onClick={() => { if (window.confirm("Clear this passcode? Its sessions will expire; clearing a local Learning code may make content free.")) void save(false, true); }}>Clear</button>
      <button type="button" disabled={disabled || !current || busy} onClick={() => { void navigator.clipboard.writeText(current).then(() => setNotice("Copied.")).catch(() => setNotice("Copy the code from the field above.")); }}>Copy</button>
    </div>
    {notice && <div className={styles.notice} role="status">{notice}</div>}
  </article>;
}

export default function PasscodeManager({ courses, folders, globalCodes = {}, identityPolicy, onSave }: { courses: Course[]; folders: Folder[]; globalCodes?: AccessCodes; identityPolicy?: LearningIdentityPolicy; onSave: Save }) {
  const targets: Target[] = folders.flatMap(folder => [
    { kind: "folder" as const, id: folder.id, label: folder.name, codes: folder.accessCodes || {}, path: "Folder", hidden: Boolean(folder.hidden || courses.some(course => course.folderGroupId === folder.id && (course.metadata.hidden || course.metadata.hiddenSectionIds?.length))) },
    ...courses.filter(course => course.folderGroupId === folder.id || (!course.folderGroupId && folder === folders[0])).map(course => ({
      kind: "course" as const, id: course.id, label: course.title, path: folder.name, parentLocked: Boolean(folder.accessCodes?.learner), codes: { learner: course.metadata.passcode, facilitator: course.metadata.facilitatorPasscode }, hidden: Boolean(folder.hidden || course.metadata.hidden || course.metadata.hiddenSectionIds?.length),
    })),
  ]);
  for (const course of courses.filter(course => !targets.some(target => target.kind === "course" && target.id === course.id))) targets.push({ kind: "course", id: course.id, label: course.title, path: "Course", codes: { learner: course.metadata.passcode, facilitator: course.metadata.facilitatorPasscode }, hidden: Boolean(course.metadata.hidden || course.metadata.hiddenSectionIds?.length) });
  const [selection, setSelection] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"learner" | "facilitator" | "both">("both");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<EiuDialogState>({ isOpen: false, title: "", message: "" });
  const target = targets.find(item => `${item.kind}:${item.id}` === selection) || targets[0];
  const filtered = targets.filter(item => `${item.label} ${item.path}`.toLowerCase().includes(search.trim().toLowerCase()));
  const chosen = targets.filter(item => selected.includes(`${item.kind}:${item.id}`));
  const globalTarget: Target = { kind: "global", id: "all", label: "All courses", codes: globalCodes };
  function confirm(body: Record<string, unknown>, items: Target[], bulk = false): Promise<boolean> {
    if (dialog.isOpen) return Promise.resolve(false);
    const generate = body.generate === true || body.operation === "generate";
    const hidden = generate || (typeof body.code === "string" && body.code.trim()) ? items.filter(item => item.hidden) : [];
    if (!hidden.length && !bulk) return onSave(body);
    return new Promise(resolve => setDialog({
      isOpen: true, variant: hidden.length ? "warning" : body.operation === "clear" ? "danger" : "gold",
      title: hidden.length ? "Unhide content and generate passcodes?" : body.operation === "clear" ? "Clear selected passcodes?" : "Generate selected passcodes?",
      message: hidden.length ? `${hidden.length} selected scope(s) contain hidden content or belong to a hidden folder. Continuing will unhide the affected folders, courses, and sections, then create the passcodes.` : body.operation === "clear" ? `Clear ${bulkMode === "both" ? "Learning and Teaching" : bulkMode === "learner" ? "Learning" : "Teaching"} codes for ${items.length} selected scope(s)? Existing sessions using these codes will expire. Clearing Learning codes may make content free; parent codes still apply.` : `Create unique ${bulkMode === "both" ? "Learning and Teaching" : bulkMode === "learner" ? "Learning" : "Teaching"} codes for ${items.length} selected scope(s)?`,
      detail: hidden.length ? "For a folder, its courses and sections become visible. For a course, its parent folder and sections become visible. Draft content stays unpublished. Existing codes will be replaced and their sessions will expire." : "Only selected scopes and access types change. Existing codes will be replaced; parent and global codes remain available.",
      confirmLabel: hidden.length ? "Unhide & generate" : body.operation === "clear" ? "Clear passcodes" : "Generate passcodes",
      onCancel: () => resolve(false),
      onConfirm: async () => { resolve(await onSave({ ...body, unhide: hidden.length > 0 })); },
    }));
  }
  async function bulk(operation: "generate" | "clear") {
    if (busy || !chosen.length) return;
    setBusy(true);
    try { await confirm({ action: "bulk_access_passcodes", operation, targets: chosen.map(({ kind, id }) => ({ kind, id })), modes: bulkMode === "both" ? ["learner", "facilitator"] : [bulkMode] }, chosen, true); } finally { setBusy(false); }
  }
  const save: Save = async body => {
    if (busy) return false;
    setBusy(true);
    try { return await confirm(body, targets.filter(item => item.kind === body.kind && item.id === body.id)); } finally { setBusy(false); }
  };
  const editors = (item: Target) => (["learner", "facilitator"] as const).map(mode => <CodeEditor key={`${item.kind}:${item.id}:${mode}:${item.codes[mode] || ""}`} target={item} mode={mode} onSave={save} disabled={busy} />);
  return <section className={styles.manager}>
    <header className={styles.heading}><span>EIU · ACCESS CONTROL</span><h2>Passcode management</h2><p>Global codes open all visible courses. Folder codes cover their courses; course codes cover every section. Google remains administrator-only.</p></header>
    <div className={styles.overview}>
      <section className={styles.global} aria-labelledby="global-codes-heading"><div className={styles.sectionHeading}><h3 id="global-codes-heading">Global access</h3><span>ALL COURSES</span></div><div className={styles.codeGrid}>{editors(globalTarget)}</div></section>
      <LearnerInformationSettings key={JSON.stringify(identityPolicy)} policy={identityPolicy} onSave={onSave} />
    </div>
    <div className={styles.sectionHeading}><h3>Folder & course access</h3><span>{targets.length} SCOPES</span></div>
    <p className={styles.rule}>Learning access is free when neither the folder nor the course has a Learning code. Teaching always requires a code.</p>
    <div className={styles.bulkToolbar} aria-label="Bulk passcode actions"><strong>{chosen.length} selected</strong><button type="button" disabled={busy || !filtered.length} onClick={() => setSelected(current => filtered.every(item => current.includes(`${item.kind}:${item.id}`)) ? current.filter(key => !filtered.some(item => key === `${item.kind}:${item.id}`)) : [...new Set([...current, ...filtered.map(item => `${item.kind}:${item.id}`)])])}>Select / clear visible</button><label>Access type<select aria-label="Bulk access type" value={bulkMode} disabled={busy} onChange={event => setBulkMode(event.target.value as typeof bulkMode)}><option value="both">Learning & Teaching</option><option value="learner">Learning only</option><option value="facilitator">Teaching only</option></select></label><button type="button" disabled={busy || !chosen.length} onClick={() => void bulk("generate")}>Generate selected</button><button type="button" className={styles.danger} disabled={busy || !chosen.length} onClick={() => void bulk("clear")}>Clear selected codes</button></div>
    <div className={styles.workspace}>
      <nav className={styles.catalog} aria-label="Passcode scopes"><input type="search" aria-label="Search folders and courses" placeholder="Search folders or courses…" value={search} onChange={event => setSearch(event.target.value)} /><div className={styles.targets}>{filtered.map(item => <div key={`${item.kind}:${item.id}`} className={styles.scopeRow}><input type="checkbox" aria-label={`Select ${item.kind}: ${item.label}`} disabled={busy} checked={selected.includes(`${item.kind}:${item.id}`)} onChange={event => setSelected(current => event.target.checked ? [...current, `${item.kind}:${item.id}`] : current.filter(key => key !== `${item.kind}:${item.id}`))} /><button type="button" value={`${item.kind}:${item.id}`} className={`${styles.target} ${styles[item.kind]} ${item === target ? styles.selected : ""}`} aria-pressed={item === target} title={`${item.path} / ${item.label}`} onClick={() => setSelection(`${item.kind}:${item.id}`)}><span className={styles.targetType}>{item.kind}{item.hidden ? " · Hidden content" : ""}</span><strong>{item.label}</strong><small>{item.codes.learner ? "Protected" : item.parentLocked ? "Inherited" : "Free"}{item.codes.facilitator ? " · Teaching" : ""}</small></button></div>)}{!filtered.length && <p className={styles.empty}>No matching scopes.</p>}</div></nav>
      <section className={styles.detail}>{target ? <><div className={styles.detailHeading}><span>{target.kind.toUpperCase()}</span><h3>{target.label}</h3><p>{target.path}</p>{target.hidden && <p className={styles.hiddenNotice}>Hidden content: generating a code requires confirmation to unhide it.</p>}</div><div className={styles.codeGrid}>{editors(target)}</div></> : <p>Create a folder or course to configure local access.</p>}</section>
    </div>
    <EiuConfirmDialog dialog={dialog} onClose={() => setDialog(current => ({ ...current, isOpen: false }))} />
  </section>;
}
