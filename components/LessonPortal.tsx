"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import type { LearnerProfile } from "@/lib/learnerProfileTypes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearSlideInteractionStorage } from "@/lib/slideStorage";
import styles from "./LessonPortal.module.css";

const SectionOneDeck = dynamic(() => import("./PdfDeck"), { ssr: false });
const SectionTwoDeck = dynamic(() => import("./section2/SectionTwoDeck"), { ssr: false });

type SectionId = "section1" | "section2";
type TerminateStatus = "idle" | "sending" | "success" | "error";
type ReportStatus = "idle" | "exporting" | "error";
type ReportSectionOption = { value: string; label: string };

interface PresenceCounts {
  section1: number;
  section2: number;
  total: number;
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatVNDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("eiu_client_id");
    if (!id) {
      id = "c_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now().toString(36);
      sessionStorage.setItem("eiu_client_id", id);
    }
    return id;
  } catch {
    return "c_fallback_" + Math.random().toString(36).slice(2, 8);
  }
}

function ActiveUsersTaskbarWidget({
  counts,
  currentSection,
}: {
  counts: PresenceCounts;
  currentSection?: SectionId | null;
}) {
  const activeCount =
    currentSection === "section1"
      ? counts.section1
      : currentSection === "section2"
        ? counts.section2
        : counts.total;

  const prevCountRef = useRef<number>(activeCount);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    if (prevCountRef.current !== activeCount) {
      prevCountRef.current = activeCount;
      setIsChanging(true);
      const timer = window.setTimeout(() => setIsChanging(false), 700);
      return () => window.clearTimeout(timer);
    }
  }, [activeCount]);

  const sectionLabel =
    currentSection === "section1"
      ? "Section 1"
      : currentSection === "section2"
        ? "Section 2"
        : "Online";

  return (
    <div
      className={`${styles.activeUsersWidget} ${isChanging ? styles.widgetPulsing : ""}`}
      title={`${activeCount} người đang học ${sectionLabel}`}
      aria-label={`Số người đang học ${sectionLabel}`}
    >
      <span className={styles.liveDot} aria-hidden="true" />
      <span className={styles.liveSectionLabel}>{sectionLabel}</span>
      <span className={styles.liveUsersDivider}>·</span>
      <strong
        key={activeCount}
        className={`${styles.activeUsersCount} ${isChanging ? styles.countPopAnim : ""}`}
      >
        {activeCount}
      </strong>
      <span className={styles.liveUsersUnit}>users</span>
    </div>
  );
}

function DeckShell({
  children,
  isAdmin,
  presenceCounts,
  currentSection,
  statusNotice,
  onChooseSection,
  onOpenTerminate,
  onSignOut,
}: {
  children: ReactNode;
  isAdmin: boolean;
  presenceCounts: PresenceCounts;
  currentSection?: SectionId | null;
  statusNotice?: string;
  onChooseSection?: () => void;
  onOpenTerminate?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className={styles.lessonShell}>
      <div className={styles.deckViewport}>{children}</div>

      <aside className={styles.actionBar} aria-label="Session controls">
        <div className={styles.actionBarIdentity} aria-live="polite">
          <span>EIU · APPLIED AGENTIC AI</span>
          <strong>
            {statusNotice || (isAdmin ? "Admin mode" : "Learning session")}
          </strong>
        </div>

        {isAdmin && presenceCounts && (
          <ActiveUsersTaskbarWidget
            counts={presenceCounts}
            currentSection={currentSection}
          />
        )}

        <div className={styles.actionBarButtons}>
          {isAdmin && (
            <Link href="/admin/access">
              Quản lý quyền
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/ai"
              className={styles.aiButton}
            >
              ✦ AI Knowledge
            </Link>
          )}
          {isAdmin && onChooseSection && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onChooseSection}
            >
              Sections
            </button>
          )}

          {isAdmin && onOpenTerminate && (
            <button
              type="button"
              className={styles.terminateBtn}
              onClick={onOpenTerminate}
            >
              Terminate Section
            </button>
          )}

          <button
            type="button"
            className={styles.signOutButton}
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function LessonPortal({
  isAdmin,
  allowedSections,
  initialSection,
  initialProfile,
}: {
  isAdmin: boolean;
  allowedSections: SectionId[];
  initialSection: SectionId | null;
  initialProfile: LearnerProfile | null;
}) {
  const [adminSection, setAdminSection] = useState<SectionId | null>(initialSection);
  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateStatus, setTerminateStatus] =
    useState<TerminateStatus>("idle");
  const [terminateNotice, setTerminateNotice] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const [reportNotice, setReportNotice] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<"today" | "custom" | "all">("today");
  const [exportCustomDate, setExportCustomDate] = useState(() => getTodayDateString());
  const [exportSection, setExportSection] = useState("all");
  const [reportSections, setReportSections] = useState<ReportSectionOption[]>([
    { value: "section1", label: "Section 1" },
    { value: "section2", label: "Section 2" },
  ]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSection, setResetSection] = useState("section1");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [resetNotice, setResetNotice] = useState("");
  const learnerProfile = initialProfile;
  const [deckSessionKey, setDeckSessionKey] = useState(0);
  const section = adminSection;
  const resetSectionLabel =
    resetSection === "all"
      ? "tất cả Section"
      : reportSections.find((option) => option.value === resetSection)?.label || resetSection;

  const [presenceCounts, setPresenceCounts] = useState<PresenceCounts>({
    section1: 0,
    section2: 0,
    total: 0,
  });

  useEffect(() => {
    if (!isAdmin || (!showExportModal && !showResetModal)) return;
    let disposed = false;

    async function loadReportSections() {
      try {
        const response = await fetch("/api/admin/report?mode=sections", { cache: "no-store" });
        const payload = (await response.json()) as {
          success?: boolean;
          sections?: ReportSectionOption[];
        };
        if (!response.ok || !payload.success || !Array.isArray(payload.sections)) return;
        if (disposed) return;
        setReportSections(payload.sections);
        setExportSection((current) =>
          current === "all" || payload.sections?.some((section) => section.value === current)
            ? current
            : "all"
        );
        setResetSection((current) =>
          current === "all" || payload.sections?.some((section) => section.value === current)
            ? current
            : payload.sections?.[0]?.value || "all"
        );
      } catch {
        // Keep the current Section 1/2 fallback if metadata cannot be loaded.
      }
    }

    void loadReportSections();
    return () => {
      disposed = true;
    };
  }, [isAdmin, showExportModal, showResetModal]);

  // Presence is refreshed by Supabase Realtime signals, with a slow fallback
  // for expired tabs that cannot send a pagehide beacon.
  useEffect(() => {
    if (!isAdmin) return;

    let disposed = false;
    let refreshTimer: number | undefined;

    async function fetchCounts() {
      if (disposed) return;
      try {
        const response = await fetch("/api/presence", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          success?: boolean;
          counts?: PresenceCounts;
        };
        if (payload.success && payload.counts) {
          setPresenceCounts(payload.counts);
        }
      } catch {
        // Ignore network glitches
      }
    }

    void fetchCounts();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel("eiu:presence")
      .on("broadcast", { event: "presence_changed" }, () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void fetchCounts(), 150);
      })
      .subscribe();
    const interval = window.setInterval(() => void fetchCounts(), 15_000);

    return () => {
      disposed = true;
      window.clearTimeout(refreshTimer);
      window.clearInterval(interval);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Learner heartbeat tracking
  useEffect(() => {
    if (isAdmin || !learnerProfile || !section) return;

    const clientId = getOrCreateClientId();
    let disposed = false;

    async function sendHeartbeat() {
      if (disposed) return;
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", section, clientId }),
      }).catch(() => undefined);
    }

    void sendHeartbeat();
    const heartbeatTimer = window.setInterval(() => void sendHeartbeat(), 10_000);

    const onLeave = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/presence",
          JSON.stringify({ action: "leave", section, clientId })
        );
      }
    };

    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      disposed = true;
      clearInterval(heartbeatTimer);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      onLeave();
    };
  }, [isAdmin, learnerProfile, section]);

  async function exportReport() {
    if (!isAdmin || reportStatus === "exporting") return;
    setReportStatus("exporting");
    setReportNotice("");

    const todayStr = getTodayDateString();
    let dateParam = "all";
    if (exportRange === "today") {
      dateParam = todayStr;
    } else if (exportRange === "custom") {
      dateParam = exportCustomDate || todayStr;
    }

    const tzOffset = new Date().getTimezoneOffset();

    try {
      const response = await fetch(
        `/api/admin/report?date=${encodeURIComponent(dateParam)}&tzOffset=${encodeURIComponent(tzOffset)}&section=${encodeURIComponent(exportSection)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Không thể xuất report.");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        ?? `eiu-interactive-report-${exportSection}-${dateParam}.xlsx`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setReportStatus("idle");
      setShowExportModal(false);
    } catch (error) {
      setReportStatus("error");
      setReportNotice(error instanceof Error ? error.message : "Không thể xuất report.");
    }
  }

  async function signOut() {
    if (!isAdmin && section) {
      const clientId = getOrCreateClientId();
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", section, clientId }),
      }).catch(() => undefined);
    }
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login");
  }

  async function resetAllData(event: FormEvent) {
    event.preventDefault();
    if (!isAdmin || resetStatus === "sending") return;

    if (!resetPassword.trim()) {
      setResetStatus("error");
      setResetNotice("Vui lòng nhập RESET để xác nhận.");
      return;
    }

    setResetStatus("sending");
    setResetNotice("");

    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword.trim(),
          section: resetSection,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Nội dung xác nhận không đúng.");
      }

      setResetStatus("success");
      setResetNotice(payload.message || `Đã xóa dữ liệu của ${resetSectionLabel} thành công.`);
      if (resetSection === "all") {
        clearSlideInteractionStorage();
      } else if (resetSection === "section1" || resetSection === "section2") {
        clearSlideInteractionStorage(resetSection);
      }
      setResetPassword("");
      setTimeout(() => {
        setShowResetModal(false);
        setResetStatus("idle");
        setResetNotice("");
      }, 1600);
    } catch (error) {
      setResetStatus("error");
      setResetNotice(error instanceof Error ? error.message : "Lỗi khi reset dữ liệu.");
    }
  }

  async function terminateSection() {
    if (!isAdmin || !section || terminateStatus === "sending") return;

    setTerminateStatus("sending");
    setTerminateNotice("");

    try {
      const response = await fetch("/api/section-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate", section }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "Failed to terminate section.");
      }

      setTerminateStatus("success");
      setTerminateNotice(
        `${section === "section1" ? "Section 1" : "Section 2"} đã kết thúc. Dữ liệu trên slide đã được làm mới và users đang được chuyển về đăng nhập.`
      );
      clearSlideInteractionStorage(section);
      setDeckSessionKey((current) => current + 1);
      setShowTerminate(false);
    } catch (error) {
      setTerminateStatus("error");
      setTerminateNotice(
        error instanceof Error ? error.message : "Failed to terminate section."
      );
    }
  }

  async function chooseSection(nextSection: SectionId) {
    const response = await fetch("/api/session/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: nextSection }),
    });
    if (response.ok) setAdminSection(nextSection);
  }

  // Admin section termination polling listener
  useEffect(() => {
    if (isAdmin || !section) return;

    let disposed = false;
    let initialToken: string | null = null;
    let isInitialized = false;

    async function checkTermination() {
      if (disposed) return;
      try {
        const response = await fetch(`/api/section-control?section=${section}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          success?: boolean;
          terminationToken?: string;
        };

        if (payload.success) {
          const currentToken = payload.terminationToken ?? null;
          if (!isInitialized) {
            initialToken = currentToken;
            isInitialized = true;
          } else if (currentToken && currentToken !== initialToken) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace("/login");
          }
        }
      } catch {
        // Ignore network glitches
      }
    }

    void checkTermination();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(`eiu:section:${section}`)
      .on("broadcast", { event: "section_terminated" }, (payload) => {
        const targetSection = (payload.payload as { section?: string })?.section;
        if (targetSection === section) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace("/login");
        }
      })
      .subscribe();

    const timer = window.setInterval(() => void checkTermination(), 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkTermination();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [isAdmin, learnerProfile, section]);

  if (!section) {
    return (
      <main className={styles.portal}>
        <div className={styles.grid} aria-hidden="true" />

        <div className={styles.selectorActions}>
          {isAdmin && <Link href="/admin/access">Quản lý quyền</Link>}
          {isAdmin && <Link href="/admin/ai" className={styles.aiButton}>✦ AI Knowledge</Link>}
          {isAdmin && (
            <button
              type="button"
              className={styles.reportButton}
              onClick={() => {
                setReportNotice("");
                setShowExportModal(true);
              }}
              disabled={reportStatus === "exporting"}
            >
              {reportStatus === "exporting" ? "Đang xuất…" : "Xuất report Excel"}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={styles.resetDataButton}
              onClick={() => {
                setResetPassword("");
                setResetStatus("idle");
                setResetNotice("");
                setShowResetModal(true);
              }}
            >
              Reset dữ liệu
            </button>
          )}
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>

        <section className={styles.panel}>
          <div className={styles.brand}>
            <div className={styles.logoWindow}>
              <Image
                src="/branding/EIU-logo-white.png"
                alt="EIU"
                width={2048}
                height={2048}
                priority
                unoptimized
              />
            </div>
            <div>
              <span>{isAdmin ? "ADMIN ACCESS" : "MY COURSE"}</span>
              <strong>EIU - Applied Agentic AI</strong>
            </div>
          </div>

          <div className={styles.heading}>
            <span>APPLIED AGENTIC AI</span>
            <h1>Chọn nội dung bạn muốn học</h1>
            <p>Bạn chỉ thấy những section đã được quản trị viên cấp quyền.</p>
            {reportStatus === "error" && reportNotice && (
              <p className={styles.reportError} role="alert">{reportNotice}</p>
            )}
          </div>

          <div className={styles.cards}>
            {allowedSections.includes("section1") && (
              <button type="button" onClick={() => void chooseSection("section1")}>
                <span>SECTION 1</span>
                <strong>Từ Prompt đến Web App</strong>
                <small>41 slide · PDF + HTML interactive</small>
                {isAdmin && <div className={styles.cardLiveUsers}>
                  <span className={styles.liveDot} />
                  <span>{presenceCounts.section1} users đang học</span>
                </div>}
                <i>→</i>
              </button>
            )}
            {allowedSections.includes("section2") && (
              <button type="button" onClick={() => void chooseSection("section2")}>
                <span>SECTION 2</span>
                <strong>Từ Prompt đến AI Business Framework</strong>
                <small>37 slide · HTML/CSS/React</small>
                {isAdmin && <div className={styles.cardLiveUsers}>
                  <span className={styles.liveDot} />
                  <span>{presenceCounts.section2} users đang học</span>
                </div>}
                <i>→</i>
              </button>
            )}
          </div>
        </section>

        {isAdmin && showExportModal && (
          <div
            className={styles.modalLayer}
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && reportStatus !== "exporting") {
                setShowExportModal(false);
              }
            }}
          >
            <section
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-report-title"
            >
              <span>BÁO CÁO THỐNG KÊ</span>
              <h2 id="export-report-title">Xuất báo cáo Excel</h2>
              <p>
                Chọn Section và phạm vi thời gian cần đưa vào báo cáo.
              </p>

              <label className={styles.exportSectionField}>
                <span>Phạm vi Section</span>
                <select
                  value={exportSection}
                  onChange={(event) => setExportSection(event.target.value)}
                  disabled={reportStatus === "exporting"}
                >
                  <option value="all">Tất cả Section</option>
                  {reportSections.map((sectionOption) => (
                    <option key={sectionOption.value} value={sectionOption.value}>
                      {sectionOption.label}
                    </option>
                  ))}
                </select>
                <small>Section mới sẽ tự xuất hiện khi được thêm vào hệ thống.</small>
              </label>

              <div className={styles.exportOptions}>
                <label
                  className={`${styles.exportOption} ${
                    exportRange === "today" ? styles.exportOptionActive : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="exportRange"
                    value="today"
                    checked={exportRange === "today"}
                    onChange={() => setExportRange("today")}
                  />
                  <div className={styles.exportOptionContent}>
                    <strong>Hôm nay ({formatVNDate(getTodayDateString())})</strong>
                    <small>Chỉ xuất học viên &amp; dữ liệu tham gia trong ngày hôm nay</small>
                  </div>
                </label>

                <label
                  className={`${styles.exportOption} ${
                    exportRange === "custom" ? styles.exportOptionActive : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="exportRange"
                    value="custom"
                    checked={exportRange === "custom"}
                    onChange={() => setExportRange("custom")}
                  />
                  <div className={styles.exportOptionContent}>
                    <strong>Theo ngày cụ thể</strong>
                    <small>Chọn ngày tổ chức lớp học bạn muốn xuất dữ liệu</small>
                    {exportRange === "custom" && (
                      <input
                        type="date"
                        className={styles.exportDateInput}
                        value={exportCustomDate}
                        onChange={(e) => setExportCustomDate(e.target.value)}
                      />
                    )}
                  </div>
                </label>

                <label
                  className={`${styles.exportOption} ${
                    exportRange === "all" ? styles.exportOptionActive : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="exportRange"
                    value="all"
                    checked={exportRange === "all"}
                    onChange={() => setExportRange("all")}
                  />
                  <div className={styles.exportOptionContent}>
                    <strong>Tất cả thời gian</strong>
                    <small>Xuất toàn bộ lịch sử học viên từ trước đến nay</small>
                  </div>
                </label>
              </div>

              {reportStatus === "error" && reportNotice && (
                <p className={styles.reportError} role="alert">
                  {reportNotice}
                </p>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowExportModal(false)}
                  disabled={reportStatus === "exporting"}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className={styles.confirmReportButton}
                  onClick={() => void exportReport()}
                  disabled={reportStatus === "exporting"}
                >
                  {reportStatus === "exporting" ? "Đang xuất file…" : "Tải file Excel"}
                </button>
              </div>
            </section>
          </div>
        )}

        {isAdmin && showResetModal && (
          <div
            className={styles.modalLayer}
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && resetStatus !== "sending") {
                setShowResetModal(false);
              }
            }}
          >
            <form
              className={styles.modal}
              onSubmit={resetAllData}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-modal-title"
            >
              <span className={styles.dangerEyebrow}>NGUY HIỂM · THAO TÁC QUẢN TRỊ</span>
              <h2 id="reset-modal-title">
                {resetSection === "all" ? "Reset toàn bộ dữ liệu?" : `Reset ${resetSectionLabel}?`}
              </h2>

              <label className={styles.exportSectionField}>
                <span>Phạm vi reset</span>
                <select
                  value={resetSection}
                  onChange={(event) => {
                    setResetSection(event.target.value);
                    if (resetStatus === "error") setResetNotice("");
                  }}
                  disabled={resetStatus === "sending" || resetStatus === "success"}
                >
                  {reportSections.map((sectionOption) => (
                    <option key={sectionOption.value} value={sectionOption.value}>
                      {sectionOption.label}
                    </option>
                  ))}
                  <option value="all">Tất cả Section</option>
                </select>
                <small>Section mới sẽ tự xuất hiện khi được thêm vào hệ thống.</small>
              </label>

              <div className={styles.dangerWarningBox}>
                <strong>Cảnh báo không thể hoàn tác:</strong>
                Thao tác này sẽ xóa vĩnh viễn dữ liệu của {resetSectionLabel} trên Supabase,
                bao gồm: Hồ sơ học viên, Ý tưởng, Showcase, Kết quả Quiz, Feedback và các
                phiên đăng nhập.
              </div>

              <label className={styles.resetPasswordField}>
                <span>Nhập RESET để xác nhận thao tác</span>
                <input
                  type="text"
                  className={styles.resetPasswordInput}
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    if (resetStatus === "error") setResetNotice("");
                  }}
                  placeholder="RESET"
                  autoFocus
                  required
                />
              </label>

              {resetStatus === "error" && resetNotice && (
                <p className={styles.resetErrorNotice} role="alert">
                  {resetNotice}
                </p>
              )}

              {resetStatus === "success" && resetNotice && (
                <p className={styles.resetSuccessNotice} role="status">
                  ✓ {resetNotice}
                </p>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowResetModal(false)}
                  disabled={resetStatus === "sending"}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={styles.confirmResetButton}
                  disabled={resetStatus === "sending" || resetStatus === "success"}
                >
                  {resetStatus === "sending"
                    ? "Đang xóa dữ liệu…"
                    : resetSection === "all"
                      ? "Xóa tất cả dữ liệu"
                      : `Xóa ${resetSectionLabel}`}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    );
  }

  return (
    <>
      <DeckShell
        isAdmin={isAdmin}
        presenceCounts={presenceCounts}
        currentSection={section}
        statusNotice={isAdmin ? terminateNotice : undefined}
        onChooseSection={() => setAdminSection(null)}
        onOpenTerminate={
          isAdmin
            ? () => {
                setTerminateStatus("idle");
                setTerminateNotice("");
                setShowTerminate(true);
              }
            : undefined
        }
        onSignOut={signOut}
      >
        {section === "section2" ? (
          <SectionTwoDeck key={`${section}-${deckSessionKey}`} isAdmin={isAdmin} />
        ) : (
          <SectionOneDeck key={`${section}-${deckSessionKey}`} isAdmin={isAdmin} />
        )}
      </DeckShell>

      {isAdmin && section && showTerminate && (
        <div
          className={styles.modalLayer}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.currentTarget === event.target &&
              terminateStatus !== "sending"
            ) {
              setShowTerminate(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terminate-title"
          >
            <span>ADMIN ACTION</span>
            <h2 id="terminate-title">Terminate current section?</h2>
            <p>
              Users đang truy cập Section này sẽ được đưa về màn hình đăng nhập.
            </p>
            {terminateStatus === "error" && terminateNotice && (
              <p role="alert">{terminateNotice}</p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowTerminate(false)}
                disabled={terminateStatus === "sending"}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmTerminateButton}
                onClick={() => void terminateSection()}
                disabled={terminateStatus === "sending"}
              >
                {terminateStatus === "sending" ? "Terminating..." : "Terminate"}
              </button>
            </div>
          </section>
        </div>
      )}

    </>
  );
}
