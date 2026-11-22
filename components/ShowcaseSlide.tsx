"use client";
import { listenInteractive, realtimeReady, useRealtimeReady } from "@/lib/realtime/client";

import { ClipboardEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSlideStorage, setSlideStorage, SLIDE_STORAGE_KEYS } from "@/lib/slideStorage";
import styles from "./ShowcaseSlide.module.css";
import { useLiveRefresh, cancelledRefresh } from "@/lib/liveRefresh";
import type { ShowcaseGuide, ShowcasePractice } from "@/lib/compiledSectionMetadata";
import PracticeCountdown from "./PracticeCountdown";

function GuideIcon({ kind, src }: { kind: string; src?: string }) {
  if (kind === "Node.js") return <svg viewBox="0 0 80 80" aria-label="Node.js"><path d="M40 4 72 22v36L40 76 8 58V22Z" fill="#43853d"/><text x="40" y="49" textAnchor="middle" fill="white" fontSize="26" fontWeight="800">JS</text></svg>;
  if (src) return <img src={src} alt={kind}/>;
  if (kind === "Browser") return <span aria-label="Browser">↗</span>;
  return <svg viewBox={kind === "warning" ? "0 0 40 40" : "0 0 32 32"} fill="none" stroke="currentColor" strokeWidth={kind === "warning" ? 2.5 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "warning" ? <><path d="M17 6a3.5 3.5 0 0 1 6 0l14 25a3.5 3.5 0 0 1-3 5H6a3.5 3.5 0 0 1-3-5Z"/><path d="M20 14v10m0 5v1"/></> : kind === "data" ? <><ellipse cx="16" cy="7" rx="10" ry="4"/><path d="M6 7v8c0 2 4.5 4 10 4m10-12v6M6 15v8c0 2 4.5 4 10 4m5-10v12m-4-4 4 4 4-4"/></> : <><path d="m16 3 11 4v9c0 7-11 13-11 13S5 23 5 16V7Z"/><path d="m13 11-4 4 4 4m6-8 4 4-4 4"/></>}</svg>;
}

type ShowcaseItem = {
  id: string;
  name: string;
  url: string;
  sharedAt: string;
  kind?: "image";
};

type ShowcaseSection = "section1" | "section2";

// Decks pass admin or section-scoped teaching access as the presenter capability.
type Props = { scale: number; isAdmin: boolean; section?: ShowcaseSection; sectionId?: string; courseTitle?: string; sectionTitle?: string; guide?: ShowcaseGuide; practice?: ShowcasePractice; templateImage?: string; pageNumber?: number };

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { message?: string; items?: ShowcaseItem[]; item?: ShowcaseItem; success?: boolean; deletedId?: string };
  } catch {
    throw new Error("Máy chủ trả về dữ liệu không hợp lệ. Hãy triển khai lại trang web trên Vercel.");
  }
}

export default function ShowcaseSlide({ scale, isAdmin, section = "section1", sectionId, courseTitle, sectionTitle, guide, practice, templateImage, pageNumber }: Props) {
  const [hintOpen, setHintOpen] = useState(false);
  const hintTrigger = useRef<HTMLButtonElement>(null);
  const hintClose = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!hintOpen) return;
    const trigger = hintTrigger.current;
    hintClose.current?.focus();
    return () => trigger?.focus();
  }, [hintOpen]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const guideTrigger = useRef<HTMLButtonElement>(null);
  const guideDialog = useRef<HTMLElement>(null);
  const guideClose = useRef<HTMLButtonElement>(null);
  const closeGuide = () => { setGuideOpen(false); setStopOpen(false); setCopyStatus(""); };
  useEffect(() => { if (!guideOpen) return; guideClose.current?.focus(); return () => guideTrigger.current?.focus(); }, [guideOpen]);
  useEffect(() => { if (guideOpen) guideClose.current?.focus(); }, [guideOpen, stopOpen]);
  const copyCommand = async (command: string) => {
    try { await window.navigator.clipboard.writeText(command); setCopyStatus("Đã sao chép"); }
    catch { setCopyStatus("Chưa sao chép được. Hãy chọn và sao chép lệnh bên cạnh."); }
  };
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [url, setUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [shareMode, setShareMode] = useState<"link" | "image">("link");
  const [practiceTab, setPracticeTab] = useState<"share" | "board">("share");
  const [image, setImage] = useState<File | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const shareRevision = useRef(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = useRef(false);
  const deletionRequest = useRef<AbortController | null>(null);
  const submissionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { submissionRequest.current?.abort(); deletionRequest.current?.abort(); }, [sectionId, section]);
  const endpoint = sectionId ? `/api/sections/${encodeURIComponent(sectionId)}/showcase${practice?.activityId ? `?activity=${encodeURIComponent(practice.activityId)}` : ""}` : `/api/showcase?section=${encodeURIComponent(section)}`;
  const hiddenStorageKey = sectionId ? `eiu-showcase-hidden:${sectionId}${practice?.activityId ? `:${practice.activityId}` : ""}` : section === "section2"
    ? SLIDE_STORAGE_KEYS.s2_hiddenShowcase
    : SLIDE_STORAGE_KEYS.s1_hiddenShowcase;
  const hiddenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = JSON.parse(getSlideStorage(hiddenStorageKey) ?? "[]") as unknown;
      hiddenIdsRef.current = new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch {
      hiddenIdsRef.current = new Set();
    }
  }, [hiddenStorageKey]);

  const readItems = useCallback(async (signal: AbortSignal) => {
    const revision = shareRevision.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const payload = await readJson(response);
      signal.throwIfAborted();
      if (revision !== shareRevision.current) return;
      if (!response.ok) throw new Error(payload.message || "Không thể tải danh sách.");
      setItems(
        (Array.isArray(payload.items) ? payload.items : [])
          .filter((item) => practice?.allowDelete || !hiddenIdsRef.current.has(item.id))
      );
      if (!sending.current && !deleting.current) { setStatus("idle"); setMessage(""); }
    } catch (error) {
      if (cancelledRefresh(signal)) return;
      if (sending.current || deleting.current || revision !== shareRevision.current) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể tải danh sách.");
    } finally {
      if (!cancelledRefresh(signal)) setLoading(false);
    }
  }, [endpoint, practice?.allowDelete]);
  const loadItems = useLiveRefresh(readItems);
  const convexReady = useRealtimeReady();

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0);
    const stopRealtime = listenInteractive(sectionId || section, "showcase", () => void loadItems());
    const supabase = convexReady ? null : getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(`eiu:showcase:${sectionId || section}`)
      .on("broadcast", { event: "showcase_changed" }, () => void loadItems())
      .subscribe();
    const poll = () => { if (!realtimeReady() && document.visibilityState === "visible") void loadItems(false); };
    const fallbackTimer = window.setInterval(poll, sectionId ? 10_000 : 60_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopRealtime();
      window.clearTimeout(timer);
      window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", poll);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [loadItems, section, sectionId, convexReady]);

  function chooseImage(file: File | null) {
    if (sending.current) return;
    if (file && (file.size > 4 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))) {
      setImage(null);
      if (imageInput.current) imageInput.current.value = "";
      setStatus("error");
      setMessage("Choose a PNG, JPG or WebP image smaller than 4 MB.");
      return;
    }
    setImage(file);
    setStatus("idle");
    setMessage("");
  }

  function pasteImage(event: ClipboardEvent<HTMLFormElement>) {
    if (!practice?.allowImages) return;
    const file = Array.from(event.clipboardData.items).find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile()
      || Array.from(event.clipboardData.files).find(file => file.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    if (sending.current) return;
    setShareMode("image");
    if (imageInput.current) imageInput.current.value = "";
    chooseImage(file);
  }

  async function shareApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    shareRevision.current++;
    setStatus("sending");
    setMessage("");

    const controller = new AbortController();
    submissionRequest.current = controller;
    try {
      let body: string | FormData = JSON.stringify({ section, url, website });
      if (practice?.allowImages && shareMode === "image") {
        if (!image) throw new Error("Choose an image to share.");
        if (image.size > 4 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(image.type)) throw new Error("Choose a PNG, JPG or WebP image smaller than 4 MB.");
        const form = new FormData(); form.set("image", image); form.set("website", website); body = form;
      }
      const response = await fetch(sectionId ? endpoint : "/api/showcase", {
        method: "POST", signal: controller.signal,
        ...(typeof body === "string" ? { headers: { "Content-Type": "application/json" } } : {}),
        body,
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Không thể chia sẻ liên kết.");
      if (!payload.item) throw new Error("Máy chủ không trả về bài làm vừa chia sẻ.");
      controller.signal.throwIfAborted();
      const sharedItem = payload.item;
      shareRevision.current++;
      setItems((current) => [sharedItem, ...current.filter((item) => item.id !== sharedItem.id)]);
      setUrl("");
      setImage(null);
      if (imageInput.current) imageInput.current.value = "";
      if (practice) setPracticeTab("board");
      setStatus("idle");
      setMessage(practice ? "Your result has been shared." : sectionId || section === "section2" ? "Đã chia sẻ bài làm thành công." : "Đã chia sẻ ứng dụng thành công.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể chia sẻ liên kết.");
    } finally {
      sending.current = false;
      if (submissionRequest.current === controller) submissionRequest.current = null;
    }
  }

  async function deleteSharedWork(item: ShowcaseItem) {
    if (!isAdmin || !practice?.allowDelete || !sectionId || deleting.current) return;
    if (!window.confirm(`Permanently delete work shared by ${item.name}? This removes it from Supabase and future reports, including its stored image.`)) return;
    deleting.current = true;
    shareRevision.current++;
    setDeletingId(item.id);
    setStatus("idle");
    setMessage("");
    const controller = new AbortController();
    deletionRequest.current = controller;
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }), signal: controller.signal });
      const payload = await readJson(response);
      controller.signal.throwIfAborted();
      if (!response.ok || payload.success !== true || payload.deletedId !== item.id) throw new Error(payload.message || "Unable to delete this work. Please try again.");
      shareRevision.current++;
      setItems(current => current.filter(entry => entry.id !== item.id));
      setMessage("Work permanently deleted from Supabase.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to delete this work. Please try again.");
    } finally {
      deleting.current = false;
      if (!controller.signal.aborted) setDeletingId(null);
      if (deletionRequest.current === controller) deletionRequest.current = null;
    }
  }

  function deleteItem(item: ShowcaseItem) {
    if (!isAdmin) return;
    if (practice?.allowDelete) { void deleteSharedWork(item); return; }
    if (!window.confirm(`Ẩn bài chia sẻ của ${item.name} khỏi slide? Dữ liệu vẫn được giữ trong báo cáo Excel.`)) return;

    setStatus("idle");
    hiddenIdsRef.current.add(item.id);
    setSlideStorage(hiddenStorageKey, JSON.stringify([...hiddenIdsRef.current]));
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setMessage("Đã ẩn khỏi slide. Dữ liệu vẫn được giữ để xuất Excel.");
  }

  function clearAllItems() {
    if (!isAdmin || items.length === 0) return;
    if (!window.confirm(`Ẩn toàn bộ ${items.length} ${section === "section2" ? "bài làm" : "ứng dụng"} khỏi slide? Dữ liệu vẫn được giữ trong báo cáo Excel.`)) return;

    setStatus("idle");
    items.forEach((item) => hiddenIdsRef.current.add(item.id));
    setSlideStorage(hiddenStorageKey, JSON.stringify([...hiddenIdsRef.current]));
    setItems([]);
    setMessage("Đã ẩn danh sách khỏi slide. Dữ liệu vẫn được giữ để xuất Excel.");
  }

  const isSectionTwo = section === "section2" || Boolean(sectionId);
  const boardTitle = sectionId ? "Chia sẻ bài làm với giảng viên" : isSectionTwo ? "Không gian chia sẻ bài làm - Section 2" : "Không gian chia sẻ ứng dụng";
  const itemLabel = isSectionTwo ? "bài làm" : "ứng dụng";

  if (practice) return (
    <section className={styles.practiceRoot} style={{ transform: `scale(${scale})`, ...(templateImage ? { backgroundImage: `url(${JSON.stringify(templateImage)})` } : {}) }} aria-label={practice.title} data-interactive="true">
      <main className={styles.practiceContent}>
        <header className={styles.practiceHeader} inert={hintOpen}><h1>{practice.title}</h1><div className={styles.practiceControls}>{isAdmin && <PracticeCountdown minutes={practice.minutes} scope={`${sectionId || section}:${practice.activityId || "manual-task"}`} />}{practice.hint && <button ref={hintTrigger} type="button" className={styles.practiceHintTrigger} aria-haspopup="dialog" aria-expanded={hintOpen} onClick={() => setHintOpen(true)}>Hint</button>}</div></header>
        <div className={styles.practiceLayout} inert={hintOpen}>
          <section className={styles.practiceTask}>
            <p className={styles.practiceGoal}>{practice.goal}</p>
            <ol>{practice.steps.map(step => <li key={step}>{step}</li>)}</ol>
            {practice.deliverable && <p className={styles.practiceDeliverable}>{practice.deliverable}</p>}
          </section>
          <section className={styles.practiceSharing} aria-label="Share your work">
            <nav className={styles.practiceTabs} aria-label="Sharing views">
              {!isAdmin && <button type="button" aria-pressed={practiceTab === "share"} onClick={() => setPracticeTab("share")}>Share your work</button>}
              <button type="button" aria-pressed={isAdmin || practiceTab === "board"} onClick={() => setPracticeTab("board")}>Class board ({items.length})</button>
              <button type="button" className={styles.practiceRefresh} onClick={() => void loadItems()} aria-label="Refresh shared work">↻</button>
            </nav>
            {!isAdmin && practiceTab === "share" ? <form className={styles.practiceForm} onSubmit={shareApp} onPaste={pasteImage}>
              <h2>Share one result</h2>
              <p>Your Learning identity is included automatically.</p>
              <div className={styles.practiceModes}>
                <button type="button" disabled={status === "sending"} aria-pressed={shareMode === "link"} onClick={() => setShareMode("link")}>Link</button>
                {practice.allowImages && <button type="button" disabled={status === "sending"} aria-pressed={shareMode === "image"} onClick={() => setShareMode("image")}>Image</button>}
              </div>
              {shareMode === "link" ? <label>HTTPS link<input type="url" value={url} onChange={event => setUrl(event.target.value)} maxLength={500} placeholder="https://..." required disabled={status === "sending"}/></label>
                : <div className={styles.practiceImageField}>
                  <span>PNG, JPG or WebP · up to 4 MB</span>
                  <div className={styles.practicePasteArea} tabIndex={0} role="group" aria-label="Paste an image or choose a file" title={image?.name}>
                    <span aria-live="polite">{image ? "Image ready to share" : "Paste image (Ctrl+V)"}</span>
                    <button type="button" disabled={status === "sending"} onClick={() => imageInput.current?.click()}>Choose file</button>
                    <input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/webp" disabled={status === "sending"} onChange={event => chooseImage(event.target.files?.[0] || null)}/>
                  </div>
                </div>}
              <label className={styles.honeypot} aria-hidden="true">Website<input value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off"/></label>
              <button className={styles.practiceSubmit} type="submit" disabled={status === "sending"}>{status === "sending" ? "Sharing…" : "Share result"}</button>
              <small>Use a result you may share with this class. Remove personal or confidential information.</small>
            </form> : <div className={styles.practiceBoard}>
              {loading ? <p className={styles.practiceEmpty}>Loading shared work…</p> : !items.length ? <div className={styles.practiceEmpty}><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="16" y="12" width="42" height="53" rx="9" fill="#edf8f8"/><path d="M25 27h24M25 35h17M25 43h11M30 65v5h34V27h-6"/><circle cx="54" cy="54" r="14" fill="#fff"/><path d="M54 61V47m-5 5 5-5 5 5"/></svg><span>No work shared yet.</span></div> : <ol>{items.map((entry, index) => <li key={entry.id}>
                <span>{String(index + 1).padStart(2, "0")}</span><strong>{entry.name}</strong>
                <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.kind === "image" ? "Open image ↗" : "Open work ↗"}</a>
                {isAdmin && <button type="button" disabled={Boolean(deletingId)} onClick={() => deleteItem(entry)} aria-label={`${practice.allowDelete ? "Delete" : "Hide"} work by ${entry.name}`}>{deletingId === entry.id ? "Deleting…" : practice.allowDelete ? "Delete" : "Hide"}</button>}
              </li>)}</ol>}
            </div>}
            {message && <p className={`${styles.practiceStatus} ${status === "error" ? styles.error : ""}`} role="status">{message}</p>}
          </section>
        </div>
        {hintOpen && practice.hint && <section className={styles.practiceHintOverlay} role="dialog" aria-modal="true" aria-label="Prompt hint" onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setHintOpen(false); }
          if (event.key === "Tab") { event.preventDefault(); hintClose.current?.focus(); }
        }}>
          <header className={styles.practiceHintHeading}><h2>You should use this prompt:</h2><button ref={hintClose} type="button" aria-label="Close hint" onClick={() => setHintOpen(false)}>Close</button></header>
          <p className={styles.practiceHintText}>{practice.hint}</p>
        </section>}
      </main>
      <span className={styles.practicePage}>{pageNumber || 5}</span>
    </section>
  );

  return (
    <section
      className={`${styles.root} ${sectionId ? styles.courseScoped : ""}`}
      spellCheck={sectionId ? false : undefined}
      style={{ transform: `scale(${scale})`, fontFamily: '"Segoe UI", "Noto Sans", Arial, sans-serif' }}
      data-interactive="true"
      aria-label={boardTitle}
    >
      <div className={styles.mesh} aria-hidden="true" />
      <header className={styles.header} inert={guideOpen}>
        <div><span className={styles.eyebrow}>{sectionId ? `${courseTitle} · ${sectionTitle}` : "Cộng đồng lớp học"}</span><h1>{sectionId ? "Chia sẻ bài làm với giảng viên" : boardTitle}</h1></div>
        <div className={styles.headerActions}><span className={styles.live}><i /> {isAdmin ? "QUẢN TRỊ" : "ĐANG HOẠT ĐỘNG"}</span>{guide && <button ref={guideTrigger} type="button" className={styles.guideTrigger} aria-haspopup="dialog" onClick={() => setGuideOpen(true)}>Hướng dẫn</button>}</div>
      </header>
      <div className={`${styles.columns} ${isAdmin ? styles.boardOnly : ""}`} inert={guideOpen}>
        <section className={styles.board}>
          <div className={styles.panelHead}>
            <div><span>Đã chia sẻ</span><strong>{items.length} {itemLabel}</strong></div>
            <div className={styles.adminBoardActions}>
              {isAdmin && (
                <button
                  type="button"
                  className={styles.clearAll}
                  onClick={clearAllItems}
                  disabled={items.length === 0}
                >
                  Xóa hết
                </button>
              )}
              <button type="button" onClick={() => void loadItems()} aria-label="Tải lại danh sách">↻</button>
            </div>
          </div>
          <div className={styles.list} aria-live="polite">
            {loading ? <div className={styles.empty}>Đang tải danh sách...</div> : items.length === 0 ? <div className={styles.empty}>{isAdmin ? `Chưa có ${itemLabel} được chia sẻ.` : isSectionTwo ? "Chưa có bài làm nào. Hãy là người đầu tiên chia sẻ!" : "Chưa có ứng dụng nào. Hãy là người đầu tiên chia sẻ!"}</div> : items.map((item, index) => (
              <article className={styles.item} key={item.id}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.name}</strong><small>{item.sharedAt ? new Date(item.sharedAt).toLocaleDateString("vi-VN") : "Vừa chia sẻ"}</small></div>
                <div className="showcase-item-actions">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">{isSectionTwo ? "Mở bài làm ↗" : "Mở ứng dụng ↗"}</a>
                  {isAdmin && (
                    <button
                      type="button"
                      className="showcase-delete-button"
                      onClick={() => deleteItem(item)}
                      title="Ẩn khỏi slide"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {isAdmin && message && <div className={`${styles.message} ${status === "error" ? styles.error : ""}`} role="status">{message}</div>}
        </section>

        {!isAdmin && <form className={styles.form} onSubmit={shareApp}>
          <span className={styles.formKicker}>Chia sẻ bài làm</span>
          <h2 style={{ whiteSpace: "nowrap", fontSize: "23px", lineHeight: 1.16, letterSpacing: "-.02em" }}>{sectionId ? "Gửi link bài làm" : "Đưa bài làm của bạn lên bảng"}</h2>
          <p>{sectionId ? "Dán link HTTPS của website hoặc bản demo để giảng viên xem bài. Link demo cần máy và app tiếp tục chạy." : isSectionTwo ? "Dán liên kết bài làm đã hoàn thiện để cả lớp cùng xem." : "Dán liên kết ứng dụng đã triển khai từ nền tảng lập trình của Google."}</p>
          <p>Họ tên và email được tự động lấy từ thông tin bạn đã nhập khi đăng nhập.</p>
          <label>{isSectionTwo ? "Liên kết bài làm" : "Liên kết ứng dụng"}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={500} placeholder={sectionId ? "https://<id>-3000.<region>.devtunnels.ms" : isSectionTwo ? "https://..." : "https://script.google.com/macros/s/.../exec"} required /></label>
          <label className={styles.honeypot} aria-hidden="true">Trang web<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Đang chia sẻ..." : isSectionTwo ? "Chia sẻ bài làm" : "Chia sẻ ứng dụng"}</button>
          {message && <div className={`${styles.message} ${status === "error" ? styles.error : ""}`} role="status">{message}</div>}
        </form>}
      </div>
      {guideOpen && guide && <div className={styles.guideOverlay} onClick={event => { if (event.target === event.currentTarget) closeGuide(); }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeGuide(); }
        if (event.key === "Tab") {
          const controls = Array.from(guideDialog.current?.querySelectorAll<HTMLElement>('button,[href],[tabindex="0"]') ?? []).filter(control => !control.closest('[hidden]'));
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <section ref={guideDialog} className={styles.guideDialog} role="dialog" aria-modal="true" aria-labelledby="showcase-guide-title">
          <header><h2 id="showcase-guide-title">{guide.title}</h2><button ref={guideClose} type="button" onClick={closeGuide} aria-label="Đóng hướng dẫn">×</button></header>
          <p className={styles.guideMessage} hidden={stopOpen}>{guide.message}</p>
          <div className={styles.guideGrid} hidden={stopOpen}>
            <div className={styles.guideSteps}>{guide.cards.slice(0, 3).map((card, index) => <article key={card.title}><span>{index + 1}</span><div><h3><span className={styles.guideLogo}><GuideIcon kind={card.logo || "VS Code"} src={card.logoSrc}/></span>{card.title}</h3><p>{card.text}</p>{card.detail && <p>{card.detail}</p>}{card.code && <div className={styles.guideCommand}><code>{card.code}</code><button type="button" onClick={() => void copyCommand(card.code!)}>Copy</button></div>}</div></article>)}<p className={styles.guideCopyStatus} role="status">{copyStatus}</p></div>
            {guide.cards[3] && <aside className={styles.guideRisk}><h3><span className={styles.guideWarning}><GuideIcon kind="warning"/></span> {guide.cards[3].title}</h3><strong>{guide.cards[3].text}</strong><p>{guide.cards[3].detail}</p><div className={styles.guideRisks}>{guide.cards[3].modes?.map((mode, index) => <section key={mode.title}><span className={styles.guideRiskIcon}><GuideIcon kind={index === 0 ? "data" : "api"}/></span><div><h4>{mode.title}</h4><p>{mode.text}</p></div></section>)}</div><ul>{guide.cards[3].summary?.map((point, index) => <li key={point}>{point}{index === 2 && <> <button type="button" onClick={() => setStopOpen(true)}>Cách dừng ↗</button></>}</li>)}</ul></aside>}
          </div>
          {stopOpen && <section className={styles.guideStop}><h3>Dừng chia sẻ qua Ports</h3><ol>{guide.cards[3].points?.map(point => <li key={point}>{point}</li>)}</ol><p>Dừng chuyển tiếp sẽ ngắt link chia sẻ; app local vẫn có thể chạy.</p><button type="button" onClick={() => setStopOpen(false)}>← Quay lại hướng dẫn</button></section>}
        </section>
      </div>}
    </section>
  );
}
