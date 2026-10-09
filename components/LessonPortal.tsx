"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";
import type { LearnerProfile } from "@/lib/learnerProfileTypes";
import { rememberDeckSelection } from "@/lib/deckLocation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearSlideInteractionStorage } from "@/lib/slideStorage";
import UploadedSectionDeck from "./deck/UploadedSectionDeck";
import styles from "./LessonPortal.module.css";

const SectionOneDeck = dynamic(() => import("./PdfDeck"), { ssr: false });
const SectionTwoDeck = dynamic(() => import("./section2/SectionTwoDeck"), { ssr: false });

type SectionId = "section1" | "section2";
type TerminateStatus = "idle" | "sending" | "success" | "error";
type ReportStatus = "idle" | "exporting" | "error";
type ReportSectionOption = { value: string; label: string };
type CourseFolderSection = {
  canFacilitate?: boolean;
  id: string;
  sectionKey: string;
  title: string;
  position: number;
  contentType: "builtin" | "pdf" | "tsx" | "pptx";
  templateKey?: string;
  sourceFilename: string | null;
  slideCount: number | null;
};
type CourseFolder = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  languageLabel: "vi" | "en" | "vi_en";
  isUnlocked?: boolean;
  folderGroupId?: string;
  folderGroupName?: string;
  folderOrder?: number;
  systemIcons?: Array<{ id: string; name: string; url: string }>;
  sections: CourseFolderSection[];
};

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
      title={`${activeCount} learners active in ${sectionLabel}`}
      aria-label={`Active learners in ${sectionLabel}`}
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
  canFacilitate,
  presenceCounts,
  currentSection,
  statusNotice,
  onChooseSection,
  onOpenTerminate,
  onSignOut,
  courseTitle,
}: {
  children: ReactNode;
  isAdmin: boolean;
  canFacilitate: boolean;
  presenceCounts: PresenceCounts;
  currentSection?: SectionId | null;
  statusNotice?: string;
  onChooseSection?: () => void;
  onOpenTerminate?: () => void;
  onSignOut: () => void;
  courseTitle: string;
}) {
  return (
    <div className={styles.lessonShell}>
      <div className={styles.deckViewport}>{children}</div>

      <aside className={styles.actionBar} aria-label="Session controls">
        <div className={styles.actionBarIdentity} aria-live="polite">
          <span>EIU · {courseTitle.toUpperCase()}</span>
          <strong>
            {statusNotice || (isAdmin ? "Admin mode" : canFacilitate ? "Teaching mode" : "Learning session")}
          </strong>
        </div>

        {canFacilitate && presenceCounts && (
          <ActiveUsersTaskbarWidget
            counts={presenceCounts}
            currentSection={currentSection}
          />
        )}

        <div className={styles.actionBarButtons}>
          {isAdmin && (
            <Link href="/admin/access">
              Access settings
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
          {onChooseSection && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onChooseSection}
            >
              Courses
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
  canFacilitate = false,
  courseFolders,
  initialSection,
  initialProfile,
  initialCourseId,
  initialSectionId,
}: {
  isAdmin: boolean;
  canFacilitate?: boolean;
  courseFolders: CourseFolder[];
  initialSection: SectionId | null;
  initialProfile: LearnerProfile | null;
  initialCourseId?: string;
  initialSectionId?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = 0;
    const refreshCatalog = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 2_000) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", refreshCatalog);
    document.addEventListener("visibilitychange", refreshCatalog);
    const interval = window.setInterval(refreshCatalog, 30_000);
    return () => {
      window.removeEventListener("focus", refreshCatalog);
      document.removeEventListener("visibilitychange", refreshCatalog);
      window.clearInterval(interval);
    };
  }, [router]);
  const appliedCourseId = courseFolders.find(
    (course) => course.slug === APPLIED_AGENTIC_AI_SLUG,
  )?.id ?? null;
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    initialCourseId ?? (initialSection ? appliedCourseId : null),
  );
  const [adminSection, setAdminSection] = useState<SectionId | null>(initialSection);
  const [uploadedSection, setActiveUploadedSection] = useState<CourseFolderSection | null>(() => initialSection ? null : courseFolders.find(course => course.id === initialCourseId)?.sections.find(item => item.id === initialSectionId && ["pdf", "tsx", "pptx"].includes(item.contentType)) ?? null);
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

  const [searchQuery, setSearchQuery] = useState("");

  const filteredCourseFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courseFolders;
    return courseFolders.filter((course) => {
      const titleMatch = course.title?.toLowerCase().includes(q);
      const descMatch = course.description?.toLowerCase().includes(q);
      const groupMatch = course.folderGroupName?.toLowerCase().includes(q);
      return titleMatch || descMatch || groupMatch;
    });
  }, [courseFolders, searchQuery]);

  // Group courses by parent folder (Folder Lớn)
  const groupedCourses = useMemo(() => {
    const groups: Array<{ id: string; name: string; courses: CourseFolder[] }> = [];
    const groupMap = new Map<string, { id: string; name: string; courses: CourseFolder[] }>();

    for (const course of filteredCourseFolders) {
      const gId = course.folderGroupId || "fg-ai-agentic";
      const gName = course.folderGroupName || "Chương Trình AI & Agentic";
      if (!groupMap.has(gId)) {
        const item = { id: gId, name: gName, courses: [] };
        groupMap.set(gId, item);
        groups.push(item);
      }
      groupMap.get(gId)!.courses.push(course);
    }
    return groups;
  }, [filteredCourseFolders]);

  const COURSES_PER_PAGE = 4;
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  useEffect(() => {
    setGroupPages({});
  }, [searchQuery]);

  const handlePageChange = (groupId: string, newPage: number) => {
    setGroupPages((prev) => ({ ...prev, [groupId]: newPage }));
  };

  const selectedCourse = courseFolders.find((course) => course.id === selectedCourseId) ?? null;
  const section = selectedCourse?.sections.some(item => item.sectionKey === adminSection) ? adminSection : null;
  const activeUploadedSection = selectedCourse?.sections.find(item => item.id === uploadedSection?.id) ?? null;
  const canFacilitateCurrent = isAdmin || Boolean(selectedCourse?.sections.find(item => item.sectionKey === section)?.canFacilitate);
  const resetSectionLabel =
    resetSection === "all"
      ? "all sections"
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
    if (!isAdmin && !canFacilitate) return;

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
  }, [isAdmin, canFacilitate]);

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
        throw new Error(payload.message || "Unable to export the report.");
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
      setReportNotice(error instanceof Error ? error.message : "Unable to export the report.");
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
    window.location.replace("/");
  }

  async function resetAllData(event: FormEvent) {
    event.preventDefault();
    if (!isAdmin || resetStatus === "sending") return;

    if (!resetPassword.trim()) {
      setResetStatus("error");
      setResetNotice("Enter the confirmation passcode.");
      return;
    }

    setResetStatus("sending");
    setResetNotice("");

    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
          section: resetSection,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "The confirmation value is incorrect.");
      }

      setResetStatus("success");
      setResetNotice(payload.message || `Data for ${resetSectionLabel} was deleted.`);
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
      setResetNotice(error instanceof Error ? error.message : "Unable to reset data.");
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
        `${section === "section1" ? "Section 1" : "Section 2"} ended. Slide data was refreshed and learners are returning to the access screen.`
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
    if (response.ok) {
      rememberDeckSelection(selectedCourse?.id, selectedCourse?.sections.find(item => item.sectionKey === nextSection)?.id);
      setActiveUploadedSection(null);
      setAdminSection(nextSection);
    }
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
            window.location.replace("/");
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
          window.location.replace("/");
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

  if (!selectedCourse) {
    return (
      <main className={styles.portal}>
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.selectorActions}>
          {isAdmin && <Link href="/admin/access">Access settings</Link>}
          {isAdmin && <Link href="/admin/ai" className={styles.aiButton}>✦ AI Knowledge</Link>}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>

        <section className={`${styles.panel} ${styles.learningSpacePanel}`}>
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
              <span>{isAdmin ? "ADMIN LEARNING SPACE" : "MY LEARNING SPACE"}</span>
              <strong>EIU Interactive Learning Space</strong>
            </div>
          </div>

          <div className={styles.libraryHeaderToolbar}>
            <div className={styles.libraryHeaderTitleArea}>
              <span className={styles.libraryHeaderTag}>COURSE LIBRARY</span>
              <h1 className={styles.libraryHeaderTitle}>Choose a course</h1>
            </div>

            <div className={styles.librarySearchArea}>
              <div className={styles.searchBarWrapper}>
                <svg
                  className={styles.searchIcon}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search courses or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search courses"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <span className={styles.searchStatsBadge}>
                {searchQuery
                  ? `${filteredCourseFolders.length} found`
                  : `${courseFolders.length} ${courseFolders.length === 1 ? "course" : "courses"}`}
              </span>
            </div>
          </div>

          <div className={styles.libraryFolderSections}>
            {groupedCourses.length === 0 ? (
              <div className={styles.emptySearch}>
                <div className={styles.emptySearchIcon} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e9ca8b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3>No courses found</h3>
                <p>No courses match &ldquo;{searchQuery}&rdquo;. Try another keyword or clear search.</p>
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              groupedCourses.map((group) => {
                const totalCourses = group.courses.length;
                const totalPages = Math.max(1, Math.ceil(totalCourses / COURSES_PER_PAGE));
                const currentPage = Math.min(Math.max(1, groupPages[group.id] || 1), totalPages);
                const startIndex = (currentPage - 1) * COURSES_PER_PAGE;
                const paginatedCourses = group.courses.slice(startIndex, startIndex + COURSES_PER_PAGE);
                const colCount = Math.min(totalCourses, COURSES_PER_PAGE);

                return (
                  <div key={group.id} className={styles.libraryFolderGroup}>
                    {(groupedCourses.length > 1 || totalPages > 1 || searchQuery) && (
                      <div className={styles.libraryFolderHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#e9ca8b" aria-hidden="true">
                            <path d="M20 5h-9.586L8.707 3.293A.997.997 0 0 0 8 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/>
                          </svg>
                          <h2 className={styles.libraryFolderTitle}>{group.name}</h2>
                        </div>
                        <div className={styles.libraryFolderHeaderRight}>
                          <span className={styles.libraryFolderBadge}>
                            {totalCourses} {totalCourses === 1 ? "COURSE" : "COURSES"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div
                      className={styles.courseFolderGrid}
                      style={{ "--col-count": colCount } as React.CSSProperties}
                    >
                      {paginatedCourses.map((course) => {
                        const isCourseUnlocked = true;
                        return (
                          <button
                            type="button"
                            className={styles.courseFolder}
                            key={course.id}
                            onClick={() => { rememberDeckSelection(course.id); setSelectedCourseId(course.id); }}
                          >
                            <div className={styles.courseCardBody}>
                              <div className={styles.courseCardTopRow}>
                                <div className={styles.courseCardHeading}>
                                  <strong className={styles.courseTitle}>{course.title}</strong>
                                  <span className={styles.sectionCountText}>
                                    {course.sections.length} {course.sections.length === 1 ? "SECTION" : "SECTIONS"}
                                  </span>
                                </div>
                                <b aria-hidden="true" className={isCourseUnlocked ? styles.folderArrowUnlocked : styles.folderArrowLocked}>
                                  {isCourseUnlocked ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                  )}
                                </b>
                              </div>

                              <em className={styles.courseDesc}>
                                {course.description ?? ""}
                              </em>

                              <div className={styles.folderBadgesRow}>
                                <span className={styles.folderLanguage}>
                                  {course.languageLabel === "vi" ? "Vietnamese" : course.languageLabel === "en" ? "English" : "Vietnamese · English"}
                                </span>
                                {isCourseUnlocked ? (
                                  <span className={styles.unlockedFolderBadge}>
                                    <i className={styles.dotUnlocked} aria-hidden="true" />
                                    <span>UNLOCKED</span>
                                  </span>
                                ) : (
                                  <span className={styles.lockedFolderBadge}>
                                    <i className={styles.dotLocked} aria-hidden="true" />
                                    <span>PASSCODE REQUIRED</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Tech Stack Icons: Thanh hiển thị ngang riêng biệt bên dưới, tự lặp vô tận khi > 5 icon */}
                            {course.systemIcons && course.systemIcons.length > 0 && (
                              <div className={styles.courseCardIconsArea} title="Course Tech Stack">
                                {course.systemIcons.length > 5 ? (
                                  <div className={styles.marqueeContainer}>
                                    <div className={styles.marqueeTrack}>
                                      {course.systemIcons.map((icon, idx) => (
                                        <div
                                          key={`a-${icon.id}-${idx}`}
                                          className={styles.courseCardIconBox}
                                          style={{ animationDelay: `${(idx % 6) * 0.45}s` }}
                                          title={icon.name && icon.name.toLowerCase() !== "system" ? icon.name : undefined}
                                        >
                                          <img
                                            src={icon.url}
                                            alt={icon.name || "Icon"}
                                            className={styles.courseCardIconImg}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <div className={styles.marqueeTrack} aria-hidden="true">
                                      {course.systemIcons.map((icon, idx) => (
                                        <div
                                          key={`b-${icon.id}-${idx}`}
                                          className={styles.courseCardIconBox}
                                          style={{ animationDelay: `${((idx + 2) % 6) * 0.45}s` }}
                                          title={icon.name && icon.name.toLowerCase() !== "system" ? icon.name : undefined}
                                        >
                                          <img
                                            src={icon.url}
                                            alt={icon.name || "Icon"}
                                            className={styles.courseCardIconImg}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className={styles.staticIconsTrack}>
                                    {course.systemIcons.map((icon, idx) => (
                                      <div
                                        key={icon.id}
                                        className={styles.courseCardIconBox}
                                        style={{ animationDelay: `${idx * 0.45}s` }}
                                        title={icon.name && icon.name.toLowerCase() !== "system" ? icon.name : undefined}
                                      >
                                        <img
                                          src={icon.url}
                                          alt={icon.name || "Icon"}
                                          className={styles.courseCardIconImg}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {totalPages > 1 && (
                      <div className={styles.groupPaginationFooter}>
                        <span className={styles.paginationDetail}>
                          Showing {startIndex + 1}–{Math.min(startIndex + COURSES_PER_PAGE, totalCourses)} of {totalCourses} courses
                        </span>
                        <div className={styles.pagePills}>
                          <button
                            type="button"
                            className={styles.pagePillNav}
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(group.id, currentPage - 1)}
                          >
                            ‹ Prev
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              className={`${styles.pagePill} ${pageNum === currentPage ? styles.pagePillActive : ""}`}
                              onClick={() => handlePageChange(group.id, pageNum)}
                            >
                              {pageNum}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={styles.pagePillNav}
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(group.id, currentPage + 1)}
                          >
                            Next ›
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Course Passcode Modal */}

      </main>
    );
  }

  if (!section && !activeUploadedSection) {
    return (
      <main className={styles.portal}>
        <div className={styles.grid} aria-hidden="true" />

        <div className={styles.selectorActions}>
          <button type="button" onClick={() => { rememberDeckSelection(); setSelectedCourseId(null); }}>← Courses</button>
          {isAdmin && <Link href="/admin/access">Access settings</Link>}
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
              {reportStatus === "exporting" ? "Exporting…" : "Export Excel report"}
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
              Reset data
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
              <strong>{selectedCourse.title}</strong>
            </div>
          </div>

          <div className={styles.heading}>
            <span>{selectedCourse.title.toUpperCase()}</span>
            <h1>Choose what you want to learn</h1>
            {selectedCourse.description && <p>{selectedCourse.description}</p>}
            {reportStatus === "error" && reportNotice && (
              <p className={styles.reportError} role="alert">{reportNotice}</p>
            )}
          </div>

          <div className={styles.cards}>
            {selectedCourse.sections.map((courseSection) => {
              const coreSection = selectedCourse.slug === APPLIED_AGENTIC_AI_SLUG &&
                (courseSection.sectionKey === "section1" || courseSection.sectionKey === "section2")
                  ? courseSection.sectionKey as SectionId
                  : null;
              const hasUploadedDeck = courseSection.contentType === "pdf" || courseSection.contentType === "tsx" || courseSection.contentType === "pptx";
              const canOpen = Boolean(coreSection || hasUploadedDeck);
              const count = coreSection === "section1" ? 41 : coreSection === "section2" ? 38 : courseSection.slideCount;
              return (
                <div key={courseSection.id} className={styles.courseSectionCard}>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (coreSection) void chooseSection(coreSection);
                    else if (hasUploadedDeck) { rememberDeckSelection(selectedCourse.id, courseSection.id, true); setActiveUploadedSection(courseSection); }
                  }}
                >
                  <span>SECTION {courseSection.position}</span>
                  <strong>{courseSection.title}</strong>
                  <small>
                    {canOpen
                      ? `${count ? `${count} slide · ` : ""}${coreSection ? "Interactive" : courseSection.contentType.toUpperCase()}`
                      : "Content has not been uploaded yet"}
                  </small>
                  {(isAdmin || courseSection.canFacilitate) && coreSection && <div className={styles.cardLiveUsers}>
                    <span className={styles.liveDot} />
                    <span>{presenceCounts[coreSection]} active learners</span>
                  </div>}
                  <i>{canOpen ? "→" : "…"}</i>
                </button>
                {coreSection && courseSection.contentType === "pptx" && (
                  <button type="button" className={styles.sectionFilePreview} onClick={() => { rememberDeckSelection(selectedCourse.id, courseSection.id, true); setAdminSection(null); setActiveUploadedSection(courseSection); }}>
                    View file
                  </button>
                )}
                {coreSection && courseSection.contentType === "pptx" && (
                  <a
                    className={styles.sectionPptxLink}
                    href={`/api/sections/${encodeURIComponent(courseSection.id)}/content?download=1`}
                    download={courseSection.sourceFilename || "Presentation.pptx"}
                    title="Download the original attachment and open it in PowerPoint for audio, animations, and add-ins"
                  >
                    Download
                  </a>
                )}
                </div>
              );
            })}
            {selectedCourse.sections.length === 0 && <p>This course does not have any sections yet.</p>}
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
              <span>ANALYTICS REPORT</span>
              <h2 id="export-report-title">Export Excel report</h2>
              <p>
                Choose the section and time range to include.
              </p>

              <label className={styles.exportSectionField}>
                <span>Section scope</span>
                <select
                  value={exportSection}
                  onChange={(event) => setExportSection(event.target.value)}
                  disabled={reportStatus === "exporting"}
                >
                  <option value="all">All sections</option>
                  {reportSections.map((sectionOption) => (
                    <option key={sectionOption.value} value={sectionOption.value}>
                      {sectionOption.label}
                    </option>
                  ))}
                </select>
                <small>New sections appear here automatically.</small>
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
                    <strong>Today ({formatVNDate(getTodayDateString())})</strong>
                    <small>Only learners and activity recorded today</small>
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
                    <strong>Specific date</strong>
                    <small>Choose the class date to export</small>
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
                    <strong>All time</strong>
                    <small>Export the complete learner history</small>
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
                  Close
                </button>
                <button
                  type="button"
                  className={styles.confirmReportButton}
                  onClick={() => void exportReport()}
                  disabled={reportStatus === "exporting"}
                >
                  {reportStatus === "exporting" ? "Exporting file…" : "Download Excel file"}
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
              <span className={styles.dangerEyebrow}>DANGER · ADMINISTRATIVE ACTION</span>
              <h2 id="reset-modal-title">
                {resetSection === "all" ? "Reset all data?" : `Reset ${resetSectionLabel}?`}
              </h2>

              <label className={styles.exportSectionField}>
                <span>Reset scope</span>
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
                  <option value="all">All sections</option>
                </select>
                <small>New sections appear here automatically.</small>
              </label>

              <div className={styles.dangerWarningBox}>
                <strong>This action cannot be undone:</strong>
                It permanently deletes {resetSectionLabel} data from Supabase, including learner
                profiles, activity logs, ideas, showcase entries, quiz results, feedback, and active sessions.
              </div>

              <label className={styles.resetPasswordField}>
                <span>Confirmation passcode</span>
                <input
                  type="password"
                  className={styles.resetPasswordInput}
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    if (resetStatus === "error") setResetNotice("");
                  }}
                  placeholder="Enter confirmation passcode"
                  autoComplete="off"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.confirmResetButton}
                  disabled={resetStatus === "sending" || resetStatus === "success"}
                >
                  {resetStatus === "sending"
                    ? "Deleting data…"
                    : resetSection === "all"
                      ? "Delete all data"
                      : `Delete ${resetSectionLabel}`}
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
        canFacilitate={canFacilitateCurrent}
        presenceCounts={presenceCounts}
        currentSection={section}
        statusNotice={isAdmin ? terminateNotice : undefined}
        onChooseSection={() => {
          rememberDeckSelection();
          setAdminSection(null);
          setActiveUploadedSection(null);
          setSelectedCourseId(null);
        }}
        onOpenTerminate={
          isAdmin && section
            ? () => {
                setTerminateStatus("idle");
                setTerminateNotice("");
                setShowTerminate(true);
              }
            : undefined
        }
        onSignOut={signOut}
        courseTitle={selectedCourse.title}
      >
        {activeUploadedSection ? (
          <UploadedSectionDeck
            key={`${activeUploadedSection.id}-${activeUploadedSection.templateKey ?? ""}-${deckSessionKey}`}
            sectionId={activeUploadedSection.id}
            templateKey={activeUploadedSection.templateKey}
            contentType={activeUploadedSection.contentType === "pptx" ? "pptx" : activeUploadedSection.contentType === "pdf" ? "pdf" : "tsx"}
            slideCount={activeUploadedSection.slideCount}
            courseTitle={selectedCourse.title}
            sectionTitle={activeUploadedSection.title}
          />
        ) : section === "section2" ? (
          <SectionTwoDeck
            key={`${section}-${deckSessionKey}`}
            isAdmin={canFacilitateCurrent}
            courseTitle={selectedCourse.title}
            sectionTitle={selectedCourse.sections.find((item) => item.sectionKey === "section2")?.title || "Section 2"}
          />
        ) : (
          <SectionOneDeck
            key={`${section}-${deckSessionKey}`}
            isAdmin={canFacilitateCurrent}
            courseTitle={selectedCourse.title}
            sectionTitle={selectedCourse.sections.find((item) => item.sectionKey === "section1")?.title || "Section 1"}
          />
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
              Learners in this section will return to the access screen.
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
