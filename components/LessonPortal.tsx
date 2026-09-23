"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import type { AccessRole } from "@/lib/access";
import type { LearnerProfile } from "@/lib/learnerProfileTypes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./LessonPortal.module.css";

const SectionOneDeck = dynamic(() => import("./PdfDeck"), { ssr: false });
const SectionTwoDeck = dynamic(() => import("./section2/SectionTwoDeck"), { ssr: false });

type SectionId = "section1" | "section2";
type TerminateStatus = "idle" | "sending" | "success" | "error";
type ReportStatus = "idle" | "exporting" | "error";

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
  role,
  initialProfile,
}: {
  role: AccessRole;
  initialProfile: LearnerProfile | null;
}) {
  const [adminSection, setAdminSection] = useState<SectionId | null>(null);
  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateStatus, setTerminateStatus] =
    useState<TerminateStatus>("idle");
  const [terminateNotice, setTerminateNotice] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const [reportNotice, setReportNotice] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<"today" | "custom" | "all">("today");
  const [exportCustomDate, setExportCustomDate] = useState(() => getTodayDateString());
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [resetNotice, setResetNotice] = useState("");
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(initialProfile);
  const [profileName, setProfileName] = useState("");
  const [profileEmailLocalPart, setProfileEmailLocalPart] = useState("");
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "error">("idle");
  const [profileError, setProfileError] = useState("");
  const [deckSessionKey, setDeckSessionKey] = useState(0);
  const section = role === "admin" ? adminSection : role;

  const [presenceCounts, setPresenceCounts] = useState<PresenceCounts>({
    section1: 0,
    section2: 0,
    total: 0,
  });

  // Presence is refreshed by Supabase Realtime signals, with a slow fallback
  // for expired tabs that cannot send a pagehide beacon.
  useEffect(() => {
    if (role !== "admin") return;

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
  }, [role]);

  // Learner heartbeat tracking
  useEffect(() => {
    if (role === "admin" || !learnerProfile) return;

    const clientId = getOrCreateClientId();
    let disposed = false;

    async function sendHeartbeat() {
      if (disposed) return;
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", section: role, clientId }),
      }).catch(() => undefined);
    }

    void sendHeartbeat();
    const heartbeatTimer = window.setInterval(() => void sendHeartbeat(), 10_000);

    const onLeave = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/presence",
          JSON.stringify({ action: "leave", section: role, clientId })
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
  }, [role, learnerProfile]);

  async function exportReport() {
    if (role !== "admin" || reportStatus === "exporting") return;
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
        `/api/admin/report?date=${encodeURIComponent(dateParam)}&tzOffset=${encodeURIComponent(tzOffset)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Không thể xuất report.");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        ?? `eiu-interactive-report-${dateParam}.xlsx`;
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
    if (role !== "admin") {
      const clientId = getOrCreateClientId();
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", section: role, clientId }),
      }).catch(() => undefined);
    }
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login");
  }

  async function resetAllData(event: FormEvent) {
    event.preventDefault();
    if (role !== "admin" || resetStatus === "sending") return;

    if (!resetPassword.trim()) {
      setResetStatus("error");
      setResetNotice("Vui lòng nhập mật khẩu xác nhận.");
      return;
    }

    setResetStatus("sending");
    setResetNotice("");

    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword.trim() }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Mật khẩu xác thực không đúng.");
      }

      setResetStatus("success");
      setResetNotice("Đã xóa sạch toàn bộ dữ liệu trên Supabase thành công!");
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
    if (role !== "admin" || !section || terminateStatus === "sending") return;

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
      setDeckSessionKey((current) => current + 1);
      setShowTerminate(false);
    } catch (error) {
      setTerminateStatus("error");
      setTerminateNotice(
        error instanceof Error ? error.message : "Failed to terminate section."
      );
    }
  }

  async function saveLearnerProfile(event: FormEvent) {
    event.preventDefault();
    if (profileStatus === "saving") return;
    setProfileStatus("saving");
    setProfileError("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          email: `${profileEmailLocalPart.trim()}@eiu.edu.vn`,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Không thể lưu thông tin.");
      }

      setLearnerProfile(payload.profile);
      setProfileStatus("idle");
    } catch (error) {
      setProfileStatus("error");
      setProfileError(error instanceof Error ? error.message : "Không thể lưu thông tin.");
    }
  }

  // Admin section termination polling listener
  useEffect(() => {
    if (role === "admin") return;

    let disposed = false;
    let initialToken: string | null = null;
    let isInitialized = false;

    async function checkTermination() {
      if (disposed) return;
      try {
        const response = await fetch(`/api/section-control?section=${role}`, {
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
      ?.channel(`eiu:section:${role}`)
      .on("broadcast", { event: "section_terminated" }, (payload) => {
        const targetSection = (payload.payload as { section?: string })?.section;
        if (targetSection === role) {
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
  }, [role, learnerProfile]);

  if (role === "admin" && !section) {
    return (
      <main className={styles.portal}>
        <div className={styles.grid} aria-hidden="true" />

        <div className={styles.selectorActions}>
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
              <span>ADMIN ACCESS</span>
              <strong>EIU - Applied Agentic AI</strong>
            </div>
          </div>

          <div className={styles.heading}>
            <span>CHỌN NỘI DUNG</span>
            <h1>Bạn muốn mở Section nào?</h1>
            <p>Chuyển đổi giữa cả hai phần học.</p>
            {reportStatus === "error" && reportNotice && (
              <p className={styles.reportError} role="alert">{reportNotice}</p>
            )}
          </div>

          <div className={styles.cards}>
            <button type="button" onClick={() => setAdminSection("section1")}>
              <span>SECTION 1</span>
              <strong>Từ Prompt đến Web App</strong>
              <small>41 slide · PDF + HTML interactive</small>
              <div className={styles.cardLiveUsers}>
                <span className={styles.liveDot} />
                <span>{presenceCounts.section1} users đang học</span>
              </div>
              <i>→</i>
            </button>
            <button type="button" onClick={() => setAdminSection("section2")}>
              <span>SECTION 2</span>
              <strong>Từ Prompt đến AI Business Framework</strong>
              <small>36 slide · HTML/CSS/React</small>
              <div className={styles.cardLiveUsers}>
                <span className={styles.liveDot} />
                <span>{presenceCounts.section2} users đang học</span>
              </div>
              <i>→</i>
            </button>
          </div>
        </section>

        {showExportModal && (
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
                Chọn phạm vi thời gian để lọc danh sách học viên đăng nhập và tương tác trong buổi học.
              </p>

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

        {showResetModal && (
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
              <h2 id="reset-modal-title">Reset toàn bộ dữ liệu?</h2>

              <div className={styles.dangerWarningBox}>
                <strong>Cảnh báo không thể hoàn tác:</strong>
                Thao tác này sẽ xóa vĩnh viễn toàn bộ dữ liệu trên Supabase bao gồm: Hồ sơ học viên, Ý tưởng, Showcase, Kết quả Quiz, Feedback và các phiên đăng nhập.
              </div>

              <label className={styles.resetPasswordField}>
                <span>Nhập mật khẩu xác thực để tiếp tục</span>
                <input
                  type="password"
                  className={styles.resetPasswordInput}
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    if (resetStatus === "error") setResetNotice("");
                  }}
                  placeholder="Nhập mật khẩu admin..."
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
                  {resetStatus === "sending" ? "Đang xóa dữ liệu…" : "Xác nhận xóa hết"}
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
        isAdmin={role === "admin"}
        presenceCounts={presenceCounts}
        currentSection={section}
        statusNotice={role === "admin" ? terminateNotice : undefined}
        onChooseSection={role === "admin" ? () => setAdminSection(null) : undefined}
        onOpenTerminate={
          role === "admin"
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
          <SectionTwoDeck key={`${section}-${deckSessionKey}`} isAdmin={role === "admin"} />
        ) : (
          <SectionOneDeck key={`${section}-${deckSessionKey}`} isAdmin={role === "admin"} />
        )}
      </DeckShell>

      {role === "admin" && section && showTerminate && (
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

      {role !== "admin" && !learnerProfile && (
        <div className={styles.profileModalLayer} role="presentation">
          <form
            className={styles.profileModal}
            onSubmit={saveLearnerProfile}
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-profile-title"
          >
            <span className={styles.profileEyebrow}>
              {role === "section1" ? "SECTION 1" : "SECTION 2"} · THÔNG TIN HỌC VIÊN
            </span>
            <h2 id="learner-profile-title">Chào mừng bạn đến lớp học</h2>
            <p>
              Nhập thông tin một lần để hệ thống tự ghi nhận cho ý tưởng, bài làm,
              quiz và feedback trong suốt phiên học.
            </p>

            <label className={styles.profileField}>
              <span>Họ và tên</span>
              <input
                value={profileName}
                onChange={(event) => {
                  setProfileName(event.target.value);
                  setProfileError("");
                }}
                maxLength={80}
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                autoFocus
                required
              />
            </label>

            <label className={styles.profileField}>
              <span>Email EIU</span>
              <div className={styles.profileEmailField}>
                <input
                  value={profileEmailLocalPart}
                  onChange={(event) => {
                    setProfileEmailLocalPart(event.target.value.replace(/@.*$/, ""));
                    setProfileError("");
                  }}
                  maxLength={64}
                  pattern="[A-Za-z0-9._%+\-]+"
                  autoComplete="email"
                  aria-label="Tên tài khoản email EIU"
                  placeholder="student.id"
                  required
                />
                <strong>@eiu.edu.vn</strong>
              </div>
            </label>

            {profileError && <p className={styles.profileError} role="alert">{profileError}</p>}

            <div className={styles.profileActions}>
              <button type="button" className={styles.profileSignOut} onClick={() => void signOut()}>
                Đăng xuất
              </button>
              <button type="submit" className={styles.profileSubmit} disabled={profileStatus === "saving"}>
                {profileStatus === "saving" ? "Đang lưu…" : "Bắt đầu học"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
