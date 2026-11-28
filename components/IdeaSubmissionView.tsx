import { useState, type FormEvent } from "react";
import styles from "./IdeaSubmissionView.module.css";
import IdeaCloud from "./IdeaCloud";

export type IdeaItem = { id: string; name?: string; idea: string; submittedAt: string };
type Props = { scale?: number; presenter?: boolean; offline?: boolean; items?: IdeaItem[]; message?: string; onSubmit?: (idea: string) => Promise<void>; onRefresh?: () => void; onDelete?: (id: string) => Promise<void> };
export default function IdeaSubmissionView({ scale = 1, presenter = false, offline = false, items = [], message = "", onSubmit, onRefresh, onDelete }: Props) {
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || !idea.trim() || !onSubmit) return;
    setSending(true); setStatus("");
    try { await onSubmit(idea.trim()); setIdea(""); setStatus("Ý tưởng đã được gửi đến màn hình của giảng viên."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Chưa gửi được ý tưởng. Vui lòng thử lại."); }
    finally { setSending(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([idea], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "Y-tuong-quan-ly.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={styles.viewport}><main className={styles.canvas} style={{ transform: `scale(${scale})` }} data-preserve-original="true" data-manager-submission="true" data-eiu-ideas={offline ? "true" : undefined}>
    <header><span className={styles.eyebrow}>TỪ NHU CẦU ĐẾN Ý TƯỞNG</span><h1>{presenter ? "Nhu cầu thực tế" : "Quy trình nào bạn muốn AI hỗ trợ?"}</h1>{!presenter && <p>Chọn một việc thực tế trong đội ngũ của bạn và phác thảo hướng cải thiện.</p>}</header>
    <div className={`${styles.layout} ${presenter ? styles.presenter : ""}`}>
      {!presenter && <aside className={styles.brief} aria-label="Gợi ý xây dựng ý tưởng">
        <span className={styles.badge}>GÓC NHÌN QUẢN LÝ</span>
        {[["problem", "Vấn đề hiện tại", "Việc gì đang tốn thời gian hoặc dễ sai sót?"], ["ai", "AI có thể hỗ trợ", "Bước nào nên tự động hóa, bước nào cần người duyệt?"], ["result", "Kết quả mong muốn", "Bạn muốn cải thiện thời gian, chất lượng hay khả năng theo dõi?"]].map(([kind, title, detail]) => <div className={styles.prompt} key={kind}>
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{kind === "problem" ? <><circle cx="24" cy="24" r="17"/><path d="M24 13v12l8 5"/></> : kind === "ai" ? <><rect x="8" y="13" width="32" height="25" rx="7"/><path d="M24 6v7M17 23v3m14-3v3M18 32h12"/></> : <><path d="M9 7v34h33M17 33V23m10 10V17m10 16V9"/><path d="m15 17 10-7 9 2 8-7"/></>}</svg>
          <div><h2>{title}</h2><p>{detail}</p></div>
        </div>)}
        <small>Bắt đầu từ nhu cầu thực tế của đội ngũ.</small>
      </aside>}
      {presenter ? <section className={styles.board} aria-label="Ý tưởng"><div className={styles.boardHeading}><h2>Ý tưởng <span>{items.length}</span></h2><button type="button" onClick={onRefresh}>Cập nhật</button></div><div className={`${styles.results} ${items.length ? styles.cloudResults : styles.waitingResults}`}>{items.length ? <IdeaCloud items={items} onDelete={onDelete}/> : <div className={styles.empty} data-ideas-waiting role="status" aria-label="Đang chờ ý tưởng đầu tiên"><span className={styles.spinner} aria-hidden="true"/><div className={styles.loadingDots} aria-hidden="true"><i/><i/><i/></div></div>}</div>{message && <p className={styles.status} role="status">{message}</p>}</section>
        : <form className={styles.form} onSubmit={submit} data-interactive="true"><div className={styles.formHeading}><label htmlFor="manager-idea">Ý tưởng của bạn</label><span>Tối đa 500 ký tự</span></div><textarea id="manager-idea" required maxLength={500} value={idea} onChange={event => setIdea(event.target.value)} disabled={sending}/><div className={styles.counter}>{idea.length}/500</div><div className={styles.actions}>{offline && <p>Bản tải xuống: lưu bản nháp và gửi bài trên website khóa học.</p>}{offline ? <button type="button" onClick={download} disabled={!idea.trim()}>Tải bản nháp ↓</button> : <button type="submit" disabled={sending || !idea.trim()}>{sending ? "Đang gửi…" : "Gửi ý tưởng ↗"}</button>}</div><p className={styles.status} role="status">{status || message}</p></form>}
    </div>
  </main></div>;
}
