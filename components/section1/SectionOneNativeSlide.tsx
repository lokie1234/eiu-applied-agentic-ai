"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./SectionOneNativeSlide.module.css";

type Props = {
  page: number;
  scale: number;
};

type Card = {
  title: string;
  body?: string;
  meta?: string;
};


const OUTCOMES = [
  "Tạo Web App bằng Gemini",
  "Quy trình triển khai lên Google Apps Script",
  "Google Sheets làm Database",
  "Chia sẻ ứng dụng cho cả công ty",
  "Google Drive lưu trữ file",
  "Tạo Gems để tái sử dụng",
];

const IDEAS = [
  "Xin nghỉ phép",
  "Báo cáo sự cố",
  "Đặt xe",
  "Quản lý chấm công",
  "Phê duyệt nội dung",
  "Đánh giá thử việc",
  "Theo dõi công việc",
  "Báo cáo kết quả",
  "Đăng ký môn học",
];

const IDEA_WORKFLOWS: Record<string, string[]> = {
  "Xin nghỉ phép": ["Nhân viên gửi đơn", "Quản lý phê duyệt", "Cập nhật trạng thái", "Xem dashboard"],
  "Báo cáo sự cố": ["Nhân viên báo sự cố", "Quản lý duyệt", "Bộ phận an toàn xử lý", "Đóng sự cố"],
  "Đặt xe": ["Nhân viên tạo yêu cầu", "Bộ phận xe xác nhận", "Sắp lịch xe", "Theo dõi hoàn tất"],
  "Quản lý chấm công": ["Nhân viên nhập công", "Tổ trưởng kiểm tra", "HR tổng hợp", "Xuất báo cáo"],
  "Phê duyệt nội dung": ["Tạo nội dung", "Quản lý duyệt", "Chỉnh sửa nếu cần", "Xuất bản"],
  "Đánh giá thử việc": ["Nhân viên tự đánh giá", "Quản lý nhận xét", "Phòng nhân sự tổng hợp", "Ra quyết định"],
  "Theo dõi công việc": ["Giao việc", "Cập nhật tiến độ", "Kiểm tra trạng thái", "Báo cáo kết quả"],
  "Báo cáo kết quả": ["Nhập số liệu", "Tổng hợp tự động", "Kiểm tra dữ liệu", "Trình lãnh đạo"],
  "Đăng ký môn học": ["Sinh viên đăng ký", "Phòng đào tạo kiểm tra", "Chốt danh sách", "Xuất lịch học"],
};

const SOFTWARE_STAGES = [
  "Vấn đề doanh nghiệp",
  "Phân tích yêu cầu",
  "Thiết kế",
  "Phát triển",
  "Kiểm thử",
  "Triển khai",
  "Thu thập phản hồi",
  "Cải tiến",
] as const;

const ARCHITECTURE_CONTENT = {
  Frontend: {
    meta: "Giao diện · Trải nghiệm",
    explain: "Phần người dùng nhìn thấy và thao tác trực tiếp: form, nút bấm, bảng dữ liệu, dashboard.",
    example: "Ví dụ: Form xin nghỉ, màn hình quản lý, nút Duyệt / Từ chối.",
  },
  "Business Logic": {
    meta: "Quy tắc xử lý",
    explain: "Nơi quyết định hệ thống sẽ làm gì với dữ liệu người dùng nhập vào, theo đúng quy trình nghiệp vụ.",
    example: "Ví dụ: kiểm tra trường bắt buộc, tự tính trạng thái, chuyển yêu cầu tới quản lý.",
  },
  Database: {
    meta: "Lưu trữ dữ liệu",
    explain: "Nơi cất giữ dữ liệu đầu vào, lịch sử xử lý và thông tin cần dùng lại về sau.",
    example: "Ví dụ: Google Sheets lưu đơn, trạng thái, thời gian, người gửi.",
  },
  Integrations: {
    meta: "Kết nối công cụ khác",
    explain: "Kết nối với những dịch vụ bên ngoài để ứng dụng hoạt động trọn quy trình.",
    example: "Ví dụ: Gmail để thông báo, Drive để lưu file, QR Code để truy cập nhanh.",
  },
} as const;

type ArchitectureKey = keyof typeof ARCHITECTURE_CONTENT;

const RESTAURANT_MAP = [
  { title: "Frontend", answer: "Nhân viên nhận order" },
  { title: "Business Logic", answer: "Bếp nấu ăn" },
  { title: "Database", answer: "Kho nguyên liệu" },
  { title: "Integrations", answer: "GrabFood" },
];

const BUSINESS_MAP = [
  { title: "Frontend", answer: "Form xin nghỉ" },
  { title: "Business Logic", answer: "Kiểm tra phép · Gửi duyệt" },
  { title: "Database", answer: "Google Sheets" },
  { title: "Integrations", answer: "Gmail · Google Drive" },
];

const PROMPT_LINES = [
  "Tạo Web App demo quản lý nghỉ phép chạy trên Google Apps Script (chỉ cần 2 file code.gs và Index.html), lưu dữ liệu bằng Google Sheets",
  "Giao diện đơn giản, responsive, dùng tốt trên desktop và mobile",
  "Nhân viên nhập: Họ tên, ngày bắt đầu, ngày kết thúc, lý do nghỉ và gửi đơn.",
  "Hiển thị danh sách tất cả đơn nghỉ phép trong một bảng.",
  "Mỗi đơn chỉ có 3 trạng thái: Chờ duyệt / Đã duyệt / Từ chối.",
  "Quản lý có nút Duyệt hoặc Từ chối ngay trên bảng.",
  "Dashboard chỉ hiển thị: Tổng đơn, đơn chờ duyệt, đơn đã duyệt.",
  "Chỉ dùng 1 Google Sheet: Quản lý nghỉ phép để giảm tối đa code và cấu hình.",
  "Không cần đăng nhập, phân quyền, số dư phép, email, lịch nghỉ hoặc chức năng nâng cao.",
  "Ưu tiên code ngắn, dễ hiểu, ít file, dễ deploy",
];

const PROMPT_DNA_LINES = [
  PROMPT_LINES[0],
  "Giao diện đơn giản, responsive, dùng tốt trên desktop và mobile (chỉ cần 2 file code.gs và Index.html), thiết kế theo design DNA đã tải lên",
  ...PROMPT_LINES.slice(2),
];

function Ambient() {
  return (
    <div className={styles.ambient} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.glowA} />
      <div className={styles.glowB} />
      <svg viewBox="0 0 960 540" preserveAspectRatio="none">
        <path className={styles.traceOne} d="M-60 438 C155 322 279 470 476 303 C630 174 786 246 1020 76" />
        <path className={styles.traceTwo} d="M-40 126 C160 46 252 184 420 118 C622 40 760 178 1010 124" />
      </svg>
      <i className={styles.nodeA} />
      <i className={styles.nodeB} />
      <i className={styles.nodeC} />
    </div>
  );
}

function Shell({ title, eyebrow, children, className = "" }: { title?: ReactNode; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${styles.root} ${className}`}>
      <Ambient />
      {title && (
        <header className={styles.heading}>
          {eyebrow !== "" && <span><i />{eyebrow ?? "EIU · APPLIED AGENTIC AI"}</span>}
          <h1>{title}</h1>
        </header>
      )}
      <div className={styles.content}>{children}</div>
    </section>
  );
}

function NumberedCards({ items }: { items: Card[] }) {
  return (
    <div className={styles.numberedCards}>
      {items.map((item, index) => (
        <article key={item.title} style={{ "--delay": `${index * 85}ms` } as CSSProperties}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{item.title}</h3>
            {item.body && <p>{item.body}</p>}
            {item.meta && <small>{item.meta}</small>}
          </div>
        </article>
      ))}
    </div>
  );
}

function Checklist({ items, twoColumns = false }: { items: string[]; twoColumns?: boolean }) {
  return (
    <div className={`${styles.checklist} ${twoColumns ? styles.twoColumns : ""}`}>
      {items.map((item, index) => (
        <div key={item} style={{ "--delay": `${index * 95}ms` } as CSSProperties}>
          <span>✓</span><strong>{item}</strong>
        </div>
      ))}
    </div>
  );
}

function Flow({
  items,
  compact = false,
  singleRow = false,
  inline = false,
  testLayout = false,
}: {
  items: string[];
  compact?: boolean;
  singleRow?: boolean;
  inline?: boolean;
  testLayout?: boolean;
}) {
  const testFlex = [1.34, .82, .98, .78, 1.08];
  const testWidths = [196, 124, 135, 118, 158];

  return (
    <div className={`${styles.flow} ${compact ? styles.flowCompact : ""} ${singleRow ? styles.flowSingleRow : ""} ${inline ? styles.flowInline : ""}`}>
      {items.map((item, index) => (
        <div className={styles.flowStep} key={`${item}-${index}`} style={{ "--delay": `${index * 100}ms`, ...(testLayout ? { flex: testFlex[index] } : {}) } as CSSProperties}>
          <div style={testLayout ? { width: testWidths[index] } : undefined}><span>{index + 1}</span><strong>{item}</strong></div>
          {index < items.length - 1 && <i>→</i>}
        </div>
      ))}
    </div>
  );
}

function TieredFlow({ items }: { items: string[] }) {
  const firstRow = items.slice(0, 2);
  const secondRow = items.slice(2);

  function renderRow(row: string[], offset: number) {
    return row.map((item, index) => (
      <div className={styles.tieredStep} key={`${item}-${offset + index}`} style={{ "--delay": `${(offset + index) * 90}ms` } as CSSProperties}>
        <div><span>{offset + index + 1}</span><strong>{item}</strong></div>
        {index < row.length - 1 && <i aria-hidden="true">→</i>}
      </div>
    ));
  }

  return (
    <div className={styles.tieredFlow}>
      <div className={styles.tieredRow}>{renderRow(firstRow, 0)}</div>
      <div className={styles.tieredDown} aria-hidden="true"><span>↓</span></div>
      <div className={`${styles.tieredRow} ${styles.tieredRowWide}`}>{renderRow(secondRow, 2)}</div>
    </div>
  );
}

function PromptPanel({
  dna = false,
  showCopy = false,
  showDnaDownload = false,
}: {
  dna?: boolean;
  showCopy?: boolean;
  showDnaDownload?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const lines = dna ? PROMPT_DNA_LINES : PROMPT_LINES;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`${styles.promptExperience} ${(showCopy || showDnaDownload) ? styles.promptExperienceWithActions : ""}`}>
      <div className={styles.promptPanel}>
        <div className={styles.quoteMark}>“</div>
        <div className={styles.promptCopy}>
          <p className={styles.promptLead}>{lines[0]}</p>
          {dna ? (
            <div className={styles.promptDnaHighlightBox}>
              <span className={styles.promptDnaBadge}>✦ DESIGN DNA HIGHLIGHT</span>
              <p className={styles.promptDnaText}>
                Giao diện đơn giản, responsive, dùng tốt trên desktop và mobile,{" "}
                <strong className={styles.promptDnaKeyword}>thiết kế theo design DNA đã tải lên</strong>
              </p>
            </div>
          ) : (
            <p>{lines[1]}</p>
          )}
          <ul>
            {lines.slice(2, 7).map((line) => <li key={line}>{line}</li>)}
          </ul>
          {lines.slice(7).map((line) => <p key={line}>{line}</p>)}
        </div>
        <div className={styles.promptPulse} aria-hidden="true" />
      </div>
      {(showCopy || showDnaDownload) && (
        <div className={styles.promptActions} data-interactive="true">
          {showDnaDownload && (
            <a href="/downloads/design-dna.txt" download className={styles.promptActionSecondary}>
              ↓ Tải DNA design
            </a>
          )}
          {showCopy && (
            <button type="button" onClick={() => void copyPrompt()} className={styles.promptActionPrimary}>
              {copied ? "✓ Đã sao chép" : "⧉ Sao chép prompt"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CenteredTiles({ items, columns = 3 }: { items: string[]; columns?: 2 | 3 }) {
  return (
    <div className={`${styles.centeredTiles} ${columns === 2 ? styles.centeredTilesTwo : ""}`}>
      {items.map((item, index) => (
        <article key={item} style={{ "--delay": `${index * 85}ms` } as CSSProperties}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item}</strong>
        </article>
      ))}
    </div>
  );
}

type AppIconName = "drive" | "sheets" | "apps-script" | "gemini" | "google";

const APP_ICON_PATHS: Record<AppIconName, string> = {
  drive: "/branding/apps/google-drive.svg",
  sheets: "/branding/apps/google-sheets.svg",
  "apps-script": "/branding/apps/google-apps-script.svg",
  gemini: "/branding/apps/google-gemini.svg",
  google: "/branding/apps/google-g.svg",
};

function AppIcon({ app, label }: { app: AppIconName; label: string }) {
  return (
    <span className={styles.appIcon}>
      <Image src={APP_ICON_PATHS[app]} alt={label} width={24} height={24} />
    </span>
  );
}

function MockWindow({ title, children, accent = "navy", icon }: { title: string; children: ReactNode; accent?: "navy" | "green" | "gold"; icon?: ReactNode }) {
  return (
    <article className={`${styles.mockWindow} ${styles[`mock_${accent}`]}`}>
      <div className={styles.mockTop}>
        <span className={styles.mockTraffic} /><span className={styles.mockTraffic} /><span className={styles.mockTraffic} />
        <div className={styles.mockTitle}>{icon}<strong>{title}</strong></div>
      </div>
      <div className={styles.mockBody}>{children}</div>
    </article>
  );
}

function PopupModal({
  title,
  onClose,
  children,
  tone = "default",
  showEyebrow = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  tone?: "default" | "success" | "warning";
  showEyebrow?: boolean;
}) {
  return (
    <div className={styles.modalOverlay} data-interactive="true">
      <div className={`${styles.modalCard} ${tone === "success" ? styles.modalSuccess : tone === "warning" ? styles.modalWarning : ""}`}>
        <div className={styles.modalHeader}>
          <div>
            {showEyebrow && <span className={styles.modalEyebrow}>EIU DNA POP-UP</span>}
            <h3>{title}</h3>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose} data-interactive="true">Đóng</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function RevealAnswerGrid({ items, revealed, onReveal }: { items: { title: string; answer: string }[]; revealed: boolean[]; onReveal: (index: number) => void }) {
  return (
    <div className={styles.answerGrid}>
      {items.map((item, index) => (
        <article key={item.title} className={revealed[index] ? styles.answerCardRevealed : ""} style={{ "--delay": `${index * 100}ms` } as CSSProperties}>
          <div className={styles.answerHeader}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{item.title}</h3>
          </div>
          <div className={styles.answerSlot}>
            <p className={revealed[index] ? styles.answerVisible : styles.answerHidden}>{item.answer}</p>
            <button
              type="button"
              className={`${styles.answerCover} ${revealed[index] ? styles.answerCoverHidden : ""}`}
              onClick={() => onReveal(index)}
              data-interactive="true"
              aria-hidden={revealed[index]}
              tabIndex={revealed[index] ? -1 : 0}
            >
              Bấm để hiện câu trả lời
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function NativeSlides({ page }: { page: number }) {
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [selectedArchitecture, setSelectedArchitecture] = useState<ArchitectureKey>("Frontend");
  const [restaurantRevealed, setRestaurantRevealed] = useState([false, false, false, false]);
  const [businessRevealed, setBusinessRevealed] = useState([false, false, false, false]);
  const [revealedStageCount, setRevealedStageCount] = useState(0);
  const [isRevealingStages, setIsRevealingStages] = useState(false);

  function revealRestaurant(index: number) {
    setRestaurantRevealed((current) => current.map((item, itemIndex) => (itemIndex === index ? true : item)));
  }

  function revealBusiness(index: number) {
    setBusinessRevealed((current) => current.map((item, itemIndex) => (itemIndex === index ? true : item)));
  }

  useEffect(() => {
    if (!isRevealingStages || revealedStageCount >= SOFTWARE_STAGES.length) return;

    const timer = window.setTimeout(() => {
      const next = Math.min(revealedStageCount + 1, SOFTWARE_STAGES.length);
      setRevealedStageCount(next);
      if (next === SOFTWARE_STAGES.length) setIsRevealingStages(false);
    }, revealedStageCount === 0 ? 120 : 320);

    return () => window.clearTimeout(timer);
  }, [isRevealingStages, revealedStageCount]);

  function renderPage() {
    switch (page) {
      case 1:
        return (
          <Shell className={styles.heroSlide}>
            <div className={styles.heroCopy}>
              <span className={styles.heroKicker}>EIU · APPLIED AGENTIC AI</span>
              <h1>Applied Agentic AI<br /><em>for Business</em></h1>
              <h2>Xây dựng Business Web Apps với AI</h2>
              <p>Khóa học thực hành 6 giờ · Từ ý tưởng → Web App hoàn chỉnh bằng AI</p>
            </div>
            <div className={styles.heroCore} aria-hidden="true">
              <span>AI</span>
              <i />
              <i />
            </div>
            <div className={styles.heroLight} aria-hidden="true" />
          </Shell>
        );
      case 2:
        return (
          <Shell title="Sau khóa học bạn sẽ làm được" eyebrow="KẾT QUẢ ĐẦU RA">
            <div className={styles.outcomesGrid}>
              {OUTCOMES.map((item, index) => (
                <div key={item} style={{ "--delay": `${index * 85}ms` } as CSSProperties}>
                  <span>✓</span><strong>{item}</strong>
                </div>
              ))}
            </div>
          </Shell>
        );
      case 5:
        return (
          <Shell title="Một vài ý tưởng" eyebrow="BẮT ĐẦU TỪ NHU CẦU">
            <div className={styles.ideaGrid}>
              {IDEAS.map((idea, index) => (
                <button
                  type="button"
                  key={idea}
                  className={styles.ideaCard}
                  style={{ "--delay": `${index * 60}ms` } as CSSProperties}
                  onClick={() => setSelectedIdea(idea)}
                  data-interactive="true"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{idea}</strong>
                  <i>↗</i>
                </button>
              ))}
            </div>
          </Shell>
        );
      case 6:
        return (
          <Shell eyebrow="AI TRONG PHÁT TRIỂN PHẦN MỀM">
            <div className={styles.statementHero}>
              <span>01</span>
              <h1>Ngày nay AI không chỉ viết code.</h1>
              <p>AI có thể tham gia gần như toàn bộ vòng đời phát triển phần mềm.</p>
              <div className={styles.statementImpact} aria-hidden="true"><i /><i /><i /></div>
            </div>
          </Shell>
        );
      case 7:
        return (
          <Shell title="Quy trình phát triển phần mềm" eyebrow="8 BƯỚC TỪ VẤN ĐỀ ĐẾN CẢI TIẾN">
            <div className={styles.lifecycleRevealExercise}>
              <div className={styles.lifecycleRevealControls}>
                <button
                  type="button"
                  className={styles.lifecycleRevealButton}
                  onClick={() => setIsRevealingStages(true)}
                  disabled={isRevealingStages || revealedStageCount === SOFTWARE_STAGES.length}
                  data-interactive="true"
                  aria-live="polite"
                >
                  {revealedStageCount === SOFTWARE_STAGES.length
                    ? "Đã hiện đầy đủ 8 bước"
                    : isRevealingStages
                      ? `Đang hiển thị ${revealedStageCount}/8`
                      : "Hiển thị 8 bước"}
                </button>
              </div>

              <div className={styles.lifecycleRevealTimeline} aria-label="8 bước của quy trình phát triển phần mềm">
                {SOFTWARE_STAGES.map((stage, index) => {
                  const isRevealed = index < revealedStageCount;

                  return (
                    <article
                      key={stage}
                      className={`${styles.lifecycleRevealCard} ${isRevealed ? styles.lifecycleRevealCardVisible : ""}`}
                    >
                      <span>{index + 1}</span>
                      <strong aria-hidden={!isRevealed}>{stage}</strong>
                    </article>
                  );
                })}
              </div>
            </div>
          </Shell>
        );
      case 8:
        return (
          <Shell title="Vai trò của con người" eyebrow="HUMAN IN THE LOOP">
            <div className={styles.humanLayout}>
              <div className={styles.humanStatement}>Không còn là người viết code - mà là:</div>
              <NumberedCards items={[
                { title: "Hiểu nghiệp vụ" },
                { title: "Mô tả yêu cầu" },
                { title: "Kiểm thử" },
                { title: "Ra quyết định" },
              ]} />
            </div>
          </Shell>
        );
      case 9: {
        const details = ARCHITECTURE_CONTENT[selectedArchitecture];
        return (
          <Shell title="Một phần mềm gồm những gì?" eyebrow="KIẾN TRÚC CƠ BẢN">
            <div className={styles.architectureLayout}>
              <div className={styles.archGrid}>
                {(Object.keys(ARCHITECTURE_CONTENT) as ArchitectureKey[]).map((title, index) => (
                  <button
                    type="button"
                    key={title}
                    className={`${styles.archCard} ${selectedArchitecture === title ? styles.archCardActive : ""}`}
                    style={{ "--delay": `${index * 100}ms` } as CSSProperties}
                    onClick={() => setSelectedArchitecture(title)}
                    data-interactive="true"
                  >
                    <span>{index + 1}</span>
                    <strong>{title}</strong>
                    <small>Bấm để xem giải thích</small>
                  </button>
                ))}
              </div>

              <div className={styles.archExplainPanel}>
                <div className={styles.archExplainTop}>
                  <small>{details.meta}</small>
                  <h3>{selectedArchitecture}</h3>
                </div>
                <p>{details.explain}</p>
                <div className={styles.archExample}>{details.example}</div>
              </div>
            </div>
          </Shell>
        );
      }
      case 10:
        return (
          <Shell title="Ví dụ dễ hiểu — Một nhà hàng" eyebrow="" className={styles.noEyebrow}>
            <RevealAnswerGrid items={RESTAURANT_MAP} revealed={restaurantRevealed} onReveal={revealRestaurant} />
          </Shell>
        );
      case 11:
        return (
          <Shell title="Ví dụ cụ thể" eyebrow="" className={styles.noEyebrow}>
            <RevealAnswerGrid items={BUSINESS_MAP} revealed={businessRevealed} onReveal={revealBusiness} />
          </Shell>
        );
      case 12:
        return (
          <Shell className={styles.labHero}>
            <div className={styles.labPulse} aria-hidden="true" />
            <div className={styles.labHeroInner}>
              <div className={styles.labBadge}>LAB 1</div>
              <h1>Phần mềm quản lý xin nghỉ phép</h1>
              <div className={styles.labFeatureRow}>
                <span>Web App hoàn chỉnh</span>
                <span>Chạy trên Google Script</span>
                <span>Không cần Server</span>
                <span>Không cần Hosting</span>
              </div>
            </div>
            <div className={styles.labWave} aria-hidden="true" />
          </Shell>
        );
      case 13:
        return (
          <Shell title="Quy trình cơ bản" eyebrow="LAB 1 · FLOW" className={styles.flowImpactSlide}>
            <Flow items={["Gemini", "Google Sheets", "Google App Script", "Business Web App"]} singleRow />
          </Shell>
        );
      case 15:
        return (
          <Shell title="Bước 2 - Google Drive" eyebrow="CHUẨN BỊ THƯ MỤC LÀM VIỆC" className={styles.realisticAppSlide}>
            <div className={`${styles.setupLayout} ${styles.driveExampleLayout}`}>
              <MockWindow title="Google Drive" icon={<AppIcon app="drive" label="Google Drive" />}>
                <div className={styles.driveWorkspace}>
                  <aside>
                    <b>＋ New</b>
                    <span>▱ My Drive</span>
                    <span>⌁ Shared with me</span>
                    <span>☆ Starred</span>
                  </aside>
                  <section>
                    <div className={styles.driveBreadcrumb}>My Drive <span>›</span> Applied Agentic AI</div>
                    <div className={styles.driveFolderPreview}><i>▰</i><div><strong>Applied Agentic AI</strong><small>Folder · Just now</small></div></div>
                    <div className={styles.driveMenu}><b>＋ New</b><span>New folder</span><span>File upload</span><span>Folder upload</span></div>
                  </section>
                </div>
              </MockWindow>
              <div className={styles.setupArrow}>→</div>
              <MockWindow title="New folder" accent="gold" icon={<AppIcon app="drive" label="Google Drive" />}>
                <div className={styles.folderDialog}>
                  <span className={styles.dialogLabel}>CREATE A FOLDER</span>
                  <label>Folder name</label>
                  <div className={styles.inputMock}>Applied Agentic AI</div>
                  <div className={styles.dialogActions}><span>Cancel</span><button>Create</button></div>
                </div>
              </MockWindow>
            </div>
            <div className={styles.instructionNote}><strong>Tạo folder tên: Applied Agentic AI</strong><span>Tất cả tài liệu sẽ được lưu trong thư mục này</span></div>
          </Shell>
        );
      case 16:
        return (
          <Shell title="Bước 3 - Google Sheets" eyebrow="TẠO DATABASE" className={styles.realisticAppSlide}>
            <div className={`${styles.threeStepMock} ${styles.sheetsExampleFlow}`}>
              <MockWindow title="Applied Agentic AI" icon={<AppIcon app="drive" label="Google Drive" />}>
                <div className={styles.driveMiniToolbar}><b>＋ New</b><span>▦</span><span>☷</span></div>
                <span className={styles.pathMock}>My Drive › Applied Agentic AI</span>
                <div className={styles.driveEmptyState}><i>▰</i><span>Thư mục làm việc</span></div>
              </MockWindow>
              <MockWindow title="Google Sheets" accent="green" icon={<AppIcon app="sheets" label="Google Sheets" />}>
                <div className={styles.sheetCreateCard}><AppIcon app="sheets" label="Google Sheets" /><strong>Blank spreadsheet</strong><span>→ Google Sheets</span></div>
              </MockWindow>
              <MockWindow title="Quản lý nghỉ phép" accent="green" icon={<AppIcon app="sheets" label="Google Sheets" />}>
                <div className={styles.sheetToolbar}><span>File</span><span>Edit</span><span>View</span><span>Insert</span><b>Share</b></div>
                <div className={styles.sheetNameField}>Quản lý nghỉ phép</div>
                <div className={styles.sheetGridMock}>
                  <span>Họ tên</span><span>Ngày bắt đầu</span><span>Trạng thái</span>
                </div>
              </MockWindow>
            </div>
          </Shell>
        );
      case 17:
        return (
          <Shell title="Gemini sẽ làm gì?" eyebrow="AI COPILOT">
            <div className={styles.geminiRole}>
              <Checklist items={["Thiết kế giao diện", "Viết Business Logic", "Hướng dẫn triển khai"]} />
              <div className={styles.youOnly}><span>Bạn chỉ cần</span><strong>mô tả yêu cầu</strong></div>
            </div>
          </Shell>
        );
      case 18:
        return (
          <Shell eyebrow="NGUYÊN TẮC CỐT LÕI">
            <div className={styles.warningHero}><span>!</span><h1>AI KHÔNG ĐỌC ĐƯỢC SUY NGHĨ</h1><p>Muốn AI làm đúng → phải mô tả đúng.</p><strong>Garbage In → Garbage Out</strong></div>
          </Shell>
        );
      case 19:
        return (
          <Shell eyebrow="BƯỚC ĐẦU TIÊN">
            <div className={styles.businessFirst}><span>01</span><h1>Không phải Code.<br />Không phải Prompt.</h1><p>Mà là <strong>yêu cầu nghiệp vụ.</strong></p></div>
          </Shell>
        );
      case 20:
        return (
          <Shell title="Ví dụ" eyebrow="YÊU CẦU NGHIỆP VỤ">
            <div className={styles.requirementExample}><h2>Hệ thống cần:</h2><Checklist twoColumns items={["Họ tên", "Phòng ban", "Loại nghỉ phép", "Ngày bắt đầu", "Ngày kết thúc", "Lý do", "Người duyệt"]} /></div>
          </Shell>
        );
      case 21:
        return (
          <Shell title="Hãy suy nghĩ như một người phân tích dữ liệu!" eyebrow="HÃY TỰ HỎI">
            <div className={styles.questionGrid}>{["Ai sử dụng?", "Nhập dữ liệu gì?", "Ai phê duyệt?", "Báo cáo cần xem gì?"].map((q, i) => <article key={q} style={{ "--delay": `${i * 110}ms` } as CSSProperties}><span>?</span><strong>{q}</strong></article>)}</div>
          </Shell>
        );
      case 22:
        return (
          <Shell title="Chuyển yêu cầu thành Prompt" eyebrow="TỪ BUSINESS ĐẾN WEB APP" className={styles.softMotionSlide}>
            <Flow items={["Yêu cầu", "Prompt", "Gemini", "Web app"]} singleRow inline />
          </Shell>
        );
      case 23:
        return (
          <Shell title="Prompt tốt cần có" eyebrow="PROMPT CHECKLIST" className={`${styles.softMotionSlide} ${styles.promptChecklistSlide}`}>
            <CenteredTiles items={["Mục tiêu", "Người dùng", "Dữ liệu cần nhập", "Quy trình", "Báo cáo", "Công nghệ yêu cầu"]} />
          </Shell>
        );
      case 24:
        return (
          <Shell title="Ví dụ Prompt" eyebrow="PROMPT THỰC HÀNH" className={styles.softMotionSlide}>
            <PromptPanel showCopy />
          </Shell>
        );
      case 25:
        return (
          <Shell title="Bước 3 - Apps Script" eyebrow="MỞ TRÌNH SOẠN THẢO" className={styles.realisticAppSlide}>
            <div className={`${styles.appScriptLayout} ${styles.appsScriptExampleLayout}`}>
              <MockWindow title="Quản lý nghỉ phép" accent="green" icon={<AppIcon app="sheets" label="Google Sheets" />}>
                <div className={styles.sheetToolbar}><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Data</span><b>Extensions</b></div>
                <div className={styles.sheetPreviewRows}><i /><i /><i /><i /><i /><i /></div>
                <div className={styles.dropdownMock}><span>Add-ons</span><span>Macros</span><strong><AppIcon app="apps-script" label="Apps Script" /> Apps Script</strong></div>
              </MockWindow>
              <div className={styles.setupArrow}>→</div>
              <MockWindow title="Apps Script" accent="gold" icon={<AppIcon app="apps-script" label="Google Apps Script" />}>
                <div className={styles.scriptToolbar}><strong>Quản lý nghỉ phép</strong><span>Undo</span><span>Redo</span><button>Deploy</button></div>
                <div className={styles.scriptEditor}>
                  <div className={styles.scriptSidebar}><span>Files</span><strong>Code.gs</strong><span>Libraries</span><span>Services</span></div>
                  <div className={styles.codeMock}><span>1</span> function doGet() {'{'}<br /><span>2</span>&nbsp;&nbsp;return HtmlService...<br /><span>3</span> {'}'}</div>
                </div>
              </MockWindow>
            </div>
          </Shell>
        );
      case 26:
        return (
          <Shell title="Tạo các file theo đúng hướng dẫn của Gemini" eyebrow="FILE STRUCTURE" className={styles.fileStructureSlide}>
            <div className={styles.fileStructureBody}>
              <div className={styles.filesLayoutInner}>
                <div className={styles.fileList}>
                  {[
                    { name: "Code.gs (mặc định)", ext: "GS", desc: "Tập lệnh máy chủ (Server-side)" },
                    { name: "Index.html", ext: "HTML", desc: "Giao diện Web App (HTML · CSS · JS)" },
                  ].map((f, i) => (
                    <div key={f.name} style={{ "--delay": `${i * 95}ms` } as CSSProperties}>
                      <span>{f.ext}</span>
                      <div className={styles.fileMeta}>
                        <strong>{f.name}</strong>
                        <small>{f.desc}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <MockWindow title="Files" icon={<AppIcon app="apps-script" label="Google Apps Script" />}><div className={styles.plusMock}>＋</div><div className={styles.dropdownMock}><span>Script</span><strong>HTML</strong></div></MockWindow>
              </div>
              <div className={styles.mergedWarningBox}>
                <div className={styles.mergedWarningHeading}>
                  <span className={styles.mergedWarningBadge}>LƯU Ý QUAN TRỌNG</span>
                  <strong>HƯỚNG DẪN TẠO VÀ CHUẨN BỊ FILE</strong>
                </div>
                <div className={styles.mergedWarningList}>
                  <div className={styles.mergedWarningItem}>
                    <span className={styles.mergedWarningDot}>1</span>
                    <p><strong>Tên file:</strong> Phải nhập đúng chính xác như hướng dẫn, <em>có phân biệt chữ hoa và chữ thường</em> (Case-sensitive).</p>
                  </div>
                  <div className={styles.mergedWarningItem}>
                    <span className={styles.mergedWarningDot}>2</span>
                    <p><strong>Xóa code cũ:</strong> <em>Xóa sạch toàn bộ nội dung mặc định</em> trong <code>Code.gs</code> và file <code>Index.html</code> ngay khi vừa tạo trước khi dán mã nguồn.</p>
                  </div>
                </div>
              </div>
            </div>
          </Shell>
        );
      case 27:
        return (
          <Shell title="Sao chép mã nguồn" eyebrow="COPY · PASTE · SAVE" className={`${styles.softMotionSlide} ${styles.tieredFlowSlide}`}>
            <TieredFlow items={["Gemini", "Copy", "Apps Script", "Paste", "Save"]} />
          </Shell>
        );
      case 28:
        return (
          <Shell title="Triển khai phần mềm" eyebrow="DEPLOY WEB APP" className={`${styles.softMotionSlide} ${styles.tieredFlowSlide}`}>
            <TieredFlow items={["Deploy", "New deployment", "Select type", "Web app", "Deploy"]} />
          </Shell>
        );
      case 29:
        return (
          <Shell title="Chạy lần đầu" eyebrow="AUTHORIZE & OPEN URL" className={styles.realisticAppSlide}>
            <div className={`${styles.firstRunGrid} ${styles.firstRunRealistic}`}>
              <MockWindow title="Authorization" accent="gold" icon={<AppIcon app="google" label="Google" />}>
                <div className={styles.googleAccountRow}><AppIcon app="google" label="Google" /><div><b>Choose an account</b><span>to continue to Quản lý nghỉ phép</span></div></div>
                <p>The web app requires you to authorise access to your data.</p><button>Authorise access</button>
              </MockWindow>
              <MockWindow title="Google hasn't verified this app" icon={<AppIcon app="google" label="Google" />}>
                <div className={styles.securityVisual}>!</div><span>Advanced</span><strong>Go to Quản lý nghỉ phép (unsafe)</strong>
              </MockWindow>
              <MockWindow title="Manage deployments" accent="green" icon={<AppIcon app="apps-script" label="Google Apps Script" />}>
                <div className={styles.deploymentSuccess}>✓ <span>Deployment successfully updated.</span></div><label>Web app URL</label><div className={styles.urlMock}>https://script.google.com/macros/s/.../exec</div>
              </MockWindow>
            </div>
          </Shell>
        );
      case 30:
        return (
          <Shell title="Vì sao phải Authorize?" eyebrow="GOOGLE PERMISSIONS" className={styles.softMotionSlide}>
            <p className={styles.permissionIntro}>Google cần xác nhận ứng dụng được phép:</p>
            <CenteredTiles items={["Đọc Google Sheets", "Ghi dữ liệu", "Gửi Email", "Truy cập Drive"]} columns={2} />
          </Shell>
        );
      case 31:
        return (
          <Shell title="Kiểm thử" eyebrow="TEST THE FIRST VERSION" className={`${styles.softMotionSlide} ${styles.testSlide}`}>
            <Flow items={["Ctrl Shift N", "Mở URL", "Nhập dữ liệu", "Submit", "Kiểm tra Sheets"]} singleRow inline testLayout />
            <div className={`${styles.successNote} ${styles.testSuccessNote}`}><i aria-hidden="true">✓</i><strong>(Quản lý nghỉ phép)</strong><span>Nếu xuất hiện dòng mới: Thành công.</span></div>
          </Shell>
        );
      case 32:
        return (
          <Shell className={styles.completionSlide}>
            <div className={styles.completionCopy}><span>✓</span><h1>Phiên bản đầu tiên đã hoàn thành</h1><p>Nhưng... đây mới chỉ là điểm bắt đầu.</p></div>
          </Shell>
        );
      case 33:
        return (
          <Shell title="Cải tiến bằng AI" eyebrow="ITERATE FASTER">
            <p className={styles.permissionIntro}>Yêu cầu Gemini:</p>
            <Checklist twoColumns items={["Thêm Logo", "Responsive đẹp hơn", "Upload File", "Dashboard", "Email", "QR Code"]} />
            <div className={styles.noRewrite}>Không cần viết lại từ đầu</div>
          </Shell>
        );
      case 34:
        return (
          <Shell title="Ví dụ Prompt" eyebrow="PROMPT + DESIGN DNA" className={styles.softMotionSlide}>
            <PromptPanel dna />
          </Shell>
        );
      case 35:
        return (
          <Shell title="AI làm việc theo vòng lặp" eyebrow="ITERATIVE DEVELOPMENT" className={`${styles.softMotionSlide} ${styles.orbitSlide}`}>
            <div className={styles.loopOrbit}>
              <div className={styles.loopOrbitRing}>
                {["Requirement", "Generate", "Test", "Improve"].map((item, i) => (
                  <article key={item}>
                    <span>{i + 1}</span>
                    <strong>{item}</strong>
                  </article>
                ))}
              </div>
              <div className={styles.loopOrbitCenter}><b>AI</b><small>ITERATE</small></div>
            </div>
          </Shell>
        );
      case 36:
        return (
          <Shell className={styles.importantSlide}>
            <div className={styles.importantCopy}><span>ĐIỀU QUAN TRỌNG NHẤT</span><h1>Không phải Prompt.<br />Không phải Code.</h1><p>Mà là khả năng <strong>mô tả đúng bài toán.</strong></p></div>
          </Shell>
        );
      case 37:
        return (
          <Shell title="Kết thúc Lab" eyebrow="BẠN ĐÃ CÓ" className={styles.softMotionSlide}>
            <CenteredTiles items={["Business Web App", "Google Sheets Database", "Dashboard", "URL chia sẻ", "Source Code", "Quy trình phát triển ứng dụng bằng AI"]} />
          </Shell>
        );
      default:
        return <Shell><div className={styles.fallback}>Section 1 · Slide {page}</div></Shell>;
    }
  }

  return (
    <>
      {renderPage()}
      {selectedIdea && (
        <PopupModal title={`Quy trình gợi ý · ${selectedIdea}`} onClose={() => setSelectedIdea(null)} showEyebrow={false}>
          <div className={styles.workflowModalList}>
            {IDEA_WORKFLOWS[selectedIdea].map((step, index) => (
              <div key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </PopupModal>
      )}
    </>
  );
}

export default function SectionOneNativeSlide({ page, scale }: Props) {
  return (
    <div className={styles.scaledCanvas} style={{ transform: `scale(${scale})` }}>
      <NativeSlides page={page} />
    </div>
  );
}
