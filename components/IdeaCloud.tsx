import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { IdeaItem } from "./IdeaSubmissionView";
import styles from "./IdeaSubmissionView.module.css";

export default function IdeaCloud({ items, onDelete }: { items: IdeaItem[]; onDelete?: (id: string) => Promise<void> }) {
  const [requestedPage, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selected = items.find(item => item.id === selectedId);
  const open = Boolean(selected);
  const pageCount = Math.max(1, Math.ceil(items.length / 12));
  const page = Math.min(requestedPage, pageCount - 1);
  const visible = items.slice(page * 12, page * 12 + 12);
  const density = items.length > 9 ? "compact" : items.length > 4 ? "medium" : "comfortable";
  const close = () => { if (!deleting) setSelectedId(null); };
  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    const node = dialog.current;
    const closeButton = node?.querySelector<HTMLButtonElement>("[data-idea-close]");
    if (closeButton && !closeButton.disabled) closeButton.focus(); else node?.focus();
    function keydown(event: KeyboardEvent) {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!deleting) setSelectedId(null); }
      if (event.key !== "Tab" || !node) return;
      const buttons = [...node.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (!buttons.length) { event.preventDefault(); return; }
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); if (opener?.isConnected) opener.focus(); };
  }, [open, deleting]);
  async function remove() {
    if (!selected || !onDelete || deleting) return;
    setDeleting(true); setError("");
    try { await onDelete(selected.id); setSelectedId(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa xóa được ý tưởng."); }
    finally { setDeleting(false); }
  }
  return <>
    <div className={styles.cloudToolbar}>
      <span>{page * 12 + 1}–{Math.min((page + 1) * 12, items.length)} / {items.length}</span>
      {pageCount > 1 && <nav aria-label="Các ý tưởng"><button type="button" aria-label="Nhóm ý tưởng trước" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button><span>{page + 1} / {pageCount}</span><button type="button" aria-label="Nhóm ý tưởng tiếp theo" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)}>→</button></nav>}
    </div>
    <div className={styles.cloud} data-idea-cloud data-density={density} data-single={items.length === 1} style={{ "--cloud-rows": Math.ceil(visible.length / (density === "compact" ? 4 : density === "medium" ? 3 : 2)) } as CSSProperties}>
      {visible.map((item, index) => <button type="button" key={item.id} className={styles.cloudCard} data-idea-card={item.id} style={{ "--float-delay": `${-(index % 5) * .8}s`, "--tilt": `${(index % 3 - 1) * .55}deg` } as CSSProperties} onClick={event => { trigger.current = event.currentTarget; setError(""); setSelectedId(item.id); }} aria-label={`Xem ý tưởng của ${item.name || "Học viên"}`}>
        <span className={styles.cloudName}><i aria-hidden="true">{(item.name || "H").trim().charAt(0).toLocaleUpperCase("vi")}</i><strong>{item.name || "Học viên"}</strong></span>
        <span className={styles.cloudPreview}>{item.idea.replace(/\s+/g, " ").trim()}</span>
      </button>)}
    </div>
    {selected && <div className={styles.ideaBackdrop} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} tabIndex={-1} className={styles.ideaDialog} role="dialog" aria-modal="true" aria-labelledby="idea-dialog-title" data-interactive="true">
        <header><div><span className={styles.eyebrow}>Ý TƯỞNG</span><h2 id="idea-dialog-title">{selected.name || "Học viên"}</h2></div><button type="button" data-idea-close onClick={close} disabled={deleting} aria-label="Đóng ý tưởng">×</button></header>
        <p className={styles.fullIdea}>{selected.idea}</p>
        <footer><time>{new Date(selected.submittedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</time>{onDelete && <button type="button" className={styles.deleteIdea} disabled={deleting} onClick={() => void remove()}>{deleting ? "Đang xóa…" : "Xóa vĩnh viễn"}</button>}</footer>
        {error && <p className={styles.deleteError} role="alert">{error}</p>}
      </section>
    </div>}
  </>;
}
