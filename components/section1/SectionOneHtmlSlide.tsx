"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import styles from "./SectionOneHtmlSlide.module.css";

export type SectionOneHtmlKind =
  | "slide3"
  | "slide4"
  | "idea-results"
  | "deployment";

type IdeaItem = {
  id: string;
  idea: string;
  submittedAt: string;
};

type Props = {
  kind: SectionOneHtmlKind;
  scale: number;
  isAdmin: boolean;
};

function Ambient({ strong = false }: { strong?: boolean }) {
  return (
    <div
      className={`${styles.ambient} ${strong ? styles.ambientStrong : ""}`}
      aria-hidden="true"
    >
      <div className={styles.grid} />
      <div className={styles.glow} />
      <svg viewBox="0 0 960 540" preserveAspectRatio="none">
        <path d="M-45 430 C155 318 300 455 474 298 C640 150 770 235 1010 85" />
      </svg>
      <i className={styles.nodeOne} />
      <i className={styles.nodeTwo} />
      <i className={styles.nodeThree} />
    </div>
  );
}

function SlideHeading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <header className={styles.heading}>
      <span>{eyebrow}</span>
      <h1>{children}</h1>
    </header>
  );
}

function SlideThree() {
  const languages = ["HTML", "CSS", "JavaScript", "SQL", "Framework"];

  return (
    <section className={styles.root}>
      <Ambient />
      <SlideHeading eyebrow="ĐỊNH HƯỚNG KHÓA HỌC">
        Đây <em>KHÔNG</em> phải khóa học lập trình
      </SlideHeading>

      <div className={styles.comparison}>
        <article className={styles.codeCard}>
          <span className={styles.cardLabel}>KHÔNG PHẢI TRỌNG TÂM</span>
          <div className={styles.languageGrid}>
            {languages.map((language, index) => (
              <div key={language} style={{ "--delay": `${index * 70}ms` } as CSSProperties}>
                <i />
                <strong>{language}</strong>
              </div>
            ))}
          </div>
          <div className={styles.crossMark} aria-hidden="true">
            <span />
            <span />
          </div>
        </article>

        <div className={styles.comparisonArrow} aria-hidden="true">
          <span />
          <i>→</i>
        </div>

        <article className={styles.aiCard}>
          <span className={styles.cardLabel}>MỤC TIÊU THỰC TẾ</span>
          <div className={styles.aiVisual} aria-hidden="true">
            <span>AI</span>
            <i className={styles.aiOrbitOne} />
            <i className={styles.aiOrbitTwo} />
            <i className={styles.aiOrbitThree} />
          </div>
          <h2>Thiết kế sản phẩm cùng AI</h2>
        </article>
      </div>
    </section>
  );
}

function SlideFour({ isAdmin }: { isAdmin: boolean }) {
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submitIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Không thể gửi ý tưởng.");

      setIdea("");
      setStatus("success");
      setMessage("Ý tưởng đã được gửi đến màn hình của giảng viên.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể gửi ý tưởng.");
    }
  }

  return (
    <section className={`${styles.root} ${styles.slideFour}`}>
      <Ambient strong />
      <SlideHeading eyebrow="BẮT ĐẦU TỪ NHU CẦU">
        Nếu được sử dụng AI để tự động hóa hay xây dựng một quy trình…
      </SlideHeading>

      <div className={styles.ideaLayout}>
        <article className={styles.bigQuestion}>
          <span className={styles.questionIndex}>01</span>
          <p>Bạn muốn AI làm việc gì?</p>
          <div className={styles.questionSignal} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </article>

        {!isAdmin ? (
          <form className={styles.ideaForm} onSubmit={submitIdea} data-interactive="true">
            <span className={styles.formEyebrow}>CHIA SẺ CÙNG LỚP</span>
            <label htmlFor="section-one-idea">Ý tưởng của bạn là gì?</label>
            <textarea
              id="section-one-idea"
              value={idea}
              onChange={(event) => {
                setIdea(event.target.value);
                if (status !== "sending") {
                  setStatus("idle");
                  setMessage("");
                }
              }}
              maxLength={500}
              placeholder="Nhập ý tưởng của bạn…"
              required
            />
            <div className={styles.formFooter}>
              <small>{idea.length}/500</small>
              <button type="submit" disabled={status === "sending" || !idea.trim()}>
                {status === "sending" ? "Đang gửi…" : "Gửi ý tưởng"}
                <span>→</span>
              </button>
            </div>
            {message && (
              <p className={`${styles.formMessage} ${status === "error" ? styles.formError : ""}`} role="status">
                {message}
              </p>
            )}
          </form>
        ) : (
          <div className={styles.adminIdeaVisual} aria-hidden="true">
            <span>IDEA</span>
            <div><i />Nhận nhu cầu</div>
            <div><i />Thiết kế quy trình</div>
            <div><i />Tạo sản phẩm</div>
          </div>
        )}
      </div>
    </section>
  );
}

function IdeaResults() {
  const [items, setItems] = useState<IdeaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const loadIdeas = useCallback(async () => {
    try {
      const response = await fetch("/api/ideas", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        items?: IdeaItem[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || "Không thể tải ý tưởng.");
      setItems(Array.isArray(payload.items) ? payload.items.slice(0, 8) : []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải ý tưởng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadIdeas(), 0);
    const timer = window.setInterval(() => void loadIdeas(), 4000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [loadIdeas]);

  async function deleteIdea(item: IdeaItem) {
    if (deletingId) return;
    if (!window.confirm(`Xóa ý tưởng “${item.idea}”?`)) return;

    setDeletingId(item.id);
    setError("");
    try {
      const response = await fetch("/api/ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Không thể xóa ý tưởng.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa ý tưởng.");
    } finally {
      setDeletingId("");
    }
  }

  function ideaWidth(value: string) {
    const length = Array.from(value.trim()).length;
    return Math.min(360, Math.max(150, 118 + length * 5.2));
  }

  return (
    <section className={`${styles.root} ${styles.resultsSlide}`}>
      <Ambient strong />
      <header className={styles.resultsHeader}>
        <div>
          <span>ADMIN · LIVE RESPONSE</span>
          <h1>Ý tưởng từ lớp học</h1>
        </div>
        <div className={styles.liveStatus}>
          <i />
          {items.length} ý tưởng
          <button type="button" onClick={() => void loadIdeas()} data-interactive="true" aria-label="Tải lại ý tưởng">
            ↻
          </button>
        </div>
      </header>

      <div className={styles.resultsGrid} aria-live="polite">
        {loading ? (
          <div className={styles.resultsEmpty}>Đang nhận dữ liệu từ lớp học…</div>
        ) : error ? (
          <div className={`${styles.resultsEmpty} ${styles.resultsError}`}>{error}</div>
        ) : items.length === 0 ? (
          <div className={styles.resultsEmpty}>Chưa có ý tưởng nào được gửi.</div>
        ) : (
          items.map((item, index) => (
            <article
              key={item.id}
              style={{
                "--delay": `${index * 70}ms`,
                "--float-delay": `${-(index % 5) * 0.55}s`,
                "--idea-width": `${ideaWidth(item.idea)}px`,
              } as CSSProperties}
            >
              <div className={styles.resultCardTop}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  className={styles.resultDelete}
                  onClick={() => void deleteIdea(item)}
                  disabled={Boolean(deletingId)}
                  data-interactive="true"
                  aria-label={`Xóa ý tưởng ${item.idea}`}
                  title="Xóa ý tưởng"
                >
                  {deletingId === item.id ? "…" : "×"}
                </button>
              </div>
              <p>{item.idea}</p>
              <small>{formatSubmittedTime(item.submittedAt)}</small>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatSubmittedTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Vừa gửi";
  return parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function DeploymentSlide() {
  return (
    <section className={`${styles.root} ${styles.deploymentSlide}`}>
      <Ambient strong />
      <header className={styles.stepHeading}>
        <div className={styles.stepBadge} aria-hidden="true" />
        <h1>Bước 1 -</h1>
        <div className={styles.geminiWordmark} aria-label="Gemini">
          <i />
          <span>Gemini</span>
        </div>
      </header>

      <div className={styles.geminiGuideLayout}>
        <article className={styles.geminiMenuShot}>
          <div className={styles.menuCard} aria-hidden="true">
            <div className={styles.menuItem}>About Gemini</div>
            <div className={styles.menuItem}>Get Gemini App</div>
            <div className={styles.menuItem}>Pricing</div>
            <div className={styles.menuItem}>For Business</div>
            <div className={`${styles.menuItem} ${styles.menuItemHighlight}`}>Sign in</div>
            <div className={styles.menuGear}>⚙</div>
          </div>
        </article>

        <div className={styles.geminiGuideConnector} aria-hidden="true">
          <span />
          <i>▶</i>
        </div>

        <article className={styles.geminiAppShot}>
          <div className={styles.appFrame} aria-hidden="true">
            <div className={styles.appHeadline}>Hi Lâm Trường, what&apos;s the plan?</div>
            <div className={styles.appComposer}>
              <span>＋</span>
              <b>Ask Gemini</b>
              <em>Pro ▾</em>
              <strong>🎙</strong>
            </div>
            <div className={styles.modelDropdown}>
              <div className={styles.modelOption}>
                <div>
                  <b>3.6 Flash</b>
                  <span>All-around help</span>
                </div>
                <small>New</small>
              </div>
              <div className={styles.modelOption}>
                <div>
                  <b>3.6 Thinking</b>
                  <span>Solves complex problems</span>
                </div>
              </div>
              <div className={`${styles.modelOption} ${styles.modelOptionHighlight}`}>
                <div>
                  <b>3.6 Thinking</b>
                  <span>Advanced reasoning</span>
                </div>
                <small>✓</small>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export default function SectionOneHtmlSlide({ kind, scale, isAdmin }: Props) {
  return (
    <div
      className={styles.scaledCanvas}
      style={{ transform: `scale(${scale})` }}
      aria-label="Section 1 interactive slide"
    >
      {kind === "slide3" && <SlideThree />}
      {kind === "slide4" && <SlideFour isAdmin={isAdmin} />}
      {kind === "idea-results" && <IdeaResults />}
      {kind === "deployment" && <DeploymentSlide />}
    </div>
  );
}
