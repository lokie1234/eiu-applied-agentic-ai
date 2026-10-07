"use client";
/* eslint-disable @next/next/no-img-element -- Layout previews use uploaded data URLs. */
import { useState, type FormEvent } from "react";
import type { SlideTemplate } from "@/lib/auth/courseAccessStorage";
import EiuTemplateFrame from "@/components/deck/EiuTemplateFrame";
import EiuConfirmDialog, { type EiuDialogState } from "./EiuConfirmDialog";
import styles from "./TemplateLibrary.module.css";

function LayoutIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>;
}

export default function TemplateLibrary({ isAdmin, initialTemplates: templates, onTemplatesChange }: {
  isAdmin: boolean;
  initialTemplates: SlideTemplate[];
  onTemplatesChange?: (templates: SlideTemplate[]) => void;
}) {
  const [selected, setSelected] = useState(templates[0]?.id ?? "");
  const [name, setName] = useState("");
  const [filename, setFilename] = useState("");
  const [background, setBackground] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<EiuDialogState>({ isOpen: false, title: "", message: "" });
  const active = templates.find(template => template.id === selected) ?? templates[0];
  const preview = background ? { name: name.trim() || "New layout", background } : active;

  async function mutate(body: { action: "create" | "delete"; name?: string; background?: string; id?: string }) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.templates)) throw new Error(payload.message || "Unable to save layout.");
      const next = payload.templates as SlideTemplate[];
      onTemplatesChange?.(next);
      setSelected(body.action === "create" ? next.at(-1)?.id ?? "" : next.some(template => template.id === selected) ? selected : next[0]?.id ?? "");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save layout.");
      return false;
    } finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await mutate({ action: "create", name, background })) {
      setName(""); setBackground(""); setFilename("");
    }
  }

  async function readBackground(file?: File) {
    setBackground(""); setFilename(""); setError("");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPG or WebP image under 2 MB.");
      return;
    }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setBackground(data); setFilename(file.name);
    } catch { setError("Unable to read image."); }
    finally { setReading(false); }
  }

  function confirmDelete() {
    if (!active) return;
    setDialog({
      isOpen: true, title: "Delete slide layout?", message: `Remove "${active.name}" from the shared library?`,
      detail: "Courses using this layout will display their original slides until another layout is selected.",
      confirmLabel: "Delete layout", variant: "danger",
      onConfirm: async () => { await mutate({ action: "delete", id: active.id }); },
    });
  }

  return <section className={styles.shell} aria-label="Slide layout library">
    <div className={styles.sidebar}>
      <div className={styles.catalog}>
        <div className={styles.cardHeading}><div><span className={styles.eyebrow}>SHARED LIBRARY</span><h2 className={styles.cardTitle}>Slide layouts</h2></div><span className={styles.count}>{templates.length}</span></div>
        <p className={styles.hint}>{isAdmin ? "Select a layout to preview or manage it." : "Preview the layouts available for your courses."}</p>
        <div className={styles.layoutList}>
          {templates.length === 0 && <p className={styles.empty}>No layouts available yet.</p>}
          {templates.map(template => <button type="button" className={`${styles.layoutOption} ${active?.id === template.id ? styles.layoutSelected : ""}`} disabled={busy || reading} key={template.id} aria-pressed={active?.id === template.id} onClick={() => { setSelected(template.id); setBackground(""); setFilename(""); }}>
            <img className={styles.thumbnail} src={template.background} alt="" />
            <span className={styles.layoutName}>{template.name}</span>
            <svg className={styles.optionArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
          </button>)}
        </div>
      </div>
      {isAdmin && <form className={styles.createCard} onSubmit={create}>
        <div className={styles.cardHeading}><div><span className={styles.eyebrow}>LAYOUT DESIGN</span><h2 className={styles.cardTitle}>Add a layout</h2></div><span className={styles.headingIcon}><LayoutIcon /></span></div>
        <label className={styles.fieldLabel} htmlFor="layout-name">Layout name</label>
        <input className={styles.textInput} id="layout-name" required maxLength={120} placeholder="e.g. EIU Business" value={name} onChange={event => setName(event.target.value)} disabled={busy} />
        <label className={styles.fieldLabel} htmlFor="layout-background">Background image</label>
        <label className={styles.uploadArea}>
          <input className={styles.fileInput} id="layout-background" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || reading} onChange={event => { void readBackground(event.target.files?.[0]); event.target.value = ""; }} />
          {background ? <img className={styles.uploadThumbnail} src={background} alt="Selected background" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M4 15v5h16v-5"/></svg>}
          <span className={styles.uploadTitle}>{reading ? "Reading image..." : filename || "Choose a background"}</span>
          <span className={styles.uploadMeta}>PNG, JPG or WebP / up to 2 MB</span>
        </label>
        <p className={styles.hint}>Use a 16:9 background with space for content in the center.</p>
        <button className={styles.addButton} disabled={busy || reading || !background || !name.trim()} type="submit"><span aria-hidden="true">+</span>{busy ? "Saving..." : "Add layout"}</button>
      </form>}
    </div>

    <div className={styles.previewCard}>
      <div className={styles.previewHeading}>
        <div className={styles.previewTitleGroup}><span className={styles.eyebrow}>{background ? "NEW LAYOUT PREVIEW" : "LAYOUT PREVIEW"}</span><h2 className={styles.previewTitle}>{preview?.name ?? "Select a layout"}</h2></div>
        {isAdmin && active && !background && <button className={styles.deleteButton} type="button" disabled={busy} onClick={confirmDelete}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>Delete layout</button>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.previewViewport}>
        {preview ? <div className={styles.preview}><EiuTemplateFrame page={1} background={preview.background}><div className={styles.sample}><p className={styles.sampleEyebrow}>COURSE TITLE</p><h2 className={styles.sampleTitle}>Slide title</h2><p className={styles.sampleIntro}>Your learning content appears here.</p><ul className={styles.sampleList}><li>One consistent layout for your course</li><li>Applied to existing and future uploads</li></ul></div></EiuTemplateFrame></div> : <div className={styles.emptyPreview}><LayoutIcon /><h3>Preview your slide layout</h3><p>{isAdmin ? "Choose a layout or upload a background to begin." : "Shared layouts will appear here when available."}</p></div>}
      </div>
      <div className={styles.previewFooter}><span className={styles.formatBadge}>16:9</span><p>Course Setup applies the selected layout to your slides.</p><span className={styles.fileFormats}>PPTX / PDF / TSX</span></div>
    </div>
    <EiuConfirmDialog dialog={dialog} onClose={() => setDialog(current => ({ ...current, isOpen: false }))} />
  </section>;
}
