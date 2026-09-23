"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./SectionOneHtmlSlide.module.css";

export type SectionOneHtmlKind =
  | "slide3"
  | "slide4"
  | "idea-results"
  | "deployment"
  | "apply-idea"
  | "realtime-dashboard";

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

const DNA_REPLAY_PROMPT = [
  "Tạo Web App demo quản lý nghỉ phép chạy trên Google Apps Script, lưu dữ liệu bằng Google Sheets.",
  "Giao diện responsive, dùng tốt trên desktop và mobile, thiết kế theo design DNA đã tải lên.",
  "Nhân viên nhập họ tên, ngày bắt đầu, ngày kết thúc, lý do nghỉ và gửi đơn.",
  "Hiển thị danh sách đơn nghỉ phép với 3 trạng thái: Chờ duyệt / Đã duyệt / Từ chối.",
  "Quản lý có nút Duyệt hoặc Từ chối ngay trên bảng.",
  "Dashboard hiển thị Tổng đơn, đơn chờ duyệt và đơn đã duyệt.",
  "Ưu tiên code ngắn, dễ hiểu, ít file, dễ deploy."
].join("\n");

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
  const [clearingAll, setClearingAll] = useState(false);

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
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel("eiu:ideas")
      .on("broadcast", { event: "ideas_changed" }, () => void loadIdeas())
      .subscribe();
    const fallbackTimer = window.setInterval(() => void loadIdeas(), 60_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(fallbackTimer);
      if (supabase && channel) void supabase.removeChannel(channel);
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

  async function clearAllIdeas() {
    if (clearingAll || deletingId || items.length === 0) return;
    if (!window.confirm(`Xóa toàn bộ ${items.length} ý tưởng? Thao tác này không thể hoàn tác.`)) return;

    setClearingAll(true);
    setError("");
    try {
      const response = await fetch("/api/ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Không thể xóa toàn bộ ý tưởng.");
      setItems([]);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Không thể xóa toàn bộ ý tưởng.");
    } finally {
      setClearingAll(false);
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
        <div className={styles.resultsActions}>
          <button
            type="button"
            className={styles.clearAllButton}
            onClick={() => void clearAllIdeas()}
            disabled={clearingAll || Boolean(deletingId) || items.length === 0}
            data-interactive="true"
          >
            {clearingAll ? "Đang xóa…" : "Xóa hết"}
          </button>
          <div className={styles.liveStatus}>
            <i />
            {items.length} ý tưởng
            <button type="button" onClick={() => void loadIdeas()} data-interactive="true" aria-label="Tải lại ý tưởng">
              ↻
            </button>
          </div>
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
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(DNA_REPLAY_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const steps = [
    { n: "01", title: "Sao chép Prompt", body: "Dùng lại yêu cầu nghiệp vụ vừa hoàn thiện." },
    { n: "02", title: "Tải Design DNA", body: "Upload design-dna.txt vào Gemini cùng Prompt." },
    { n: "03", title: "Thực hiện lại các bước", body: "Lặp lại quy trình ban đầu với cùng bài toán." },
    { n: "04", title: "So sánh trải nghiệm", body: "Quan sát sự khác biệt về giao diện và tính nhất quán." },
  ];

  return (
    <section className={`${styles.root} ${styles.dnaExperienceSlide}`}>
      <Ambient strong />
      <header className={styles.dnaExperienceHeading}>
        <span>TRẢI NGHIỆM LẦN 2 · DESIGN DNA</span>
        <h1>Thực hiện lại — lần này có Design DNA</h1>
        <p>Giữ nguyên bài toán, thêm Prompt + design-dna.txt rồi lặp lại các bước ban đầu để cảm nhận sự khác biệt.</p>
      </header>

      <div className={styles.dnaExperienceActions} data-interactive="true">
        <button type="button" onClick={() => void copyPrompt()} className={styles.dnaCopyButton}>
          {copied ? "✓ Đã sao chép prompt" : "⧉ Sao chép prompt"}
        </button>
        <a href="/downloads/design-dna.txt" download className={styles.dnaDownloadButton}>
          ↓ Tải DNA design
        </a>
      </div>

      <div className={styles.dnaExperienceSteps}>
        {steps.map((step, index) => (
          <article key={step.n} style={{ "--delay": `${index * 110}ms` } as CSSProperties}>
            <span>{step.n}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.body}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ApplyIdeaSlide() {
  const steps = [
    {
      num: "01",
      badge: "ĐỀ BÀI NGHIỆP VỤ",
      title: "Lấy lại Idea ban đầu",
      desc: "Sử dụng bài toán bạn đã chọn ở đầu buổi (Xin nghỉ phép, Đặt xe, Báo cáo sự cố, Quản lý tài sản...) làm yêu cầu đầu vào.",
      meta: [
        { label: "Đầu vào", value: "Ý tưởng kinh doanh cá nhân" },
        { label: "Mục tiêu", value: "Xác định rõ User & Dữ liệu cần lưu" },
      ],
    },
    {
      num: "02",
      badge: "CHUẨN HÓA VỚI AI",
      title: "Prompt chuẩn + Design DNA",
      desc: "Mô tả 5 yếu tố cốt lõi (Mục tiêu, User, Dữ liệu, Quy trình, Báo cáo) và đính kèm file design-dna.txt để Gemini sinh UI chuẩn EIU.",
      meta: [
        { label: "Prompt", value: "Cấu trúc 5 thành phần chuẩn" },
        { label: "Giao diện", value: "Tải & đính kèm design-dna.txt" },
      ],
    },
    {
      num: "03",
      badge: "TRIỂN KHAI & XUẤT BẢN",
      title: "Deploy Apps Script & Lên bảng",
      desc: "Dán mã nguồn vào Google Apps Script, Deploy với quyền Anyone, lấy link Web App /exec và sẵn sàng chia sẻ lên bảng Showcase.",
      meta: [
        { label: "Triển khai", value: "Who has access: Anyone" },
        { label: "Đầu ra", value: "Đường link Web App /exec" },
      ],
    },
  ];

  return (
    <section className={`${styles.root} ${styles.applyIdeaSlide}`}>
      <Ambient strong />
      <header className={styles.applyIdeaHeading}>
        <div className={styles.applyIdeaKicker}>
          <span>THỰC HÀNH TỰ DO</span>
          <i>EIU · APPLIED AGENTIC AI</i>
        </div>
        <h1>Tự áp dụng với Idea ban đầu của bạn</h1>
        <p>Vận dụng toàn bộ quy trình AI và Design DNA vừa học để hiện thực hóa bài toán kinh doanh của riêng bạn.</p>
      </header>

      <div className={styles.applyIdeaGrid}>
        {steps.map((step, idx) => (
          <article
            key={step.num}
            className={styles.applyIdeaCard}
            style={{ "--delay": `${idx * 110}ms` } as CSSProperties}
          >
            <div className={styles.applyIdeaCardTop}>
              <span className={styles.applyIdeaNumBadge}>{step.num}</span>
              <span className={styles.applyIdeaCategoryBadge}>{step.badge}</span>
            </div>
            <h3 className={styles.applyIdeaTitle}>{step.title}</h3>
            <p className={styles.applyIdeaDesc}>{step.desc}</p>
            <div className={styles.applyIdeaMetaList}>
              {step.meta.map((m) => (
                <div key={m.label} className={styles.applyIdeaMetaRow}>
                  <span className={styles.applyIdeaMetaLabel}>{m.label}:</span>
                  <strong className={styles.applyIdeaMetaVal}>{m.value}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className={styles.applyIdeaFooter}>
        <div className={styles.applyIdeaBanner}>
          <span className={styles.applyIdeaBannerTag}>SẴN SÀNG CHO SHOWCASE</span>
          <span className={styles.applyIdeaBannerText}>
            Sau khi hoàn thiện Web App, lấy URL kết thúc bằng <code>/exec</code> và chuyển sang slide tiếp theo để đưa bài làm của bạn lên bảng chia sẻ chung!
          </span>
        </div>
      </div>
    </section>
  );
}

const SALES_DASHBOARD_PROMPT = `Tôi có một Google Sheet chứa dữ liệu bán hàng trong sheet "Sales" với các cột:

- Date: ngày bán hàng
- Product: tên sản phẩm
- Department: phòng ban
- Amount: doanh thu

Hãy tạo cho tôi một Google Apps Script Web App Dashboard chỉ sử dụng 2 file:

1. Code.gs
2. Index.html

Không tạo thêm file khác.

Yêu cầu:

1. Code.gs:
- Kết nối với Google Sheet hiện tại bằng SpreadsheetApp.getActiveSpreadsheet()
- Đọc dữ liệu từ sheet "Sales"
- Trả dữ liệu sang giao diện bằng google.script.run
- Tự động xử lý dữ liệu:
  + Tổng doanh thu
  + Tổng số đơn hàng
  + Doanh thu trung bình
  + Sản phẩm bán nhiều nhất theo doanh thu
  + Phòng ban có doanh thu cao nhất
  + Doanh thu theo từng tháng
  + Doanh thu theo phòng ban
- Viết code đơn giản, dễ hiểu, có chú thích từng phần.

2. Index.html:
Tạo giao diện Dashboard hiện đại, responsive.

Bố cục:

Phần trên:
- Tiêu đề: "Sales Dashboard 2025"

Khu vực KPI Card:
- Tổng doanh thu
- Số đơn hàng
- Doanh thu trung bình
- Top sản phẩm

Biểu đồ:
- Biểu đồ đường (Line Chart):
  Doanh thu theo tháng

- Biểu đồ cột (Bar Chart):
  Doanh thu theo phòng ban

- Biểu đồ tròn (Pie Chart):
  Tỷ trọng doanh thu theo phòng ban

Bảng dữ liệu:
- Hiển thị danh sách sản phẩm
- Có tìm kiếm theo tên sản phẩm

Yêu cầu kỹ thuật:
- Sử dụng HTML + CSS + JavaScript trong cùng file Index.html
- Sử dụng Google Charts hoặc thư viện miễn phí qua CDN
- Không dùng framework phức tạp
- Không dùng Firebase hoặc database ngoài
- Không tạo file JSON
- Giao diện đẹp, màu sắc hiện đại giống dashboard doanh nghiệp
- Có loading khi đang lấy dữ liệu
- Code hoàn chỉnh có thể copy trực tiếp vào Apps Script và Deploy thành Web App

Hãy trả về đầy đủ:
1. Code.gs
2. Index.html

Chỉ tập trung vào dashboard bán hàng, không thêm chức năng đăng nhập hoặc phân quyền.`;

function RealtimeDashboardSlide() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(SALES_DASHBOARD_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`${styles.root} ${styles.realtimeDashboardSlide}`}>
      <Ambient strong />
      <header className={styles.dashboardHeader}>
        <div className={styles.dashboardKicker}>
          <span>DEMO MỞ RỘNG</span>
          <i>EIU · APPLIED AGENTIC AI</i>
        </div>
        <h1>Demo dashboard thay đổi theo dữ liệu real time</h1>
        <p>Kết nối Google Sheets với Web App Dashboard tương tác đa chiều, tự động cập nhật biểu đồ và chỉ số KPI theo dữ liệu bán hàng thời gian thực.</p>
      </header>

      {/* 2 PROMINENT BUTTONS BAR */}
      <div className={styles.prominentActionBar}>
        <a
          href="/downloads/Sales-Data-2025.xlsx"
          download="Sales-Data-2025.xlsx"
          className={styles.actionBtnDownload}
        >
          <span className={styles.actionBtnIcon}>↓</span>
          <span>Tải Sale data (.xlsx)</span>
        </a>

        <button
          type="button"
          onClick={() => void copyPrompt()}
          className={`${styles.actionBtnCopy} ${copied ? styles.actionBtnCopied : ""}`}
        >
          <span className={styles.actionBtnIcon}>{copied ? "✓" : "⧉"}</span>
          <span>{copied ? "Đã sao chép prompt!" : "Copy prompt"}</span>
        </button>
      </div>

      {/* CONTENT GRID */}
      <div className={styles.dashboardContentGrid}>
        {/* LEFT: ARCHITECTURE & SPECS */}
        <div className={styles.dashboardLeftCol}>
          <div className={styles.dashboardSpecCard}>
            <div className={styles.dashboardCardHeader}>
              <span className={styles.specBadge}>DỮ LIỆU NGUỒN</span>
              <h4>Sheet &quot;Sales&quot; · 50 dòng</h4>
            </div>
            <div className={styles.dataColumnsList}>
              <div className={styles.colTag}><code>Date</code> Ngày bán</div>
              <div className={styles.colTag}><code>Product</code> Tên SP</div>
              <div className={styles.colTag}><code>Department</code> Phòng ban</div>
              <div className={styles.colTag}><code>Amount</code> Doanh thu</div>
            </div>
          </div>

          <div className={styles.dashboardSpecCard}>
            <div className={styles.dashboardCardHeader}>
              <span className={styles.specBadge}>KIẾN TRÚC 2 FILE</span>
              <h4>Google Apps Script</h4>
            </div>
            <ul className={styles.fileListCompact}>
              <li>
                <strong>1. Code.gs:</strong> <code>getActiveSpreadsheet()</code> đọc Sheet &quot;Sales&quot;, tính KPI, doanh thu theo tháng và phòng ban.
              </li>
              <li>
                <strong>2. Index.html:</strong> Giao diện Sales Dashboard 2025, Google Charts (Line, Bar, Pie) và bảng tìm kiếm sản phẩm.
              </li>
            </ul>
          </div>

          {/* FLOATING DEMO LINKS */}
          <div className={styles.demoDock} data-interactive="true">
            <a
              href="https://docs.google.com/spreadsheets/d/1j44K3vgiSHrIjPA5l6vYtJ6LzIqzVQok3oLzpWwwGgQ/edit?gid=1319602846#gid=1319602846"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.demoLink} ${styles.demoLinkSheets}`}
            >
              <svg className={styles.demoLinkLogo} viewBox="0 0 48 48" aria-hidden="true"><path fill="#43a047" d="M37 45H11a4 4 0 01-4-4V7a4 4 0 014-4h17.586a2 2 0 011.414.586L39.414 13A2 2 0 0140 14.414V41a4 4 0 01-3 3.874V45z"/><path fill="#c8e6c9" d="M40 14.414V15H30.5a1.5 1.5 0 01-1.5-1.5V4h.586a2 2 0 011.414.586L39.414 13A2 2 0 0140 14.414z"/><path fill="#fff" d="M30 22H18v14h12V22zm-8 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2v-2h2v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4v-2h4v2z"/></svg>
              <span>Spreadsheet dữ liệu</span>
            </a>
            <a
              href="https://script.google.com/macros/s/AKfycbz43PTfDZrLjIPF9ozsvOxfHdsvyWie2wD7984Fwtbz1xS-Q0a33J94loSFjcAltLGd/exec"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.demoLink} ${styles.demoLinkAppsScript}`}
            >
              <Image
                src="/branding/apps/google-apps-script.svg"
                alt=""
                width={22}
                height={22}
                className={styles.demoLinkLogo}
              />
              <span>Web App</span>
            </a>
          </div>
        </div>

        {/* RIGHT: PROMPT PREVIEW CARD */}
        <div className={styles.dashboardRightCol}>
          <div className={styles.promptPreviewCard}>
            <div className={styles.promptPreviewHeader}>
              <div className={styles.promptHeaderTitle}>
                <span className={styles.promptDot} />
                <strong>Prompt mẫu gửi Gemini</strong>
              </div>
              <span className={styles.promptWordCount}>50 dòng dữ liệu · Google Charts CDN</span>
            </div>
            <div className={styles.promptScrollBox}>
              <pre>{SALES_DASHBOARD_PROMPT}</pre>
            </div>
          </div>
        </div>
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
      {kind === "apply-idea" && <ApplyIdeaSlide />}
      {kind === "realtime-dashboard" && <RealtimeDashboardSlide />}
    </div>
  );
}
