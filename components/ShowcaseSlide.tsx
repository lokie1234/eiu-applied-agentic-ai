"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./ShowcaseSlide.module.css";

type ShowcaseItem = {
  id: string;
  name: string;
  url: string;
  sharedAt: string;
};

type ShowcaseSection = "section1" | "section2";

type Props = { scale: number; isAdmin: boolean; section?: ShowcaseSection };

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { message?: string; items?: ShowcaseItem[]; item?: ShowcaseItem };
  } catch {
    throw new Error("Máy chủ trả về dữ liệu không hợp lệ. Hãy triển khai lại trang web trên Vercel.");
  }
}

export default function ShowcaseSlide({ scale, isAdmin, section = "section1" }: Props) {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [url, setUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearingAll, setClearingAll] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/showcase?section=${encodeURIComponent(section)}`, { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Không thể tải danh sách.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể tải danh sách.");
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0);
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(`eiu:showcase:${section}`)
      .on("broadcast", { event: "showcase_changed" }, () => void loadItems())
      .subscribe();
    const fallbackTimer = window.setInterval(() => void loadItems(), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(fallbackTimer);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [loadItems, section]);

  async function shareApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, url, website }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Không thể chia sẻ liên kết.");
      if (!payload.item) throw new Error("Máy chủ không trả về bài làm vừa chia sẻ.");
      const sharedItem = payload.item;
      setItems((current) => [sharedItem, ...current.filter((item) => item.id !== sharedItem.id)]);
      setUrl("");
      setStatus("idle");
      setMessage(section === "section2" ? "Đã chia sẻ bài làm thành công." : "Đã chia sẻ ứng dụng thành công.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể chia sẻ liên kết.");
    }
  }

  async function deleteItem(item: ShowcaseItem) {
    if (!isAdmin || deletingId) return;
    if (!window.confirm(`Xóa bài chia sẻ của ${item.name}?`)) return;

    setDeletingId(item.id);
    setStatus("idle");
    setMessage("");
    try {
      const response = await fetch("/api/showcase", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, id: item.id }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Không thể xóa bài chia sẻ.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage("Đã xóa bài chia sẻ.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể xóa bài chia sẻ.");
    } finally {
      setDeletingId("");
    }
  }

  async function clearAllItems() {
    if (!isAdmin || clearingAll || deletingId || items.length === 0) return;
    if (!window.confirm(`Xóa toàn bộ ${items.length} ${section === "section2" ? "bài làm" : "ứng dụng"} đã chia sẻ? Thao tác này không thể hoàn tác.`)) return;

    setClearingAll(true);
    setStatus("idle");
    setMessage("");
    try {
      const response = await fetch("/api/showcase", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, all: true }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Không thể xóa toàn bộ danh sách.");
      setItems([]);
      setMessage("Đã xóa toàn bộ danh sách.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể xóa toàn bộ danh sách.");
    } finally {
      setClearingAll(false);
    }
  }

  const isSectionTwo = section === "section2";
  const boardTitle = isSectionTwo ? "Không gian chia sẻ bài làm - Section 2" : "Không gian chia sẻ ứng dụng";
  const itemLabel = isSectionTwo ? "bài làm" : "ứng dụng";

  return (
    <section
      className={styles.root}
      style={{ transform: `scale(${scale})`, fontFamily: '"Segoe UI", "Noto Sans", Arial, sans-serif' }}
      data-interactive="true"
      aria-label={boardTitle}
    >
      <div className={styles.mesh} aria-hidden="true" />
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>Cộng đồng lớp học</span><h1>{boardTitle}</h1></div>
        <span className={styles.live}><i /> {isAdmin ? "QUẢN TRỊ" : "ĐANG HOẠT ĐỘNG"}</span>
      </header>
      <div className={styles.columns}>
        <section className={styles.board}>
          <div className={styles.panelHead}>
            <div><span>Đã chia sẻ</span><strong>{items.length} {itemLabel}</strong></div>
            <div className={styles.adminBoardActions}>
              {isAdmin && (
                <button
                  type="button"
                  className={styles.clearAll}
                  onClick={() => void clearAllItems()}
                  disabled={clearingAll || Boolean(deletingId) || items.length === 0}
                >
                  {clearingAll ? "Đang xóa…" : "Xóa hết"}
                </button>
              )}
              <button type="button" onClick={() => void loadItems()} aria-label="Tải lại danh sách">↻</button>
            </div>
          </div>
          <div className={styles.list} aria-live="polite">
            {loading ? <div className={styles.empty}>Đang tải danh sách...</div> : items.length === 0 ? <div className={styles.empty}>{isSectionTwo ? "Chưa có bài làm nào. Hãy là người đầu tiên chia sẻ!" : "Chưa có ứng dụng nào. Hãy là người đầu tiên chia sẻ!"}</div> : items.map((item, index) => (
              <article className={styles.item} key={item.id}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.name}</strong><small>{item.sharedAt ? new Date(item.sharedAt).toLocaleDateString("vi-VN") : "Vừa chia sẻ"}</small></div>
                <div className="showcase-item-actions">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">{isSectionTwo ? "Mở bài làm ↗" : "Mở ứng dụng ↗"}</a>
                  {isAdmin && (
                    <button
                      type="button"
                      className="showcase-delete-button"
                      onClick={() => void deleteItem(item)}
                      disabled={Boolean(deletingId)}
                      title="Xóa khỏi bảng"
                    >
                      {deletingId === item.id ? "..." : "Xóa"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <form className={styles.form} onSubmit={shareApp}>
          <span className={styles.formKicker}>Chia sẻ bài làm</span>
          <h2 style={{ whiteSpace: "nowrap", fontSize: "23px", lineHeight: 1.16, letterSpacing: "-.02em" }}>Đưa bài làm của bạn lên bảng</h2>
          <p>{isSectionTwo ? "Dán liên kết bài làm đã hoàn thiện để cả lớp cùng xem." : "Dán liên kết ứng dụng đã triển khai từ nền tảng lập trình của Google."}</p>
          <p>Họ tên và email được tự động lấy từ thông tin bạn đã nhập khi đăng nhập.</p>
          <label>{isSectionTwo ? "Liên kết bài làm" : "Liên kết ứng dụng"}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={500} placeholder={isSectionTwo ? "https://..." : "https://script.google.com/macros/s/.../exec"} required /></label>
          <label className={styles.honeypot} aria-hidden="true">Trang web<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Đang chia sẻ..." : isSectionTwo ? "Chia sẻ bài làm" : "Chia sẻ ứng dụng"}</button>
          {message && <div className={`${styles.message} ${status === "error" ? styles.error : ""}`} role="status">{message}</div>}
        </form>
      </div>
    </section>
  );
}
