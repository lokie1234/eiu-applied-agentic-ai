"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./ShowcaseSlide.module.css";

type ShowcaseItem = {
  id: string;
  name: string;
  url: string;
  sharedAt: string;
};

type Props = { scale: number; isAdmin: boolean };

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { message?: string; items?: ShowcaseItem[]; item?: ShowcaseItem };
  } catch {
    throw new Error("Máy chủ trả về dữ liệu không hợp lệ. Hãy triển khai lại trang web trên Vercel.");
  }
}

export default function ShowcaseSlide({ scale, isAdmin }: Props) {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch("/api/showcase", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  async function shareApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, website }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.message || "Không thể chia sẻ liên kết.");
      if (!payload.item) throw new Error("Máy chủ không trả về bài làm vừa chia sẻ.");
      const sharedItem = payload.item;
      setItems((current) => [sharedItem, ...current.filter((item) => item.id !== sharedItem.id)]);
      setName("");
      setUrl("");
      setStatus("idle");
      setMessage("Đã chia sẻ ứng dụng thành công.");
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
        body: JSON.stringify({ id: item.id }),
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

  return (
    <section
      className={styles.root}
      style={{ transform: `scale(${scale})`, fontFamily: '"Segoe UI", "Noto Sans", Arial, sans-serif' }}
      data-interactive="true"
      aria-label="Không gian chia sẻ ứng dụng"
    >
      <div className={styles.mesh} aria-hidden="true" />
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>Cộng đồng lớp học</span><h1>Không gian chia sẻ ứng dụng</h1></div>
        <span className={styles.live}><i /> {isAdmin ? "QUẢN TRỊ" : "ĐANG HOẠT ĐỘNG"}</span>
      </header>
      <div className={styles.columns}>
        <section className={styles.board}>
          <div className={styles.panelHead}><div><span>Đã chia sẻ</span><strong>{items.length} ứng dụng</strong></div><button type="button" onClick={() => void loadItems()} aria-label="Tải lại danh sách">↻</button></div>
          <div className={styles.list} aria-live="polite">
            {loading ? <div className={styles.empty}>Đang tải danh sách...</div> : items.length === 0 ? <div className={styles.empty}>Chưa có ứng dụng nào. Hãy là người đầu tiên chia sẻ!</div> : items.map((item, index) => (
              <article className={styles.item} key={item.id}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.name}</strong><small>{item.sharedAt ? new Date(item.sharedAt).toLocaleDateString("vi-VN") : "Vừa chia sẻ"}</small></div>
                <div className="showcase-item-actions">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">Mở ứng dụng ↗</a>
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
          <h2>Đưa ứng dụng của bạn lên bảng</h2>
          <p>Dán liên kết ứng dụng đã triển khai từ nền tảng lập trình của Google.</p>
          <label>Tên của bạn<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Nguyễn Văn A" required /></label>
          <label>Liên kết ứng dụng<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={500} placeholder="https://script.google.com/macros/s/.../exec" required /></label>
          <label className={styles.honeypot} aria-hidden="true">Trang web<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Đang chia sẻ..." : "Chia sẻ ứng dụng"}</button>
          {message && <div className={`${styles.message} ${status === "error" ? styles.error : ""}`} role="status">{message}</div>}
        </form>
      </div>
    </section>
  );
}
