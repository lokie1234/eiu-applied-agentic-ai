"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { SLIDE_STORAGE_KEYS, getSlideStorage, setSlideStorage } from "@/lib/slideStorage";
import SlideTwentyEightEmergency from "./SlideTwentyEightEmergency";
import SlideThirtyFiveDynamicDashboard from "./SlideThirtyFiveDynamicDashboard";
import styles from "./SectionTwoSlide.module.css";

type Props = { pageNumber: number; isFinalState?: boolean };

type MotionPage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38;

const requirementPrompt = `Đọc cả 3 file đính kèm, phân tích 2 app mẫu và xuất kết quả theo đúng quy định trong Gemini-Prompt.txt, tuyệt đối không yêu cầu kết nối Workspace.
`;

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

const USER_ITEMS = ["Nhân viên", "Bộ phận giám sát an toàn", "Quản lý", "Ban giám đốc"] as const;

const REPORT_EXAMPLES: Record<(typeof REPORT_ITEMS)[number], { value: string; note: string; bars: readonly number[]; chart: "kpi" | "donut" | "horizontal" | "status" | "line" | "gauge" }> = {
  "Tổng số sự cố": { value: "128", note: "+12 trong tháng này", bars: [38, 52, 47, 69, 76], chart: "kpi" },
  "Theo mức độ": { value: "12", note: "sự cố nghiêm trọng", bars: [72, 48, 28, 19, 12], chart: "donut" },
  "Theo phòng ban": { value: "36", note: "cao nhất: Vận hành", bars: [32, 58, 43, 76, 51], chart: "horizontal" },
  "Theo trạng thái": { value: "84%", note: "đã xử lý", bars: [24, 36, 53, 68, 84], chart: "status" },
  "Theo thời gian": { value: "+18%", note: "so với tháng trước", bars: [31, 39, 45, 57, 73], chart: "line" },
  "Thời gian xử lý": { value: "4,2 giờ", note: "trung bình mỗi sự cố", bars: [78, 63, 55, 47, 39], chart: "gauge" },
};

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

const DEMO_DEPARTMENTS = [
  "Phòng Vận hành",
  "Phòng Kỹ thuật",
  "Phòng Hành chính",
  "Phòng Nhân sự",
  "Phòng Kế toán",
  "Phòng Sản xuất",
] as const;

const DEMO_INCIDENT_SAMPLES = [
  {
    location: "Khu vực kho A",
    issue: "Sàn trơn gần lối đi chính, có nguy cơ gây trượt ngã.",
  },
  {
    location: "Tầng 2 - Phòng Server",
    issue: "Điều hòa rò rỉ nước ngưng tụ trên trần, gần tủ rack.",
  },
  {
    location: "Sảnh B - Lối thoát hiểm",
    issue: "Đèn chiếu sáng sự cố khẩn cấp bị chập chờn.",
  },
  {
    location: "Kho B - Cửa số 3",
    issue: "Pallet xếp hàng quá cao, chắn lối đi xe nâng hàng.",
  },
  {
    location: "Phòng họp 302 - Tầng 3",
    issue: "Ổ cắm điện âm sàn bị lỏng, phát sinh tia lửa điện nhỏ.",
  },
  {
    location: "Xưởng sản xuất số 1",
    issue: "Băng chuyền số 2 phát tiếng rít lớn và kẹt bao bì.",
  },
  {
    location: "Khu vực Canteen - Tầng 1",
    issue: "Vòi nước bồn rửa tay bị rò rỉ làm đọng nước trên sàn.",
  },
  {
    location: "Bãi đỗ xe nội bộ",
    issue: "Camera giám sát góc Tây không gửi tín hiệu về trung tâm.",
  },
] as const;

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
        <div className={styles.heroEnergyArc} />
        <div className={styles.heroSignalField}>
          {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
        </div>
        <svg className={styles.heroNeuralField} viewBox="0 0 960 540" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sectionTwoNeuralSignal" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2d7fb4" stopOpacity="0" />
              <stop offset="45%" stopColor="#2d7fb4" stopOpacity=".7" />
              <stop offset="72%" stopColor="#e9ca8b" stopOpacity=".9" />
              <stop offset="100%" stopColor="#f4dfb0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className={styles.heroNeuralPaths}>
            <path d="M-24 438 C110 352 188 438 308 374 S510 270 636 322 S802 230 990 128" />
            <path d="M-30 112 C96 168 150 102 268 142 S438 226 548 154 S756 68 990 84" />
            <path d="M78 560 C118 466 84 382 178 326 S294 230 260 112 S342 10 418 -30" />
          </g>
          <g className={styles.heroNeuralNodes}>
            <circle cx="111" cy="383" r="4" /><circle cx="308" cy="374" r="5" />
            <circle cx="548" cy="154" r="4" /><circle cx="756" cy="72" r="5" />
            <circle cx="178" cy="326" r="5" /><circle cx="260" cy="112" r="4" />
          </g>
        </svg>
        <div className={styles.heroDataRain}>
          {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.ambientMotion} ${styles.strongAmbientMotion}`} aria-hidden="true">
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

function useSequentialReveal(total: number, initialFull = false, storageKey?: string) {
  const [revealedCount, setRevealedCount] = useState(() => {
    if (initialFull) return total;
    if (storageKey) {
      const saved = getSlideStorage(storageKey);
      if (saved === "complete" || saved === "true" || Number(saved) >= total) {
        return total;
      }
    }
    return 0;
  });
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (!isRevealing || revealedCount >= total) return;

    const timer = window.setTimeout(() => {
      const next = Math.min(revealedCount + 1, total);
      setRevealedCount(next);
      if (next === total) setIsRevealing(false);
    }, revealedCount === 0 ? 120 : 320);

    return () => window.clearTimeout(timer);
  }, [isRevealing, revealedCount, total]);

  return {
    revealedCount,
    isRevealing,
    isComplete: revealedCount === total,
    start: () => {
      if (storageKey) {
        setSlideStorage(storageKey, "complete");
      }
      setIsRevealing(true);
    },
  };
}

export default function SectionTwoSlide({ pageNumber, isFinalState = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeDataItems, setActiveDataItems] = useState<string[]>(isFinalState ? [...DATA_ITEMS] : []);
  const [showDataCongrats, setShowDataCongrats] = useState(false);
  const [activeReportItems, setActiveReportItems] = useState<string[]>(isFinalState ? [...REPORT_ITEMS] : []);
  const [showReportCongrats, setShowReportCongrats] = useState(false);
  const usersReveal = useSequentialReveal(USER_ITEMS.length, isFinalState, SLIDE_STORAGE_KEYS.s2_users);
  const workflowReveal = useSequentialReveal(WORKFLOW_STEPS.length, isFinalState, SLIDE_STORAGE_KEYS.s2_workflow);
  const [coreCommonItems, setCoreCommonItems] = useState<string[]>(() => {
    if (isFinalState || getSlideStorage(SLIDE_STORAGE_KEYS.s2_core) === "true") {
      return CORE_ITEMS.filter((item) => item.group === "common").map((item) => item.id);
    }
    return [];
  });
  const [coreSpecificItems, setCoreSpecificItems] = useState<string[]>(() => {
    if (isFinalState || getSlideStorage(SLIDE_STORAGE_KEYS.s2_core) === "true") {
      return CORE_ITEMS.filter((item) => item.group === "specific").map((item) => item.id);
    }
    return [];
  });
  const [sortingCoreItem, setSortingCoreItem] = useState<string | null>(null);
  const [coreAutoSorting, setCoreAutoSorting] = useState(false);
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
  const [demoRows, setDemoRows] = useState<DemoRow[]>(
    isFinalState
      ? [
          {
            id: "SC-001",
            reporter: "Nguyễn Minh Anh",
            department: "Phòng Vận hành",
            location: "Khu vực kho A",
            issue: "Sàn trơn gần lối đi chính, có nguy cơ gây trượt ngã.",
            severity: "ưu tiên",
            submittedAt: "14/09 · 09:30",
            status: "Đã duyệt",
            managerActionAt: "14/09 · 10:15",
          },
          {
            id: "SC-002",
            reporter: "Trần Quốc Bảo",
            department: "Phòng Kỹ thuật",
            location: "Tầng 2 - Phòng Server",
            issue: "Điều hòa rò rỉ nước ngưng tụ trên trần.",
            severity: "bình thường",
            submittedAt: "14/09 · 11:20",
            status: "Đã hoàn thành",
            completedAt: "14/09 · 14:00",
          },
          {
            id: "SC-003",
            reporter: "Lê Hoàng Yến",
            department: "Phòng Hành chính",
            location: "Sảnh B",
            issue: "Đèn chiếu sáng khu vực hành lang bị chập chờn.",
            severity: "bình thường",
            submittedAt: "14/09 · 13:45",
            status: "Đã nộp",
          },
        ]
      : []
  );
  const [demoFormMessage, setDemoFormMessage] = useState<string | null>(null);
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  const demoSequenceRef = useRef(1);
  const sampleIndexRef = useRef(0);
  const coreSortTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      coreSortTimersRef.current.forEach((timer) => window.clearTimeout(timer));
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

  function startCoreAutoSort() {
    if (coreAutoSorting || coreComplete) return;

    setSlideStorage(SLIDE_STORAGE_KEYS.s2_core, "true");
    setCoreAutoSorting(true);
    setCoreCommonItems([]);
    setCoreSpecificItems([]);
    coreSortTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    coreSortTimersRef.current = [];

    CORE_POOL_ORDER.forEach((itemId, index) => {
      const item = CORE_ITEMS.find((entry) => entry.id === itemId)!;
      const launchTimer = window.setTimeout(() => setSortingCoreItem(itemId), index * 620);
      const landTimer = window.setTimeout(() => {
        if (item.group === "common") setCoreCommonItems((current) => [...current, itemId]);
        else setCoreSpecificItems((current) => [...current, itemId]);
        setSortingCoreItem(null);

        if (index === CORE_POOL_ORDER.length - 1) {
          setCoreAutoSorting(false);
        }
      }, index * 620 + 520);
      coreSortTimersRef.current.push(launchTimer, landTimer);
    });
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

    const severity = demoForm.severity;
    if (!severity) {
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
      severity,
      submittedAt: getDemoTimestamp(),
      status: "Đã nộp",
    }]);
    setDemoFormMessage("Đã gửi sự cố sang hàng chờ của Quản lý.");
    sampleIndexRef.current = (sampleIndexRef.current + 1) % DEMO_INCIDENT_SAMPLES.length;
    const nextSample = DEMO_INCIDENT_SAMPLES[sampleIndexRef.current];
    setDemoForm((current) => ({
      ...current,
      location: nextSample.location,
      issue: nextSample.issue,
      severity: "",
    }));
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

  const coreComplete = coreCommonItems.length + coreSpecificItems.length === CORE_ITEMS.length;
  const selectedDataItems = DATA_ITEMS.filter((item) => activeDataItems.includes(item));
  const selectedReportItems = REPORT_ITEMS.filter((item) => activeReportItems.includes(item));
  const sortedTableRows = useMemo(() => {
    return [...demoRows].sort((a, b) => {
      const aIsPriority = a.severity === "ưu tiên";
      const bIsPriority = b.severity === "ưu tiên";
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;

      const aIndex = demoRows.indexOf(a);
      const bIndex = demoRows.indexOf(b);
      return bIndex - aIndex;
    });
  }, [demoRows]);

  switch (pageNumber) {
    case 1:
      return (
        <Shell dark motion={1}>
          <Image className={styles.coverLogo} src="/branding/eiu-logo-uploaded.png" alt="EIU - Eastern International University" width={180} height={50} sizes="180px" />
          <div className={styles.cover}>
            <h1 className={styles.coverTitle}>
              <span className={styles.coverPromptLine}>Từ thiết kế <strong>Prompt</strong></span>
              <span className={styles.coverFrameworkLine}>đến <strong>AI Business Framework</strong></span>
            </h1>
            <div className={styles.goldRule} />
          </div>
        </Shell>
      );
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
      return (
        <Shell motion={3}>
          <Title>Sau Section 2, bạn sẽ làm được</Title>
          <div className={styles.outcomeGrid}>
            <div>
              <div className={styles.outcomeCardTop}>
                <b>01</b>
              </div>
              <p className={styles.outcomeText}>
                Phân biệt <strong>thành phần chung</strong> và <strong>thành phần đặc thù</strong> của từng ứng dụng
              </p>
              <div className={styles.outcomeFootBar} />
            </div>

            <div className={styles.outcomeCardHighlight}>
              <div className={styles.outcomeCardTop}>
                <b>02</b>
                <span className={styles.outcomeHighlightTag}>✦ TRỌNG TÂM</span>
              </div>
              <p className={styles.outcomeText}>
                Xây <strong>AI Framework</strong>, đóng gói thành <strong>Gem trong Gemini</strong>
              </p>
              <div className={styles.outcomeHighlightBar} />
            </div>
          </div>
        </Shell>
      );
    case 4:
      return <Shell dark motion={4}><div className={styles.centerStatement}><h2>AI phần lớn không làm sai.</h2><p>AI chỉ làm đúng theo yêu cầu mà bạn mô tả.</p></div></Shell>;
    case 5:
      return <Shell motion={5}><Title>Sai lầm phổ biến</Title><div className={styles.mistakeLayout}><div className={styles.mistakeBox}>“Tạo giúp tôi một app quản lý.”</div><div className={styles.questionPanel}><p className={styles.leadSmall}>AI sẽ phải tự đoán:</p><div className={styles.questionGrid}>{["Quản lý cái gì?", "Có quy trình gì?", "Ai dùng?", "Lưu dữ liệu ở đâu?"].map(item => <span key={item}>{item}</span>)}</div></div></div></Shell>;
    case 6:
      return <Shell motion={6}><Title>“Yêu cầu” quyết định chất lượng đầu ra</Title><div className={styles.twoConcepts}>
        <div><h2>Prompt</h2><p>Chỉ là cách diễn đạt.</p></div><div className={styles.navyCard}><h2>Yêu cầu</h2><p>Mới là điều quyết định chất lượng ứng dụng.</p></div>
      </div></Shell>;
    case 7:
      return <Shell motion={9}><Title>Users</Title><p className={styles.subtitle}>Xác định: Ai sử dụng? Ai ra quyết định?</p><div className={styles.sectionRevealBar}>
        <button type="button" className={styles.sectionRevealButton} onClick={usersReveal.start} disabled={usersReveal.isRevealing || usersReveal.isComplete} data-interactive="true" aria-live="polite">
          {usersReveal.isComplete ? "Đã hiện đầy đủ 4 users" : usersReveal.isRevealing ? `Đang hiển thị ${usersReveal.revealedCount}/4` : "Hiển thị users"}
        </button>
      </div><div className={styles.userSequentialGrid} aria-label="Các nhóm người dùng">
        {USER_ITEMS.map((item, index) => {
          const isRevealed = index < usersReveal.revealedCount;
          return <article className={isRevealed ? styles.userSequentialCardVisible : ""} key={item}><i>{String(index + 1).padStart(2, "0")}</i><span aria-hidden={!isRevealed}>{item}</span><b aria-hidden="true">{isRevealed ? "✓" : ""}</b></article>;
        })}
      </div></Shell>;
    case 8:
      return <Shell motion={10}><div className={styles.workflowSequential} data-interactive="true">
        <div className={styles.workflowSequentialHead}>
          <Title>Quy trình làm việc</Title>
          <p>Hiển thị lần lượt 6 bước theo đúng thứ tự xử lý sự cố.</p>
        </div>
        <div className={styles.sectionRevealBar}>
          <button type="button" className={styles.sectionRevealButton} onClick={workflowReveal.start} disabled={workflowReveal.isRevealing || workflowReveal.isComplete} aria-live="polite">
            {workflowReveal.isComplete ? "Đã hiện đầy đủ 6 bước" : workflowReveal.isRevealing ? `Đang hiển thị ${workflowReveal.revealedCount}/6` : "Hiển thị quy trình"}
          </button>
        </div>
        <div className={styles.workflowSequentialGrid} aria-label="6 bước của quy trình làm việc">
          {WORKFLOW_STEPS.map((step, index) => {
            const isRevealed = index < workflowReveal.revealedCount;
            return <article className={isRevealed ? styles.workflowSequentialCardVisible : ""} key={step.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong aria-hidden={!isRevealed}>{step.label}</strong>
              <i aria-hidden="true">{isRevealed ? "✓" : ""}</i>
            </article>;
          })}
        </div>
      </div></Shell>;
    case 9:
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
    case 10:
      return <Shell motion={12}><Title>Quy tắc nghiệp vụ</Title><div className={styles.ruleGrid}>
        {["Không gửi khi thiếu mô tả hoặc mức độ", "Sự cố nghiêm trọng phải ưu tiên xử lý", "Chỉ người được giao hoặc quản trị viên được cập nhật", "Mỗi lần đổi trạng thái phải lưu thời gian"].map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}
      </div></Shell>;
    case 11:
      return (
        <Shell motion={13}>
          <div className={styles.acceptanceHeader}>
            <div>
              <MiniTitle>ACCEPTANCE CRITERIA</MiniTitle>
              <Title>Tiêu chí chấp nhận</Title>
            </div>
            <p>Mỗi tiêu chí phải kiểm tra được bằng một hành động cụ thể.</p>
          </div>
          <div className={styles.acceptanceGrid}>
            {[
              "Không thể nộp form nếu thiếu Mức độ",
              "Sau khi nộp, Google Sheets tự cập nhật",
              "Sự cố Nghiêm trọng luôn ở đầu danh sách",
              "Dashboard cập nhật sau khi tải lại dữ liệu",
            ].map((item, index) => (
              <article key={item} className={styles.acceptanceCard}>
                <div className={styles.acceptanceCardTop}>
                  <span className={styles.acceptanceNumber}>0{index + 1}</span>
                  <div className={styles.acceptanceCheck} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M13.33 4L6 11.33L2.67 8"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <p className={styles.acceptanceText}>{item}</p>
                <div className={styles.acceptanceFootLine} />
              </article>
            ))}
          </div>
        </Shell>
      );
    case 12:
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
              return <article className={styles[`dashboardChart${example.chart[0].toUpperCase()}${example.chart.slice(1)}`]} key={item}><span>{item}</span><strong>{example.value}</strong><small>{example.note}</small><div className={styles.dashboardChart} aria-hidden="true">{example.chart === "line" ? <svg viewBox="0 0 100 48"><polyline points={example.bars.map((height, index) => `${index * 25},${48 - height * .45}`).join(" ")} />{example.bars.map((height, index) => <circle key={`${item}-${index}`} cx={index * 25} cy={48 - height * .45} r="2.8" />)}</svg> : example.bars.map((height, index) => <i key={`${item}-${index}`} style={{ "--chart-level": `${height}%` } as CSSProperties} />)}</div></article>;
            })}
          </div>
          <footer><p>Dashboard đang hiển thị <strong>{selectedReportItems.length}</strong> chỉ số đã chọn.</p><button type="button" onClick={() => setShowReportCongrats(false)}>Quay lại chỉnh sửa</button></footer>
        </section></div>}
      </div></Shell>;
    case 13:
      return <Shell motion={15}><Title>Tổng hợp các yêu cầu</Title><div className={styles.requirementSummary}><strong>Ví dụ:</strong><p>Tạo một Web App báo cáo sự cố nội bộ đơn giản, giao diện responsive và dễ sử dụng.</p><ul>
        <li>Người dùng gồm: Nhân viên, Quản lý và Bộ phận an toàn.</li>
        <li>Nhân viên có thể báo cáo sự cố với: Người báo cáo, Phòng ban, Thời gian, Địa điểm, Mô tả và Mức độ.</li>
        <li>Workflow: (nhân viên) Báo cáo sự cố → (hệ thống) Phân loại → (Quản lý) Duyệt → Giao xử lý → (Bộ phận an toàn) Xác nhận hoàn tất → (hệ thống) Đóng sự cố.</li>
        <li>Mỗi sự cố lưu thông tin báo cáo, trạng thái và thời gian của mỗi lần thay đổi trạng thái.</li>
        <li>Không cho Submit nếu để trống Mức độ; sự cố nghiêm trọng phải được ưu tiên xử lý.</li>
        <li>Dashboard hiển thị tổng số sự cố, theo mức độ, phòng ban, trạng thái và thời gian xử lý.</li>
        <li>Dùng Google Apps Script + Google Sheets; ưu tiên code tối giản cho app demo nội bộ.</li>
      </ul></div></Shell>;
    case 14: {
      const submittedCount = demoRows.length;
      const approvedCount = demoRows.filter((row) => row.status === "Đã duyệt" || row.status === "Đã hoàn thành").length;
      const rejectedCount = demoRows.filter((row) => row.status === "Không duyệt").length;
      const completedCount = demoRows.filter((row) => row.status === "Đã hoàn thành").length;
      const managerQueue = demoRows.filter((row) => row.status === "Đã nộp");
      const safetyQueue = demoRows.filter((row) => row.status === "Đã duyệt");
      return <Shell motion={16}><div className={styles.workflowDemo} data-interactive="true">
        <div className={styles.workflowDemoHead}><Title>Demo </Title><p>Nhân viên gửi form → Quản lý duyệt / không duyệt → Bộ phận an toàn hoàn thành → Excel + Dashboard cập nhật ngay</p></div>
        <div className={styles.workflowDemoGrid}>
          <section className={`${styles.demoPanel} ${styles.demoFormPanel}`}>
            <header><b>01</b><div><MiniTitle>NHÂN VIÊN</MiniTitle><strong>Gửi báo cáo sự cố</strong></div></header>
            <form onSubmit={submitDemoForm}>
              <label>Người báo cáo<input value={demoForm.reporter} onChange={(event) => setDemoForm((current) => ({ ...current, reporter: event.target.value }))} /></label>
              <label>Phòng ban<select value={demoForm.department} onChange={(event) => setDemoForm((current) => ({ ...current, department: event.target.value }))}>{DEMO_DEPARTMENTS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}</select></label>
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
            {demoRows.length === 0 ? <p className={styles.demoEmpty}>Chưa có dòng dữ liệu. Hãy gửi form từ khung Nhân viên.</p> : <div className={styles.demoTableWrap}><table><thead><tr><th>Mã</th><th>Nhân viên</th><th>Sự cố</th><th>Mức độ</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{sortedTableRows.map((row) => <tr key={row.id} className={row.severity === "ưu tiên" ? styles.demoRowPriority : ""}><td>{row.id}</td><td>{row.reporter}</td><td title={`${row.department} · ${row.location} · ${row.issue}`}>{row.issue}</td><td><span className={row.severity === "ưu tiên" ? styles.demoSeverityPriority : styles.demoSeverityNormal}>{row.severity}</span></td><td><span className={row.status === "Đã hoàn thành" ? styles.demoStatusCompleted : row.status === "Đã duyệt" ? styles.demoStatusApproved : row.status === "Không duyệt" ? styles.demoStatusRejected : styles.demoStatusPending}>{row.status}</span></td><td title={row.rejectionReason ?? row.completedAt ?? row.submittedAt}>{row.rejectionReason ?? (row.completedAt ? `HT ${row.completedAt}` : row.submittedAt)}</td></tr>)}</tbody></table></div>}
          </section>

          <section className={`${styles.demoPanel} ${styles.demoDashboardPanel}`}>
            <header><b>05</b><div><MiniTitle>DASHBOARD</MiniTitle><strong>Theo dõi trạng thái tức thời</strong></div></header>
            <div className={styles.demoMetrics}><article><span>Đã nộp</span><strong>{submittedCount}</strong><i style={{ "--metric-level": `${Math.min(100, submittedCount * 24)}%` } as CSSProperties} /></article><article><span>Đã duyệt</span><strong>{approvedCount}</strong><i style={{ "--metric-level": `${demoRows.length ? Math.round((approvedCount / demoRows.length) * 100) : 0}%` } as CSSProperties} /></article><article><span>Không duyệt</span><strong>{rejectedCount}</strong><i style={{ "--metric-level": `${demoRows.length ? Math.round((rejectedCount / demoRows.length) * 100) : 0}%` } as CSSProperties} /></article><article><span>Đã hoàn thành</span><strong>{completedCount}</strong><i style={{ "--metric-level": `${demoRows.length ? Math.round((completedCount / demoRows.length) * 100) : 0}%` } as CSSProperties} /></article></div>
            <p>Tổng hồ sơ: <strong>{demoRows.length}</strong> </p>
          </section>
        </div>
      </div></Shell>;
    }
    case 15:
      return <Shell motion={17}><div className={styles.frameworkQuestion}><MiniTitle>AI BUSINESS FRAMEWORK</MiniTitle><Title>Tại sao phải làm lại từ đầu?</Title><p>Lần sau xây ứng dụng mới, bạn có muốn viết lại toàn bộ Prompt?</p></div></Shell>;
    case 16:
      return <Shell motion={18}><div className={`${styles.coreChallenge} ${coreComplete ? styles.coreChallengeComplete : ""}`} data-interactive="true">
        <div className={styles.coreChallengeHead}>
          <Title>Phần chung và phần đặc thù theo ứng dụng</Title>
          {!coreComplete && <div><button type="button" disabled={coreAutoSorting} onClick={startCoreAutoSort}>{coreAutoSorting ? "Đang phân loại…" : "Bắt đầu phân loại"}</button></div>}
        </div>
        <div className={styles.coreTargets}>
          {(["common", "specific"] as const).map((group) => {
            const placedIds = group === "common" ? coreCommonItems : coreSpecificItems;
            return <section className={`${styles.coreTarget} ${group === "common" ? styles.coreTargetCommon : styles.coreTargetSpecific}`} key={group} aria-label={`Nhóm ${group === "common" ? "dùng chung" : "thay đổi theo ứng dụng"}`}>
              <span className={styles.coreTargetLabel}>{group === "common" ? "DÙNG CHUNG" : "THAY ĐỔI THEO APP"}</span>
              <span className={styles.coreTargetSlots}>{placedIds.length === 0 ? <em>Đang chờ phân loại</em> : placedIds.map((id) => { const item = CORE_ITEMS.find((entry) => entry.id === id)!; return <span key={id}>{item.label}<i aria-hidden="true">✓</i></span>; })}</span>
            </section>;
          })}
        </div>
        {!coreComplete && <div className={styles.corePool} aria-label="Các thành phần cần phân loại">
          {CORE_POOL_ORDER.map((itemId, index) => {
            const item = CORE_ITEMS.find((entry) => entry.id === itemId)!;
            if (coreCommonItems.includes(itemId) || coreSpecificItems.includes(itemId)) return null;
            return <div key={item.id} className={`${styles.coreCard} ${styles[`coreCard${index + 1}`]} ${sortingCoreItem === item.id ? (item.group === "common" ? styles.coreCardSortingCommon : styles.coreCardSortingSpecific) : ""}`}><span aria-hidden="true">◆</span><strong>{item.label}</strong></div>;
          })}
        </div>}
      </div></Shell>;
    case 17:
      return <Shell motion={19}><div className={styles.frameworkHero}><span>Framework</span><div className={styles.goldRule} /><h1>AI Business Framework</h1><p>Một bộ quy tắc để AI luôn xây ứng dụng theo cùng một tiêu chuẩn.</p></div></Shell>;
    case 18:
      return <Shell motion={20}><Title>Phần có thể tái sử dụng</Title><p className={styles.subtitle}>Khi tách được phần dùng chung, AI không cần bắt đầu từ một trang trắng.</p><div className={styles.coreFlow}>{["Kiến trúc hệ thống", "Tiêu chuẩn giao diện người dùng", "Quy tắc viết code", "Quy tắc thiết kế cơ sở dữ liệu", "Kiểm thử", "Triển khai"].map((item, index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}>{item}</div>)}</div></Shell>;
    case 19:
      return <Shell dark motion={21}><div className={styles.gemDefinition}><MiniTitle>GEMINI GEMS</MiniTitle><Title>Gem là gì?</Title><p>Một phiên bản Gemini được tùy chỉnh để làm theo các hướng dẫn, ngữ cảnh lặp lại.</p><em>Các nền tảng AI khác cũng có khái niệm tương tự, dù tên gọi khác nhau.</em></div></Shell>;
    case 20:
      return <Shell motion={22}><div className={styles.centerLight}><MiniTitle>GEM THỰC CHẤT LÀ GÌ?</MiniTitle><p>Không phải Code. Không phải Plugin.</p><h2>Mà là một bộ hướng dẫn để AI luôn làm đúng.</h2></div></Shell>;
    case 21:
      return <Shell motion={23}><Title>Framework và Gem</Title><div className={styles.frameworkGem}>
        <div><MiniTitle>AI BUSINESS FRAMEWORK</MiniTitle><h2>Nội dung tiêu chuẩn</h2><p>Kiến trúc hệ thống, giao diện người dùng (UI), mã nguồn, cơ sở dữ liệu, bảo mật, kiểm thử và quy trình triển khai vận hành.</p></div>
        <div className={styles.arrowLarge}>→</div>
        <div className={styles.navyCard}><MiniTitle>GEM</MiniTitle><h2>Cách đóng gói</h2><p>Instructions và Knowledge định hướng Gemini áp dụng chính xác Framework khi tiếp nhận yêu cầu dự án mới.</p></div>
      </div></Shell>;
    case 22:
      return <Shell motion={24}><Title>Bên trong một Gem</Title><div className={styles.gemGrid}>{[["NAME","Tên và mục đích"],["INSTRUCTIONS","Vai trò và quy tắc"],["KNOWLEDGE","Tài liệu tham chiếu"],["PREVIEW","Kiểm thử trước khi lưu"]].map(([head,body], index) => <div className={index === 1 ? styles.navyCard : ""} key={head}><MiniTitle>{head}</MiniTitle><strong>{body}</strong></div>)}</div></Shell>;
    case 23:
      return <Shell motion={25}><Title>Công thức Instructions cho Gem</Title><div className={styles.formula}>{["Persona", "Task", "Context", "Format"].map((item, index) => <div key={item} className={index % 2 === 0 ? styles.navyTile : ""}>{item}{index < 3 && <span>+</span>}</div>)}</div><div className={styles.frameworkBar}>+ AI Business Framework</div></Shell>;
    case 24:
      return <Shell motion={26}><div className={styles.builderHeader}><MiniTitle>EIU · AI BUSINESS FRAMEWORK</MiniTitle><Title>Business Internal Web App Builder</Title></div><div className={styles.builderExample}><section><span>REQUIREMENT MỚI</span><p>“Tạo hệ thống đặt phòng họp.”</p><i aria-hidden="true">→</i></section><div><small>GEM TỰ ÁP DỤNG TIÊU CHUẨN</small><div>{["Responsive UI", "Google Sheets Database", "Google Apps Script", "Validation", "Dashboard", "Deployment Guide"].map((item, index) => <b key={item}><span>0{index + 1}</span>{item}<i aria-hidden="true">✓</i></b>)}</div></div></div></Shell>;
    case 25:
      return <Shell dark motion={27}><div className={styles.requirementTransition}><MiniTitle>Phần thay đổi chính</MiniTitle><h1>Requirement</h1><p>Framework giữ tiêu chuẩn chung. Ngoại lệ phải được mô tả rõ trong từng yêu cầu.</p></div></Shell>;
    case 26:
      return <Shell dark motion={28}><div className={styles.labCover}><MiniTitle>GEMINI GEMS</MiniTitle><h1>Lab 2</h1><p>Xây một Gem áp dụng AI Business Framework của doanh nghiệp.</p></div></Shell>;
    case 27:
      return (
        <Shell motion={29}>
          <div className={styles.roadmapHeader}>
            <MiniTitle>GEMINI GEMS · LAB 2</MiniTitle>
            <Title>Lộ trình</Title>
          </div>
          <div className={styles.roadmapGrid}>
            {[
              "Phân tích app, tách Framework, tạo Gem",
              "Cài đặt Gem",
              "Kiểm tra",
              "Lưu & Chia sẻ",
            ].map((item, index) => (
              <article key={item} className={styles.roadmapCard}>
                <div className={styles.roadmapCardTop}>
                  <div className={styles.roadmapBadgeWrap}>
                    <span className={styles.roadmapNumber}>0{index + 1}</span>
                    <span className={styles.roadmapStepTag}>BƯỚC 0{index + 1}</span>
                  </div>
                  <span className={styles.roadmapFlowArrow} aria-hidden="true">
                    {index < 3 ? "→" : "✓"}
                  </span>
                </div>
                <p className={styles.roadmapText}>{item}</p>
                <div className={styles.roadmapFootLine} />
              </article>
            ))}
          </div>
        </Shell>
      );
    case 28:
      return <Shell motion={30}><Title>Bước 1 · Phân tích, tách Framework, tạo Gem</Title><p className={styles.subtitle}>Bỏ bộ 3 file thực hành đã tạo sẵn vào Gemini, rồi yêu cầu:</p><Quote><p>{requirementPrompt}</p><button type="button" data-interactive="true" onClick={copyPrompt}>{copied ? "Đã copy" : "Copy Prompt"}</button></Quote><button type="button" data-interactive="true" className={styles.labFilesDownload} onClick={downloadLabFiles}><span aria-hidden="true">↓</span><span><strong>Tải bộ 3 file thực hành</strong><small>Gemini-Prompt.txt · App-01-Source.txt · App-02-Source.txt</small></span></button><SlideTwentyEightEmergency /></Shell>;
    case 29:
      return <Shell motion={31}><Title>Ví dụ - Nguyên tắc thiết kế</Title><div className={styles.principles}>{["Responsive", "Có Dashboard", "Có giao diện dùng được cho điện thoại", "Kèm theo hướng dẫn", "Sử dụng Google Sheets", "Tách riêng HTML / CSS / JS"].map(item => <span key={item}>▪ {item}</span>)}</div><p className={styles.bottomNote}>...và các nguyên tắc riêng của doanh nghiệp bạn.</p></Shell>;
    case 30:
      return <Shell motion={32}><Title>Bước 2 · Cài đặt Gem</Title><div className={styles.screenshotPair}><div><Image src="/section2/gemini-step-001.png" alt="Mở mục Gems trong Gemini" fill sizes="240px" /><span className={`${styles.gemHighlight} ${styles.gemHighlightMenu}`} aria-hidden="true" /></div><div><Image src="/section2/gemini-step-000.png" alt="Gem manager và nút New Gem" fill sizes="650px" /><span className={`${styles.gemHighlight} ${styles.gemHighlightNew}`} aria-hidden="true" /></div></div></Shell>;
    case 31:
      return <Shell motion={33}><Title>Bước 2 · Cài đặt Gem</Title><div className={styles.gemSetupLayout}><div className={styles.tallScreenshot}><Image src="/section2/gemini-step-002.png" alt="Các trường cài đặt New Gem" fill sizes="420px" /></div><div className={styles.gemSetupCallout}><MiniTitle>GEM SETTINGS</MiniTitle><p>Tiến hành điền và upload các trường dữ liệu cần thiết từ hướng dẫn của Gemini.</p><div><span>01</span><strong>Name</strong></div><div><span>02</span><strong>Instructions</strong></div><div><span>03</span><strong>Knowledge files</strong></div></div></div></Shell>;
    case 32:
      return <Shell motion={34}><Title>Tiến hành thử nghiệm với 1 prompt rút gọn</Title><p className={styles.condensedPromptLead}>Tạo app để...</p><div className={`${styles.practiceList} ${styles.condensedPromptPractice}`}>{["Đặt xe công tác", "Đặt phòng họp", "Báo cáo sự cố", "Xin nghỉ phép", "Quản lý tài sản", "Đề xuất mua hàng", "Onboarding nhân sự", "Phê duyệt chi phí", "Theo dõi công việc"].map((item,index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</div>)}</div><p className={styles.geminiInstructionNote}>Lưu ý: Phải làm theo đúng hướng dẫn mà Gemini đưa ra!</p></Shell>;
    case 33:
      return <Shell motion={35}><Title>Bước 4 - Lưu và chia sẻ</Title><div className={styles.saveFlow}>{[["SAVE","Lưu Gem sau khi kiểm tra"],["SHARE","Chia sẻ Viewer hoặc Editor"],["USE","Mở New Chat và thử yêu cầu mới"]].map(([head,body], index) => <div className={index === 1 ? styles.navyCard : ""} key={head}><strong className={styles.saveFlowLabel}>{head}</strong><p>{body}</p>{index < 2 && <span>→</span>}</div>)}</div></Shell>;
    case 34:
      return <Shell dark motion={37}><div className={styles.finalMessage}><MiniTitle>Thông điệp</MiniTitle><p>Đừng xây <strong>100 ứng dụng.</strong></p><h1>Hãy xây 01 AI Business Framework</h1><div className={styles.goldRule} /><p>để AI có thể tạo 100 ứng dụng<br />theo tiêu chuẩn của doanh nghiệp.</p></div></Shell>;
    case 35:
      return <Shell motion={38}><SlideThirtyFiveDynamicDashboard /></Shell>;
    default:
      return <Shell />;
  }
}
