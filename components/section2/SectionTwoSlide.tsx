"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from "react";
import styles from "./SectionTwoSlide.module.css";

type Props = { pageNumber: number };

type MotionPage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37;

const requirementPrompt = `Hãy đọc đầy đủ 3 file tôi vừa tải lên: Gemini-Prompt.txt, App-01-Source.txt và App-02-Source.txt.
Thực hiện đúng Gemini-Prompt.txt: chỉ hiển thị brief lõi tái sử dụng + các nội dung cần copy/paste vào Gem Settings; phần framework chi tiết hãy tạo thành bộ 4 file .txt để tải về và upload vào Knowledge. Không giải thích dài và chưa tạo app cụ thể.`;

const LAB_DOWNLOADS = [
  { href: "/downloads/Gemini-Prompt.txt", name: "Gemini-Prompt.txt" },
  { href: "/downloads/App-01-Source.txt", name: "App-01-Source.txt" },
  { href: "/downloads/App-02-Source.txt", name: "App-02-Source.txt" },
] as const;

const WORKFLOW_STEPS = [
  { id: "report", label: "Báo cáo sự cố" },
  { id: "classify", label: "Phân loại" },
  { id: "approve", label: "Duyệt" },
  { id: "assign", label: "Giao xử lý" },
  { id: "confirm", label: "Xác nhận hoàn tất" },
  { id: "close", label: "Đóng sự cố" },
] as const;

const WORKFLOW_POOL_ORDER = ["assign", "classify", "confirm", "approve", "report", "close"] as const;

const DATA_ITEMS = ["Người báo cáo", "Phòng ban", "Thời gian", "Địa điểm", "Mô tả", "Mức độ", "Người xử lý", "Trạng thái"] as const;

const DATA_EXAMPLES: Record<(typeof DATA_ITEMS)[number], { value: string; multiline?: boolean }> = {
  "Người báo cáo": { value: "Nguyễn Minh Anh" },
  "Phòng ban": { value: "Phòng Vận hành" },
  "Thời gian": { value: "14/09/2026 · 09:30" },
  "Địa điểm": { value: "Khu vực kho A" },
  "Mô tả": { value: "Sàn trơn gần lối đi chính, có nguy cơ gây trượt ngã.", multiline: true },
  "Mức độ": { value: "Nghiêm trọng" },
  "Người xử lý": { value: "Trần Quốc Bảo" },
  "Trạng thái": { value: "Đang xử lý" },
};

const REPORT_ITEMS = ["Tổng số sự cố", "Theo mức độ", "Theo phòng ban", "Theo trạng thái", "Theo thời gian", "Thời gian xử lý"] as const;

const REPORT_EXAMPLES: Record<(typeof REPORT_ITEMS)[number], { value: string; note: string; bars: readonly number[] }> = {
  "Tổng số sự cố": { value: "128", note: "+12 trong tháng này", bars: [38, 52, 47, 69, 76] },
  "Theo mức độ": { value: "12", note: "sự cố nghiêm trọng", bars: [72, 48, 28, 19, 12] },
  "Theo phòng ban": { value: "36", note: "cao nhất: Vận hành", bars: [32, 58, 43, 76, 51] },
  "Theo trạng thái": { value: "84%", note: "đã xử lý", bars: [24, 36, 53, 68, 84] },
  "Theo thời gian": { value: "+18%", note: "so với tháng trước", bars: [31, 39, 45, 57, 73] },
  "Thời gian xử lý": { value: "4,2 giờ", note: "trung bình mỗi sự cố", bars: [78, 63, 55, 47, 39] },
};

type CoreGroup = "common" | "specific";

const CORE_ITEMS = [
  { id: "form", label: "Form", group: "common" },
  { id: "validation", label: "Xác thực dữ liệu", group: "common" },
  { id: "workflow", label: "Quy trình", group: "common" },
  { id: "dashboard", label: "Dashboard", group: "common" },
  { id: "report", label: "Báo cáo", group: "common" },
  { id: "deployment", label: "Triển khai", group: "common" },
  { id: "fields", label: "Các trường dữ liệu", group: "specific" },
  { id: "rules", label: "Quy tắc nghiệp vụ", group: "specific" },
  { id: "permissions", label: "Phân quyền", group: "specific" },
  { id: "integration", label: "Tích hợp", group: "specific" },
] as const;

const CORE_POOL_ORDER = ["permissions", "workflow", "fields", "dashboard", "integration", "form", "rules", "deployment", "validation", "report"] as const;

type WorkflowFeedback = {
  type: "correct" | "wrong";
  title: string;
  message: string;
};

type DemoSeverity = "bình thường" | "ưu tiên";
type DemoStatus = "Đã nộp" | "Đã duyệt" | "Không duyệt" | "Đã hoàn thành";

type DemoRow = {
  id: string;
  reporter: string;
  department: string;
  location: string;
  issue: string;
  severity: DemoSeverity;
  submittedAt: string;
  status: DemoStatus;
  rejectionReason?: string;
  managerActionAt?: string;
  completedAt?: string;
};

function SectionTwoMotion({ pageNumber }: { pageNumber: MotionPage }) {
  if (pageNumber === 1) {
    return (
      <div className={styles.heroMotion} aria-hidden="true">
        <div className={styles.heroGrid} />
        <div className={styles.heroScan} />
        <div className={styles.heroAura} />

        <svg className={styles.heroNetwork} viewBox="0 0 440 440">
          <defs>
            <linearGradient id="sectionTwoHeroSignal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2d7fb4" stopOpacity=".18" />
              <stop offset="48%" stopColor="#e9ca8b" stopOpacity=".82" />
              <stop offset="100%" stopColor="#f4dfb0" stopOpacity=".25" />
            </linearGradient>
          </defs>
          <g className={styles.heroRings}>
            <circle cx="220" cy="220" r="158" />
            <circle cx="220" cy="220" r="112" />
            <circle cx="220" cy="220" r="68" />
          </g>
          <g className={styles.heroLinks}>
            <path d="M220 220 L116 125 L285 92 L350 220 L284 346 L112 308 Z" />
            <path d="M116 125 L284 346" />
            <path d="M285 92 L112 308" />
            <path d="M350 220 L116 125" />
          </g>
          <g className={styles.heroNodes}>
            <circle cx="116" cy="125" r="7" />
            <circle cx="285" cy="92" r="7" />
            <circle cx="350" cy="220" r="7" />
            <circle cx="284" cy="346" r="7" />
            <circle cx="112" cy="308" r="7" />
          </g>
        </svg>

        <div className={styles.heroCore}>
          <span />
          <i />
        </div>
        <div className={`${styles.heroOrbitDot} ${styles.heroOrbitDotA}`} />
        <div className={`${styles.heroOrbitDot} ${styles.heroOrbitDotB}`} />
        <div className={styles.heroTitleSweep} />
      </div>
    );
  }

  const strongMotion = pageNumber !== 1;

  return (
    <div className={`${styles.ambientMotion} ${strongMotion ? styles.strongAmbientMotion : ""}`} aria-hidden="true">
      <div className={styles.ambientGlow} />
      <div className={styles.ambientSweep} />
      <svg className={styles.ambientPath} viewBox="0 0 960 540" preserveAspectRatio="none">
        <path d="M-40 410 C155 324 278 438 455 310 C625 187 746 262 1000 116" />
      </svg>
      <span className={`${styles.ambientNode} ${styles.ambientNodeA}`} />
      <span className={`${styles.ambientNode} ${styles.ambientNodeB}`} />
      <span className={`${styles.ambientNode} ${styles.ambientNodeC}`} />
    </div>
  );
}

function Shell({
  children,
  dark = false,
  blank = false,
  motion,
}: {
  children?: ReactNode;
  dark?: boolean;
  blank?: boolean;
  motion?: MotionPage;
}) {
  const motionClass = motion ? styles[`motionPage${motion}`] : "";

  return (
    <section className={`${styles.slide} ${dark ? styles.dark : ""} ${blank ? styles.blank : ""} ${motionClass}`}>
      {motion && <SectionTwoMotion pageNumber={motion} />}
      {!blank && <div className={styles.cornerMark} />}
      {children}
    </section>
  );
}

function Title({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <h1 className={`${styles.title} ${compact ? styles.compactTitle : ""}`}>{children}</h1>;
}

function MiniTitle({ children }: { children: ReactNode }) {
  return <div className={styles.miniTitle}>{children}</div>;
}

function Quote({ children, navy = false }: { children: ReactNode; navy?: boolean }) {
  return <div className={`${styles.quote} ${navy ? styles.quoteNavy : ""}`}><span>“</span>{children}</div>;
}

export default function SectionTwoSlide({ pageNumber }: Props) {
  const [copied, setCopied] = useState(false);
  const [workflowSlots, setWorkflowSlots] = useState<Array<string | null>>(
    () => Array(WORKFLOW_STEPS.length).fill(null)
  );
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [rejectedWorkflow, setRejectedWorkflow] = useState<string | null>(null);
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null);
  const [showWorkflowCongrats, setShowWorkflowCongrats] = useState(false);
  const [activeDataItems, setActiveDataItems] = useState<string[]>([]);
  const [showDataCongrats, setShowDataCongrats] = useState(false);
  const [activeReportItems, setActiveReportItems] = useState<string[]>([]);
  const [showReportCongrats, setShowReportCongrats] = useState(false);
  const [coreCommonItems, setCoreCommonItems] = useState<string[]>([]);
  const [coreSpecificItems, setCoreSpecificItems] = useState<string[]>([]);
  const [selectedCoreItem, setSelectedCoreItem] = useState<string | null>(null);
  const [rejectedCoreItem, setRejectedCoreItem] = useState<string | null>(null);
  const [coreFeedback, setCoreFeedback] = useState<WorkflowFeedback | null>(null);
  const [showCoreCongrats, setShowCoreCongrats] = useState(false);
  const [demoForm, setDemoForm] = useState<{
    reporter: string;
    department: string;
    location: string;
    issue: string;
    severity: "" | DemoSeverity;
  }>({
    reporter: "Nguyễn Minh Anh",
    department: "Phòng Vận hành",
    location: "Kho A",
    issue: "Sàn trơn gần lối đi chính",
    severity: "",
  });
  const [demoRows, setDemoRows] = useState<DemoRow[]>([]);
  const [demoFormMessage, setDemoFormMessage] = useState<string | null>(null);
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  const demoSequenceRef = useRef(1);
  const feedbackTimerRef = useRef<number | null>(null);
  const rejectedTimerRef = useRef<number | null>(null);
  const congratsTimerRef = useRef<number | null>(null);
  const coreFeedbackTimerRef = useRef<number | null>(null);
  const coreRejectedTimerRef = useRef<number | null>(null);
  const coreCongratsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
      if (rejectedTimerRef.current !== null) window.clearTimeout(rejectedTimerRef.current);
      if (congratsTimerRef.current !== null) window.clearTimeout(congratsTimerRef.current);
      if (coreFeedbackTimerRef.current !== null) window.clearTimeout(coreFeedbackTimerRef.current);
      if (coreRejectedTimerRef.current !== null) window.clearTimeout(coreRejectedTimerRef.current);
      if (coreCongratsTimerRef.current !== null) window.clearTimeout(coreCongratsTimerRef.current);
    };
  }, []);

  async function copyPrompt() {
    await navigator.clipboard.writeText(requirementPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadLabFiles() {
    LAB_DOWNLOADS.forEach((file, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = file.href;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 180);
    });
  }

  function showTemporaryWorkflowFeedback(feedback: WorkflowFeedback) {
    setWorkflowFeedback(feedback);

    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setWorkflowFeedback(null);
      feedbackTimerRef.current = null;
    }, 1150);
  }

  function placeWorkflowStep(stepId: string, slotIndex: number) {
    if (workflowSlots.includes(stepId) || workflowSlots[slotIndex]) return;

    const step = WORKFLOW_STEPS.find((item) => item.id === stepId);
    if (!step) return;

    if (WORKFLOW_STEPS[slotIndex].id !== stepId) {
      setSelectedWorkflow(null);
      setRejectedWorkflow(stepId);
      showTemporaryWorkflowFeedback({
        type: "wrong",
        title: "Chưa đúng",
        message: "Khung đã quay về vị trí cũ. Hãy thử một thứ tự khác.",
      });

      if (rejectedTimerRef.current !== null) {
        window.clearTimeout(rejectedTimerRef.current);
      }

      rejectedTimerRef.current = window.setTimeout(() => {
        setRejectedWorkflow(null);
        rejectedTimerRef.current = null;
      }, 720);
      return;
    }

    const nextSlots = [...workflowSlots];
    nextSlots[slotIndex] = stepId;
    setWorkflowSlots(nextSlots);
    setSelectedWorkflow(null);
    showTemporaryWorkflowFeedback({
      type: "correct",
      title: "Chính xác",
      message: `${step.label} ở đúng vị trí số ${slotIndex + 1}.`,
    });

    if (nextSlots.every(Boolean)) {
      if (congratsTimerRef.current !== null) {
        window.clearTimeout(congratsTimerRef.current);
      }

      congratsTimerRef.current = window.setTimeout(() => {
        setWorkflowFeedback(null);
        setShowWorkflowCongrats(true);
        congratsTimerRef.current = null;
      }, 850);
    }
  }

  function handleWorkflowDrop(event: DragEvent<HTMLButtonElement>, slotIndex: number) {
    event.preventDefault();
    const stepId = event.dataTransfer.getData("text/plain");
    placeWorkflowStep(stepId, slotIndex);
  }

  function activateDataItem(item: string) {
    setActiveDataItems((current) => current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item]);
  }

  function activateReportItem(item: string) {
    setActiveReportItems((current) => current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item]);
  }

  function showTemporaryCoreFeedback(feedback: WorkflowFeedback) {
    setCoreFeedback(feedback);

    if (coreFeedbackTimerRef.current !== null) window.clearTimeout(coreFeedbackTimerRef.current);
    coreFeedbackTimerRef.current = window.setTimeout(() => {
      setCoreFeedback(null);
      coreFeedbackTimerRef.current = null;
    }, 1150);
  }

  function placeCoreItem(itemId: string, targetGroup: CoreGroup) {
    if (coreCommonItems.includes(itemId) || coreSpecificItems.includes(itemId)) return;

    const item = CORE_ITEMS.find((entry) => entry.id === itemId);
    if (!item) return;

    if (item.group !== targetGroup) {
      setSelectedCoreItem(null);
      setRejectedCoreItem(itemId);
      showTemporaryCoreFeedback({
        type: "wrong",
        title: "Chưa đúng nhóm",
        message: "Thẻ đã quay về vị trí cũ. Hãy thử nhóm còn lại.",
      });

      if (coreRejectedTimerRef.current !== null) window.clearTimeout(coreRejectedTimerRef.current);
      coreRejectedTimerRef.current = window.setTimeout(() => {
        setRejectedCoreItem(null);
        coreRejectedTimerRef.current = null;
      }, 720);
      return;
    }

    const nextCommon = targetGroup === "common" ? [...coreCommonItems, itemId] : coreCommonItems;
    const nextSpecific = targetGroup === "specific" ? [...coreSpecificItems, itemId] : coreSpecificItems;
    setCoreCommonItems(nextCommon);
    setCoreSpecificItems(nextSpecific);
    setSelectedCoreItem(null);
    showTemporaryCoreFeedback({
      type: "correct",
      title: "Chính xác",
      message: `${item.label} đã được xếp vào đúng nhóm.`,
    });

    if (nextCommon.length + nextSpecific.length === CORE_ITEMS.length) {
      if (coreCongratsTimerRef.current !== null) window.clearTimeout(coreCongratsTimerRef.current);
      coreCongratsTimerRef.current = window.setTimeout(() => {
        setCoreFeedback(null);
        setShowCoreCongrats(true);
        coreCongratsTimerRef.current = null;
      }, 850);
    }
  }

  function handleCoreDrop(event: DragEvent<HTMLButtonElement>, targetGroup: CoreGroup) {
    event.preventDefault();
    placeCoreItem(event.dataTransfer.getData("text/plain"), targetGroup);
  }

  function getDemoTimestamp() {
    const now = new Date();
    return now.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function submitDemoForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!demoForm.reporter.trim() || !demoForm.department.trim() || !demoForm.location.trim() || !demoForm.issue.trim()) {
      setDemoFormMessage("Vui lòng nhập đầy đủ thông tin trước khi gửi.");
      return;
    }

    if (!demoForm.severity) {
      setDemoFormMessage("Vui lòng chọn Mức độ trước khi Submit.");
      return;
    }

    const sequence = demoSequenceRef.current;
    demoSequenceRef.current += 1;
    setDemoRows((current) => [...current, {
      id: `SC-${String(sequence).padStart(3, "0")}`,
      reporter: demoForm.reporter.trim(),
      department: demoForm.department.trim(),
      location: demoForm.location.trim(),
      issue: demoForm.issue.trim(),
      severity: demoForm.severity,
      submittedAt: getDemoTimestamp(),
      status: "Đã nộp",
    }]);
    setDemoFormMessage("Đã gửi sự cố sang hàng chờ của Quản lý.");
    setDemoForm((current) => ({ ...current, location: "", issue: "", severity: "" }));
  }

  function approveDemoRow(rowId: string) {
    setDemoRows((current) => current.map((row) => row.id === rowId
      ? { ...row, status: "Đã duyệt", managerActionAt: getDemoTimestamp(), rejectionReason: undefined }
      : row));
    setManagerNotes((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  function rejectDemoRow(rowId: string) {
    const reason = managerNotes[rowId]?.trim();
    if (!reason) return;
    setDemoRows((current) => current.map((row) => row.id === rowId
      ? { ...row, status: "Không duyệt", rejectionReason: reason, managerActionAt: getDemoTimestamp() }
      : row));
    setManagerNotes((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  function completeDemoRow(rowId: string) {
    setDemoRows((current) => current.map((row) => row.id === rowId
      ? { ...row, status: "Đã hoàn thành", completedAt: getDemoTimestamp() }
      : row));
  }

  const workflowComplete = workflowSlots.every(Boolean);
  const coreComplete = coreCommonItems.length + coreSpecificItems.length === CORE_ITEMS.length;
  const selectedDataItems = DATA_ITEMS.filter((item) => activeDataItems.includes(item));
  const selectedReportItems = REPORT_ITEMS.filter((item) => activeReportItems.includes(item));

  switch (pageNumber) {
    case 1:
      return <Shell dark motion={1}><div className={styles.cover}><h1>Từ thiết kế Prompt<br />đến AI Business Framework</h1><div className={styles.goldRule} /></div></Shell>;
    case 2:
      return <Shell motion={2}>
        <div className={styles.sectionCompare}>
          <div><MiniTitle>SECTION 1</MiniTitle><h2>Tạo được một Business<br />Web App (demo)</h2></div>
          <div className={styles.compareArrow}>→</div>
          <div><MiniTitle>SECTION 2</MiniTitle><h2>Tạo được cách làm<br />có thể tái sử dụng</h2></div>
        </div>
        <p className={styles.bottomStatement}>Từ một sản phẩm đơn lẻ đến một tiêu chuẩn chung cho nhiều sản phẩm.</p>
      </Shell>;
    case 3:
      return <Shell motion={3}><Title>Sau Section 2, bạn sẽ làm được</Title><div className={styles.outcomeGrid}>
        {["Viết Requirement có cấu trúc và có thể kiểm thử", "Phân biệt phần dùng chung và phần riêng của từng ứng dụng", "Xây AI Business Framework cho doanh nghiệp", "Đóng gói Framework thành Gem trong Gemini"].map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}
      </div></Shell>;
    case 4:
      return <Shell dark motion={4}><div className={styles.centerStatement}><h2>Đa số trường hợp, AI không làm sai.</h2><p>AI chỉ làm đúng theo yêu cầu mà bạn mô tả.</p></div></Shell>;
    case 5:
      return <Shell motion={5}><Title>Sai lầm phổ biến</Title><div className={styles.mistakeLayout}><div className={styles.mistakeBox}>“Tạo giúp tôi một app quản lý.”</div><div className={styles.questionPanel}><p className={styles.leadSmall}>AI sẽ phải tự đoán:</p><div className={styles.questionGrid}>{["Quản lý cái gì?", "Có quy trình gì?", "Ai dùng?", "Lưu dữ liệu ở đâu?"].map(item => <span key={item}>{item}</span>)}</div></div></div></Shell>;
    case 6:
      return <Shell motion={6}><Title>“Yêu cầu” quyết định chất lượng đầu ra</Title><div className={styles.twoConcepts}>
        <div><h2>Prompt</h2><p>Chỉ là cách diễn đạt.</p></div><div className={styles.navyCard}><h2>Yêu cầu</h2><p>Mới là điều quyết định chất lượng ứng dụng.</p></div>
      </div></Shell>;
    case 7:
      return <Shell dark motion={7}><div className={styles.centerStatement}><h2>Đừng bắt đầu bằng “Tạo Web App”.</h2><p>Hãy bắt đầu bằng:</p><strong>“Doanh nghiệp đang gặp vấn đề gì?”</strong></div></Shell>;
    case 8:
      return <Shell motion={8}><Title>Ví dụ mới: Báo cáo sự cố</Title><div className={styles.exampleColumns}>
        <div><MiniTitle>✕ &nbsp; Chưa rõ</MiniTitle><p>“Tạo app báo cáo sự cố.”</p></div>
        <div className={styles.navyCard}><MiniTitle>✓ &nbsp; Rõ ràng</MiniTitle><p>“Nhân viên đang báo cáo sự cố qua Zalo. Bộ phận an toàn khó theo dõi mức độ và tiến độ xử lý. Cần một Web App tập trung.”</p></div>
      </div></Shell>;
    case 9:
      return <Shell motion={9}><Title>Users</Title><p className={styles.subtitle}>Xác định: Ai sử dụng? Ai ra quyết định?</p><ul className={styles.goldBullets}>{["Nhân viên", "Bộ phận giám sát an toàn", "Quản lý", "Ban giám đốc"].map(item => <li key={item}>{item}</li>)}</ul></Shell>;
    case 10:
      return <Shell motion={10}><div className={`${styles.workflowChallenge} ${workflowComplete ? styles.workflowChallengeComplete : ""}`} data-interactive="true">
        <div className={styles.workflowChallengeHead}>
          <Title>Quy trình làm việc</Title>
          <p>{workflowComplete ? "Đã hoàn thành đúng toàn bộ quy trình." : "Kéo 6 khung vào đúng thứ tự quy trình."}</p>
        </div>

        <div className={`${styles.workflowTargets} ${workflowComplete ? styles.workflowTargetsComplete : ""}`} aria-label="Thứ tự quy trình">
          {WORKFLOW_STEPS.map((step, index) => {
            const placedId = workflowSlots[index];
            const placedStep = WORKFLOW_STEPS.find((item) => item.id === placedId);

            return (
              <button
                type="button"
                className={`${styles.workflowTarget} ${placedStep ? styles.workflowTargetComplete : ""}`}
                key={step.id}
                aria-label={placedStep ? `Vị trí ${index + 1}: ${placedStep.label}` : `Thả bước thứ ${index + 1} vào đây`}
                onDragOver={(event) => {
                  if (!placedStep) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => handleWorkflowDrop(event, index)}
                onClick={() => {
                  if (selectedWorkflow && !placedStep) placeWorkflowStep(selectedWorkflow, index);
                }}
              >
                <span className={styles.workflowTargetNumber}>{String(index + 1).padStart(2, "0")}</span>
                {placedStep ? (
                  <><strong>{placedStep.label}</strong><i aria-hidden="true">✓</i></>
                ) : (
                  <span className={styles.workflowTargetPlaceholder}>Thả vào đây</span>
                )}
              </button>
            );
          })}
        </div>

        {!workflowComplete && (
          <div className={styles.workflowPool} aria-label="Các bước chưa sắp xếp">
            {WORKFLOW_POOL_ORDER.map((stepId, index) => {
              const step = WORKFLOW_STEPS.find((item) => item.id === stepId)!;
              const isPlaced = workflowSlots.includes(stepId);
              if (isPlaced) return null;

              return (
                <button
                  type="button"
                  draggable
                  key={step.id}
                  className={`${styles.workflowCard} ${styles[`workflowCard${index + 1}`]} ${selectedWorkflow === step.id ? styles.workflowCardSelected : ""} ${rejectedWorkflow === step.id ? styles.workflowCardRejected : ""}`}
                  aria-pressed={selectedWorkflow === step.id}
                  onClick={() => setSelectedWorkflow((current) => current === step.id ? null : step.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", step.id);
                    setSelectedWorkflow(step.id);
                  }}
                  onDragEnd={() => setSelectedWorkflow(null)}
                >
                  <span className={styles.workflowGrip} aria-hidden="true">⋮⋮</span>
                  <strong>{step.label}</strong>
                </button>
              );
            })}
          </div>
        )}

        {workflowFeedback && (
          <div className={`${styles.workflowFeedback} ${workflowFeedback.type === "correct" ? styles.workflowFeedbackCorrect : styles.workflowFeedbackWrong}`} role="status">
            <span aria-hidden="true">{workflowFeedback.type === "correct" ? "✓" : "↺"}</span>
            <div><strong>{workflowFeedback.title}</strong><p>{workflowFeedback.message}</p></div>
          </div>
        )}

        {showWorkflowCongrats && (
          <div className={styles.workflowCongratsBackdrop}>
            <section className={styles.workflowCongrats} role="dialog" aria-modal="true" aria-label="Hoàn thành quy trình">
              <div className={styles.workflowCongratsIcon} aria-hidden="true">✓</div>
              <MiniTitle>HOÀN THÀNH THỬ THÁCH</MiniTitle>
              <h2>Chúc mừng!</h2>
              <p>Bạn đã sắp xếp đúng toàn bộ quy trình làm việc.</p>
              <button type="button" onClick={() => setShowWorkflowCongrats(false)}>Xem thứ tự đúng</button>
            </section>
          </div>
        )}
      </div></Shell>;
    case 11:
      return <Shell motion={11}><div className={styles.guidedInteraction} data-interactive="true">
        <div className={styles.interactionHeading}>
          <div><Title>Dữ liệu</Title><p>Chọn các trường cần có, sau đó xem form được tạo theo lựa chọn.</p></div>
          <div className={styles.interactionActions}>
            <span>{activeDataItems.length}/{DATA_ITEMS.length}</span>
            <button type="button" disabled={activeDataItems.length === 0} onClick={() => setShowDataCongrats(true)}>Hoàn thành</button>
          </div>
        </div>
        <div className={styles.dataGrid}>{DATA_ITEMS.map((item) => {
          const isActive = activeDataItems.includes(item);
          const index = DATA_ITEMS.indexOf(item);
          return <button type="button" className={isActive ? styles.interactionTileActive : ""} aria-pressed={isActive} onClick={() => activateDataItem(item)} key={item}><i>{String(index + 1).padStart(2, "0")}</i><strong>{item}</strong><b aria-hidden="true">{isActive ? "✓" : "+"}</b></button>;
        })}</div>
        {showDataCongrats && <div className={styles.previewBackdrop}><section className={`${styles.previewPanel} ${styles.formPreviewPanel}`} role="dialog" aria-modal="true" aria-label="Form được tạo từ các trường đã chọn">
          <header><div><MiniTitle>FORM XEM TRƯỚC</MiniTitle><h2>Báo cáo sự cố</h2></div><button type="button" aria-label="Đóng form xem trước" onClick={() => setShowDataCongrats(false)}>×</button></header>
          <div className={styles.dataPreviewForm} data-count={selectedDataItems.length} role="form" aria-label="Ví dụ form báo cáo sự cố">
            {selectedDataItems.map((item) => {
              const example = DATA_EXAMPLES[item];
              return <label className={example.multiline ? styles.previewFieldWide : ""} key={item}><span>{item}</span>{example.multiline ? <textarea value={example.value} readOnly /> : <input value={example.value} readOnly />}</label>;
            })}
          </div>
          <footer><p>Form linh hoạt gồm <strong>{selectedDataItems.length}</strong> trường đã chọn.</p><button type="button" onClick={() => setShowDataCongrats(false)}>Quay lại chỉnh sửa</button></footer>
        </section></div>}
      </div></Shell>;
    case 12:
      return <Shell motion={12}><Title>Quy tắc nghiệp vụ</Title><div className={styles.ruleGrid}>
        {["Không gửi khi thiếu mô tả hoặc mức độ", "Sự cố nghiêm trọng phải ưu tiên xử lý", "Chỉ người được giao hoặc quản trị viên được cập nhật", "Mỗi lần đổi trạng thái phải lưu thời gian"].map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}
      </div></Shell>;
    case 13:
      return <Shell motion={13}><Title>Tiêu chí chấp nhận</Title><p className={styles.subtitle}>Mỗi tiêu chí phải kiểm tra được bằng một hành động cụ thể.</p><ul className={styles.checkList}>{["Không thể nộp form nếu thiếu Mức độ", "Sau khi nộp, Google Sheets xuất hiện dòng mới", "Sự cố mức Nghiêm trọng hiển thị ở đầu danh sách", "Dashboard cập nhật sau khi tải lại dữ liệu"].map(item => <li key={item}>●<span>{item}</span></li>)}</ul></Shell>;
    case 14:
      return <Shell motion={14}><div className={styles.guidedInteraction} data-interactive="true">
        <div className={styles.interactionHeading}>
          <div><Title>Báo cáo</Title><p>Chọn các chỉ số cần theo dõi, sau đó dựng Dashboard trực quan.</p></div>
          <div className={styles.interactionActions}>
            <span>{activeReportItems.length}/{REPORT_ITEMS.length}</span>
            <button type="button" disabled={activeReportItems.length === 0} onClick={() => setShowReportCongrats(true)}>Hoàn thành</button>
          </div>
        </div>
        <div className={styles.reportGrid}>{REPORT_ITEMS.map((item) => {
          const isActive = activeReportItems.includes(item);
          const index = REPORT_ITEMS.indexOf(item);
          return <button type="button" className={isActive ? styles.interactionTileActive : ""} aria-pressed={isActive} onClick={() => activateReportItem(item)} key={item}><i>{String(index + 1).padStart(2, "0")}</i><strong>{item}</strong><b aria-hidden="true">{isActive ? "✓" : "+"}</b></button>;
        })}</div>
        {showReportCongrats && <div className={styles.previewBackdrop}><section className={`${styles.previewPanel} ${styles.dashboardPreviewPanel}`} role="dialog" aria-modal="true" aria-label="Dashboard được tạo từ các chỉ số đã chọn">
          <header><div><MiniTitle>DASHBOARD XEM TRƯỚC</MiniTitle><h2>Tổng quan sự cố</h2></div><button type="button" aria-label="Đóng Dashboard xem trước" onClick={() => setShowReportCongrats(false)}>×</button></header>
          <div className={styles.dashboardPreviewGrid} data-count={selectedReportItems.length}>
            {selectedReportItems.map((item) => {
              const example = REPORT_EXAMPLES[item];
              return <article key={item}><span>{item}</span><strong>{example.value}</strong><small>{example.note}</small><div aria-hidden="true">{example.bars.map((height, index) => <i key={`${item}-${index}`} style={{ height: `${height}%` }} />)}</div></article>;
            })}
          </div>
          <footer><p>Dashboard đang hiển thị <strong>{selectedReportItems.length}</strong> chỉ số đã chọn.</p><button type="button" onClick={() => setShowReportCongrats(false)}>Quay lại chỉnh sửa</button></footer>
        </section></div>}
      </div></Shell>;
    case 15:
      return <Shell motion={15}><Title>Tổng hợp các yêu cầu</Title><div className={styles.requirementSummary}><strong>Ví dụ:</strong><p>Tạo một Web App báo cáo sự cố nội bộ đơn giản, giao diện responsive và dễ sử dụng.</p><ul>
        <li>Người dùng gồm: Nhân viên, Quản lý và Bộ phận an toàn.</li>
        <li>Nhân viên có thể báo cáo sự cố với: Người báo cáo, Phòng ban, Thời gian, Địa điểm, Mô tả và Mức độ.</li>
        <li>Workflow: (nhân viên) Báo cáo sự cố → (hệ thống) Phân loại → (Quản lý) Duyệt → Giao xử lý → (Bộ phận an toàn) Xác nhận hoàn tất → (hệ thống) Đóng sự cố.</li>
        <li>Mỗi sự cố lưu thông tin báo cáo, trạng thái và thời gian của mỗi lần thay đổi trạng thái.</li>
        <li>Không cho Submit nếu để trống Mức độ; sự cố nghiêm trọng phải được ưu tiên xử lý.</li>
        <li>Dashboard hiển thị tổng số sự cố, theo mức độ, phòng ban, trạng thái và thời gian xử lý.</li>
        <li>Dùng Google Apps Script + Google Sheets; ưu tiên code tối giản cho app demo nội bộ.</li>
      </ul></div></Shell>;
    case 16: {
      const submittedCount = demoRows.length;
      const approvedCount = demoRows.filter((row) => row.status === "Đã duyệt" || row.status === "Đã hoàn thành").length;
      const rejectedCount = demoRows.filter((row) => row.status === "Không duyệt").length;
      const completedCount = demoRows.filter((row) => row.status === "Đã hoàn thành").length;
      const managerQueue = demoRows.filter((row) => row.status === "Đã nộp");
      const safetyQueue = demoRows.filter((row) => row.status === "Đã duyệt");
      return <Shell motion={16}><div className={styles.workflowDemo} data-interactive="true">
        <div className={styles.workflowDemoHead}><Title>Demo ứng dụng bám sát Requirement</Title><p>Nhân viên gửi form → Quản lý duyệt / không duyệt → Bộ phận an toàn hoàn thành → Excel + Dashboard cập nhật ngay</p></div>
        <div className={styles.workflowDemoGrid}>
          <section className={`${styles.demoPanel} ${styles.demoFormPanel}`}>
            <header><b>01</b><div><MiniTitle>NHÂN VIÊN</MiniTitle><strong>Gửi báo cáo sự cố</strong></div></header>
            <form onSubmit={submitDemoForm}>
              <label>Người báo cáo<input value={demoForm.reporter} onChange={(event) => setDemoForm((current) => ({ ...current, reporter: event.target.value }))} /></label>
              <label>Phòng ban<input value={demoForm.department} onChange={(event) => setDemoForm((current) => ({ ...current, department: event.target.value }))} /></label>
              <label>Địa điểm<input value={demoForm.location} onChange={(event) => setDemoForm((current) => ({ ...current, location: event.target.value }))} /></label>
              <label>Mức độ <span className={styles.demoRequired}>*</span><select value={demoForm.severity} onChange={(event) => { const value = event.target.value as "" | DemoSeverity; setDemoForm((current) => ({ ...current, severity: value })); setDemoFormMessage(value ? null : "Vui lòng chọn Mức độ trước khi Submit."); }} required><option value="">Chọn mức độ</option><option value="bình thường">bình thường</option><option value="ưu tiên">ưu tiên</option></select></label>
              <label>Mô tả sự cố<input value={demoForm.issue} onChange={(event) => setDemoForm((current) => ({ ...current, issue: event.target.value }))} /></label>
              <button type="submit" disabled={!demoForm.severity} title={!demoForm.severity ? "Hãy chọn Mức độ trước khi Submit" : "Submit báo cáo"}>Submit báo cáo</button>
            </form>
            <p className={`${styles.demoHint} ${demoFormMessage?.includes("Vui lòng") ? styles.demoHintError : styles.demoHintSuccess}`}>{demoFormMessage ?? "Mức độ bắt buộc phải chọn trước khi Submit."}</p>
          </section>

          <section className={`${styles.demoPanel} ${styles.demoApprovalPanel}`}>
            <header><b>02</b><div><MiniTitle>QUẢN LÝ</MiniTitle><strong>Phê duyệt yêu cầu mới</strong></div></header>
            {managerQueue.length === 0 ? <p className={styles.demoEmpty}>{demoRows.length === 0 ? "Chưa có yêu cầu nào từ Nhân viên." : "Không còn yêu cầu nào chờ Quản lý xử lý."}</p> : <div className={styles.demoApprovalList}>{managerQueue.map((row) => <article key={row.id}><div><strong>{row.id} · {row.reporter}</strong><span>{row.issue}</span><small>{row.department} · {row.location} · Hệ thống phân loại: {row.severity}</small><textarea value={managerNotes[row.id] ?? ""} onChange={(event) => setManagerNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Nhập lý do nếu Không duyệt" /></div><div className={styles.demoActionColumn}><button type="button" onClick={() => approveDemoRow(row.id)}>Duyệt</button><button type="button" className={styles.demoRejectButton} disabled={!managerNotes[row.id]?.trim()} onClick={() => rejectDemoRow(row.id)}>Không duyệt</button></div></article>)}</div>}
          </section>

          <section className={`${styles.demoPanel} ${styles.demoSafetyPanel}`}>
            <header><b>03</b><div><MiniTitle>BỘ PHẬN AN TOÀN</MiniTitle><strong>Xác nhận hoàn tất</strong></div></header>
            {safetyQueue.length === 0 ? <p className={styles.demoEmpty}>{demoRows.some((row) => row.status === "Đã hoàn thành") ? "Không còn yêu cầu nào chờ Bộ phận an toàn." : "Chưa có yêu cầu đã duyệt để hoàn thành."}</p> : <div className={styles.demoSafetyList}>{safetyQueue.map((row) => <article key={row.id}><div><strong>{row.id} · {row.reporter}</strong><span>{row.issue}</span><small>{row.location} · Quản lý đã duyệt {row.managerActionAt ? `lúc ${row.managerActionAt}` : ""}</small></div><button type="button" onClick={() => completeDemoRow(row.id)}>Hoàn thành</button></article>)}</div>}
          </section>

          <section className={`${styles.demoPanel} ${styles.demoExcelPanel}`}>
            <header><b>04</b><div><MiniTitle>EXCEL MÔ PHỎNG DATA</MiniTitle><strong>Dữ liệu cập nhật theo thao tác</strong></div></header>
            {demoRows.length === 0 ? <p className={styles.demoEmpty}>Chưa có dòng dữ liệu. Hãy gửi form từ khung Nhân viên.</p> : <div className={styles.demoTableWrap}><table><thead><tr><th>Mã</th><th>Nhân viên</th><th>Sự cố</th><th>Mức độ</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{demoRows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.reporter}</td><td title={`${row.department} · ${row.location} · ${row.issue}`}>{row.issue}</td><td>{row.severity}</td><td><span className={row.status === "Đã hoàn thành" ? styles.demoStatusCompleted : row.status === "Đã duyệt" ? styles.demoStatusApproved : row.status === "Không duyệt" ? styles.demoStatusRejected : styles.demoStatusPending}>{row.status}</span></td><td title={row.rejectionReason ?? row.completedAt ?? row.submittedAt}>{row.rejectionReason ?? (row.completedAt ? `HT ${row.completedAt}` : row.submittedAt)}</td></tr>)}</tbody></table></div>}
          </section>

          <section className={`${styles.demoPanel} ${styles.demoDashboardPanel}`}>
            <header><b>05</b><div><MiniTitle>DASHBOARD</MiniTitle><strong>Theo dõi trạng thái tức thời</strong></div></header>
            <div className={styles.demoMetrics}><article><span>Đã nộp</span><strong>{submittedCount}</strong><i style={{ "--metric-level": `${Math.min(100, submittedCount * 24)}%` } as CSSProperties} /></article><article><span>Đã duyệt</span><strong>{approvedCount}</strong><i style={{ "--metric-level": `${demoRows.length ? Math.round((approvedCount / demoRows.length) * 100) : 0}%` } as CSSProperties} /></article><article><span>Không duyệt</span><strong>{rejectedCount}</strong><i style={{ "--metric-level": `${demoRows.length ? Math.round((rejectedCount / demoRows.length) * 100) : 0}%` } as CSSProperties} /></article><article><span>Đã hoàn thành</span><strong>{completedCount}</strong><i style={{ "--metric-level": `${demoRows.length ? Math.round((completedCount / demoRows.length) * 100) : 0}%` } as CSSProperties} /></article></div>
            <p>Tổng hồ sơ: <strong>{demoRows.length}</strong> · Cập nhật theo workflow Slide 15.</p>
          </section>
        </div>
      </div></Shell>;
    }
    case 17:
      return <Shell motion={17}><div className={styles.frameworkQuestion}><MiniTitle>AI BUSINESS FRAMEWORK</MiniTitle><Title>Tại sao phải làm lại từ đầu?</Title><p>Lần sau xây ứng dụng mới, bạn có muốn viết lại toàn bộ Prompt?</p></div></Shell>;
    case 18:
      return <Shell motion={18}><div className={`${styles.coreChallenge} ${coreComplete ? styles.coreChallengeComplete : ""}`} data-interactive="true">
        <div className={styles.coreChallengeHead}>
          <Title>Lõi chung và Đặc thù theo ứng dụng</Title>
          <p>{coreComplete ? "Đã phân loại đúng 10/10 thành phần." : "Kéo từng thẻ vào đúng nhóm."}</p>
        </div>
        <div className={styles.coreTargets}>
          {(["common", "specific"] as const).map((group) => {
            const placedIds = group === "common" ? coreCommonItems : coreSpecificItems;
            return <button type="button" className={`${styles.coreTarget} ${group === "common" ? styles.coreTargetCommon : styles.coreTargetSpecific}`} key={group} aria-label={`Nhóm ${group === "common" ? "dùng chung" : "thay đổi theo ứng dụng"}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleCoreDrop(event, group)} onClick={() => { if (selectedCoreItem) placeCoreItem(selectedCoreItem, group); }}>
              <span className={styles.coreTargetLabel}>{group === "common" ? "DÙNG CHUNG" : "THAY ĐỔI THEO APP"}</span>
              <span className={styles.coreTargetSlots}>{placedIds.length === 0 ? <em>Thả thẻ vào đây</em> : placedIds.map((id) => { const item = CORE_ITEMS.find((entry) => entry.id === id)!; return <span key={id}>{item.label}<i aria-hidden="true">✓</i></span>; })}</span>
            </button>;
          })}
        </div>
        {!coreComplete && <div className={styles.corePool} aria-label="Các thành phần cần phân loại">
          {CORE_POOL_ORDER.map((itemId, index) => {
            const item = CORE_ITEMS.find((entry) => entry.id === itemId)!;
            if (coreCommonItems.includes(itemId) || coreSpecificItems.includes(itemId)) return null;
            return <button type="button" draggable key={item.id} className={`${styles.coreCard} ${styles[`coreCard${index + 1}`]} ${selectedCoreItem === item.id ? styles.coreCardSelected : ""} ${rejectedCoreItem === item.id ? styles.coreCardRejected : ""}`} aria-pressed={selectedCoreItem === item.id} onClick={() => setSelectedCoreItem((current) => current === item.id ? null : item.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); setSelectedCoreItem(item.id); }} onDragEnd={() => setSelectedCoreItem(null)}><span aria-hidden="true">⋮⋮</span><strong>{item.label}</strong></button>;
          })}
        </div>}
        {coreFeedback && <div className={`${styles.workflowFeedback} ${styles.coreFeedback} ${coreFeedback.type === "correct" ? styles.workflowFeedbackCorrect : styles.workflowFeedbackWrong}`} role="status"><span aria-hidden="true">{coreFeedback.type === "correct" ? "✓" : "↺"}</span><div><strong>{coreFeedback.title}</strong><p>{coreFeedback.message}</p></div></div>}
        {showCoreCongrats && <div className={styles.interactionCongratsBackdrop}><section className={`${styles.interactionCongrats} ${styles.coreCongrats}`} role="dialog" aria-modal="true" aria-label="Hoàn thành phân loại"><MiniTitle>HOÀN THÀNH PHÂN LOẠI</MiniTitle><h2>Chúc mừng!</h2><p>Bạn đã tách chính xác phần lõi dùng chung và phần đặc thù theo ứng dụng.</p><button type="button" onClick={() => setShowCoreCongrats(false)}>Xem kết quả đúng</button></section></div>}
      </div></Shell>;
    case 19:
      return <Shell motion={19}><div className={styles.frameworkHero}><span>Framework</span><div className={styles.goldRule} /><h1>AI Business Framework</h1><p>Một bộ quy tắc để AI luôn xây ứng dụng theo cùng một tiêu chuẩn.</p></div></Shell>;
    case 20:
      return <Shell motion={20}><Title>Lõi có thể tái sử dụng</Title><p className={styles.subtitle}>Khi tách được phần dùng chung, AI không cần bắt đầu từ một trang trắng.</p><div className={styles.coreFlow}>{["Kiến trúc hệ thống", "Tiêu chuẩn giao diện người dùng", "Quy tắc viết code", "Quy tắc thiết kế cơ sở dữ liệu", "Kiểm thử", "Triển khai"].map((item, index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}>{item}</div>)}</div></Shell>;
    case 21:
      return <Shell dark motion={21}><div className={styles.gemDefinition}><MiniTitle>GEMINI GEMS</MiniTitle><Title>Gem là gì?</Title><p>Một phiên bản Gemini được tùy chỉnh để luôn làm theo các hướng dẫn và ngữ cảnh lặp lại.</p><em>Các nền tảng AI khác cũng có khái niệm tương tự, dù tên gọi khác nhau.</em></div></Shell>;
    case 22:
      return <Shell motion={22}><div className={styles.centerLight}><MiniTitle>GEM THỰC CHẤT LÀ GÌ?</MiniTitle><p>Không phải Code. Không phải Plugin.</p><h2>Mà là một bộ hướng dẫn để AI luôn làm đúng.</h2></div></Shell>;
    case 23:
      return <Shell motion={23}><Title>Framework và Gem</Title><div className={styles.frameworkGem}>
        <div><MiniTitle>AI BUSINESS FRAMEWORK</MiniTitle><h2>Nội dung tiêu chuẩn</h2><p>Kiến trúc hệ thống, giao diện người dùng (UI), mã nguồn, cơ sở dữ liệu, bảo mật, kiểm thử và quy trình triển khai vận hành.</p></div>
        <div className={styles.arrowLarge}>→</div>
        <div className={styles.navyCard}><MiniTitle>GEM</MiniTitle><h2>Cách đóng gói</h2><p>Instructions và Knowledge định hướng Gemini áp dụng chính xác Framework khi tiếp nhận yêu cầu dự án mới.</p></div>
      </div></Shell>;
    case 24:
      return <Shell motion={24}><Title>Bên trong một Gem</Title><div className={styles.gemGrid}>{[["NAME","Tên và mục đích"],["INSTRUCTIONS","Vai trò và quy tắc"],["KNOWLEDGE","Tài liệu tham chiếu"],["PREVIEW","Kiểm thử trước khi lưu"]].map(([head,body], index) => <div className={index === 1 ? styles.navyCard : ""} key={head}><MiniTitle>{head}</MiniTitle><strong>{body}</strong></div>)}</div></Shell>;
    case 25:
      return <Shell motion={25}><Title>Công thức Instructions cho Gem</Title><div className={styles.formula}>{["Persona", "Task", "Context", "Format"].map((item, index) => <div key={item} className={index % 2 === 0 ? styles.navyTile : ""}>{item}{index < 3 && <span>+</span>}</div>)}</div><div className={styles.frameworkBar}>+ AI Business Framework</div></Shell>;
    case 26:
      return <Shell motion={26}><Title>Ví dụ: Business Internal Web App Builder</Title><div className={styles.builderExample}><p>Yêu cầu mới: <strong>“Tạo hệ thống đặt phòng họp.”</strong></p><span>Gem tự áp dụng các tiêu chuẩn đã lưu:</span><div>{["Responsive UI", "Google Sheets Database", "Google Apps Script", "Validation", "Dashboard", "Deployment Guide"].map(item => <b key={item}>● {item}</b>)}</div></div></Shell>;
    case 27:
      return <Shell dark motion={27}><div className={styles.requirementTransition}><MiniTitle>Phần thay đổi chính</MiniTitle><h1>Requirement</h1><p>Framework giữ tiêu chuẩn chung. Ngoại lệ phải được mô tả rõ trong từng yêu cầu.</p></div></Shell>;
    case 28:
      return <Shell dark motion={28}><div className={styles.labCover}><MiniTitle>GEMINI GEMS</MiniTitle><h1>Lab 2</h1><p>Xây một Gem áp dụng AI Business Framework của doanh nghiệp.</p></div></Shell>;
    case 29:
      return <Shell motion={29}><Title>Lộ trình</Title><div className={`${styles.roadmap} ${styles.spiralRoadmap}`}>
        <svg className={styles.spiralTrack} viewBox="0 0 856 350" aria-hidden="true"><path d="M96 176 C96 45 760 42 760 180 C760 310 188 314 188 198 C188 108 650 108 650 193 C650 261 310 263 310 204 C310 157 544 157 544 203 C544 234 406 235 406 205" /></svg>
        <div className={styles.roadmapSpinner}>
          {["Phân tích 2 apps - Tách Framework", "Cài đặt Gem", "Xem trước - Kiểm thử", "Lưu & Chia sẻ"].map((item, index) => <div className={styles.roadmapOrbitCard} key={item}><b>{index + 1}</b><span>{item}</span></div>)}
        </div>
      </div></Shell>;
    case 30:
      return <Shell motion={30}><Title>Bước 1 · Phân tích, tách Framework, tạo Gem</Title><p className={styles.subtitle}>Bỏ source code của 2 app đã tạo vào Gemini, rồi yêu cầu:</p><Quote><p>{requirementPrompt}</p><button type="button" data-interactive="true" onClick={copyPrompt}>{copied ? "Đã copy" : "Copy Prompt"}</button></Quote><button type="button" data-interactive="true" className={styles.labFilesDownload} onClick={downloadLabFiles}><span aria-hidden="true">↓</span><span><strong>Tải bộ 3 file thực hành</strong><small>Gemini-Prompt.txt · App-01-Source.txt · App-02-Source.txt</small></span></button></Shell>;
    case 31:
      return <Shell motion={31}><Title>Ví dụ - Nguyên tắc thiết kế</Title><div className={styles.principles}>{["Responsive", "Có Dashboard", "Có giao diện dùng được cho điện thoại", "Kèm theo hướng dẫn", "Sử dụng Google Sheets", "Tách riêng HTML / CSS / JS"].map(item => <span key={item}>▪ {item}</span>)}</div><p className={styles.bottomNote}>...và các nguyên tắc riêng của doanh nghiệp bạn.</p></Shell>;
    case 32:
      return <Shell motion={32}><Title>Bước 2 - Tạo Gem trong Gemini</Title><div className={styles.screenshotPair}><div><Image src="/section2/gemini-step-001.png" alt="Mở mục Gems trong Gemini" fill sizes="240px" /><span className={`${styles.gemHighlight} ${styles.gemHighlightMenu}`} aria-hidden="true" /></div><div><Image src="/section2/gemini-step-000.png" alt="Gem manager và nút New Gem" fill sizes="650px" /><span className={`${styles.gemHighlight} ${styles.gemHighlightNew}`} aria-hidden="true" /></div></div></Shell>;
    case 33:
      return <Shell motion={33}><Title>Bước 2 - Tạo Gem trong Gemini</Title><div className={styles.gemSetupLayout}><div className={styles.tallScreenshot}><Image src="/section2/gemini-step-002.png" alt="Các trường cài đặt New Gem" fill sizes="420px" /></div><div className={styles.gemSetupCallout}><MiniTitle>GEM SETTINGS</MiniTitle><p>Tiến hành điền và upload các trường dữ liệu cần thiết từ hướng dẫn của Gemini.</p><div><span>01</span><strong>Name</strong></div><div><span>02</span><strong>Instructions</strong></div><div><span>03</span><strong>Knowledge files</strong></div></div></div></Shell>;
    case 34:
      return <Shell motion={34}><Title>Bước 3 - Xem trước và kiểm thử</Title><div className={styles.previewLayout}><div className={styles.previewShot}><Image src="/section2/gemini-step-003.png" alt="Cửa sổ Preview của Gem" fill sizes="360px" /></div><div><div className={styles.navyCard}><p>Chạy thử một Requirement mới. Kiểm tra Gem có hỏi đủ thông tin trước khi tạo code hay không.</p></div><Quote><p>Tạo cho tôi một App báo cáo nội bộ.</p></Quote></div></div></Shell>;
    case 35:
      return <Shell motion={35}><Title>Bước 4 - Lưu và chia sẻ</Title><div className={styles.saveFlow}>{[["SAVE","Lưu Gem sau khi Preview"],["SHARE","Chia sẻ Viewer hoặc Editor"],["USE","Mở New Chat và thử yêu cầu mới"]].map(([head,body], index) => <div className={index === 1 ? styles.navyCard : ""} key={head}><strong className={styles.saveFlowLabel}>{head}</strong><p>{body}</p>{index < 2 && <span>→</span>}</div>)}</div></Shell>;
    case 36:
      return <Shell motion={36}><Title>Thực hành với Gem vừa tạo</Title><div className={styles.practiceList}>{["Đặt xe công tác", "Đặt phòng họp", "Báo cáo sự cố", "Xin nghỉ phép", "Quản lý tài sản", "Đề xuất mua hàng", "Onboarding nhân sự", "Phê duyệt chi phí", "Theo dõi công việc"].map((item,index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</div>)}</div></Shell>;
    case 37:
      return <Shell dark motion={37}><div className={styles.finalMessage}><MiniTitle>Thông điệp cuối cùng</MiniTitle><p>Đừng xây <strong>100 ứng dụng.</strong></p><h1>Hãy xây 01 AI Business Framework</h1><div className={styles.goldRule} /><p>để AI có thể tạo 100 ứng dụng<br />theo tiêu chuẩn của doanh nghiệp.</p></div></Shell>;
    default:
      return <Shell />;
  }
}
