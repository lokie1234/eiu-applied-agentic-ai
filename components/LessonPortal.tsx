"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";
import type { LearnerProfile } from "@/lib/learnerProfileTypes";
import { rememberDeckSelection } from "@/lib/deckLocation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearSlideInteractionStorage } from "@/lib/slideStorage";
import styles from "./LessonPortal.module.css";
import LearningInnovationIcon from "./LearningInnovationIcon";
import CourseDiscoveryHeading from "./CourseDiscoveryHeading";
import HairlineLoading from "./HairlineLoading";
import CourseToolRow from "./CourseToolRow";
import SectionEnergy from "./SectionEnergy";
import { useSectionOpening } from "./useSectionOpening";
import { useSectionSlideCounts } from "./useSectionSlideCounts";
import { buildSectionOneDeckItems, sectionTwoDeckItems } from "@/lib/builtinDeckItems";

const loadSectionOne = () => import("./PdfDeck");
const loadSectionTwo = () => import("./section2/SectionTwoDeck");
const SectionOneDeck = dynamic(loadSectionOne, { ssr: false, loading: () => <HairlineLoading /> });
const SectionTwoDeck = dynamic(loadSectionTwo, { ssr: false, loading: () => <HairlineLoading /> });
const UploadedSectionDeck = dynamic(() => import("./deck/UploadedSectionDeck"), { ssr: false, loading: () => <HairlineLoading /> });
const LearningIcon3DLayer = dynamic(() => import("./LearningIcon3DLayer"), { ssr: false });

type SectionId = "section1" | "section2";

// One delegated handler for the whole chooser; no React updates per mouse move.
function useInnovationTilt() {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef<DOMRect | null>(null);
  const motionAllowedRef = useRef(true);
  const reset = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    surfaceRef.current?.style.removeProperty("--ai-rotate-x");
    surfaceRef.current?.style.removeProperty("--ai-rotate-y");
    surfaceRef.current?.removeAttribute("data-pointer-active");
    surfaceRef.current = null;
    boundsRef.current = null;
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)");
    const update = () => { motionAllowedRef.current = !media.matches; if (media.matches) reset(); };
    update();
    media.addEventListener("change", update);
    window.addEventListener("resize", reset, { passive: true });
    window.addEventListener("blur", reset);
    document.addEventListener("scroll", reset, { capture: true, passive: true });
    document.addEventListener("visibilitychange", reset);
    return () => {
      reset();
      media.removeEventListener("change", update);
      window.removeEventListener("resize", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("scroll", reset, true);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [reset]);
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !motionAllowedRef.current) return;
    const surface = (event.target as Element).closest<HTMLElement>("[data-icon-surface]");
    if (surface !== surfaceRef.current) {
      reset();
      if (!surface || surface.matches(":disabled, [data-disabled=\"true\"]")) return;
      surfaceRef.current = surface;
      surface.setAttribute("data-pointer-active", "true");
    }
    if (!surface) return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const target = surfaceRef.current;
      if (!target?.isConnected) return;
      const bounds = boundsRef.current ?? target.getBoundingClientRect();
      boundsRef.current = bounds;
      if (!bounds.width || !bounds.height) return;
      const x = Math.max(-1, Math.min(1, ((pointerRef.current.x - bounds.left) / bounds.width - .5) * 2));
      const y = Math.max(-1, Math.min(1, ((pointerRef.current.y - bounds.top) / bounds.height - .5) * 2));
      const strength = target.dataset.iconSurface === "folder" ? 1 : 1.4;
      target.style.setProperty("--ai-rotate-x", `${(-y * 8 * strength).toFixed(2)}deg`);
      target.style.setProperty("--ai-rotate-y", `${(x * 11 * strength).toFixed(2)}deg`);
    });
  }
  return { onPointerMove, onPointerLeave: reset };
}

function LearningAccent({ kind = "book" }: { kind?: "library" | "collection" | "book" | "page" }) {
  return <LearningInnovationIcon kind={kind === "collection" || kind === "library" ? "folder" : kind === "page" ? "section" : "course"} className={styles.learningAccent} compact />;
}
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
  contentRevision?: string | null;
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
  onChooseSection?: (keyboard?: boolean) => void;
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
              onClick={event => onChooseSection(event.detail === 0)}
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

function groupCourseFolders(courses: CourseFolder[]) {
    const groups: Array<{ id: string; name: string; courses: CourseFolder[] }> = [];
    const groupMap = new Map<string, { id: string; name: string; courses: CourseFolder[] }>();

    for (const course of courses) {
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
  const iconTilt = useInnovationTilt();
  const [catalogRefreshing, startCatalogRefresh] = useTransition();
  const catalogRefreshInFlight = useRef(false);
  const deckOpenRef = useRef(false);
  useEffect(() => {
    if (!catalogRefreshing) catalogRefreshInFlight.current = false;
  }, [catalogRefreshing]);
  useEffect(() => {
    let lastRefresh = 0;
    const refreshCatalog = () => {
      if (deckOpenRef.current || document.visibilityState !== "visible" || catalogRefreshInFlight.current || Date.now() - lastRefresh < 2_000) return;
      lastRefresh = Date.now();
      catalogRefreshInFlight.current = true;
      startCatalogRefresh(() => router.refresh());
    };
    window.addEventListener("focus", refreshCatalog);
    document.addEventListener("visibilitychange", refreshCatalog);
    const interval = window.setInterval(refreshCatalog, 30_000);
    return () => {
      window.removeEventListener("focus", refreshCatalog);
      document.removeEventListener("visibilitychange", refreshCatalog);
      window.clearInterval(interval);
    };
  }, [router, startCatalogRefresh]);
  const appliedCourseId = courseFolders.find(
    (course) => course.slug === APPLIED_AGENTIC_AI_SLUG,
  )?.id ?? null;
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    initialCourseId ?? (initialSection ? appliedCourseId : null),
  );
  const [adminSection, setAdminSection] = useState<SectionId | null>(initialSection);
  const [uploadedSection, setActiveUploadedSection] = useState<CourseFolderSection | null>(() => initialSection ? null : courseFolders.find(course => course.id === initialCourseId)?.sections.find(item => item.id === initialSectionId && ["pdf", "tsx", "pptx"].includes(item.contentType)) ?? null);
  const { openingSection, sectionOpenError, openSection, cancelSectionOpening } = useSectionOpening();
  const [launchingSection, setLaunchingSection] = useState<SectionId | null>(null);
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
  const hasLearnerProfile = Boolean(learnerProfile);
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

  const groupedCourses = useMemo(() => groupCourseFolders(filteredCourseFolders), [filteredCourseFolders]);
  const allCourseGroups = useMemo(() => groupCourseFolders(courseFolders), [courseFolders]);

  const [openFolderId, setOpenFolderId] = useState<string | null>(() =>
    courseFolders.find(course => course.id === initialCourseId)?.folderGroupId ?? null);
  const sectionListRef = useRef<HTMLDivElement>(null);
  const coursePaneRef = useRef<HTMLDivElement>(null);
  const courseGridRef = useRef<HTMLDivElement>(null);
  const restoreCourseFocus = useRef<{ id: string; keyboard: boolean } | null>(null);
  const restoreFolderFocus = useRef(false);
  const courseScrollTop = useRef(0);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);

  const openFolder = allCourseGroups.find(group => group.id === openFolderId) ?? allCourseGroups[0];
  const isSearchingCourses = searchQuery.trim().length > 0;
  const visibleCourseGroups = isSearchingCourses ? groupedCourses : openFolder ? [openFolder] : [];

  const COURSES_PER_PAGE = 6;
  const FOLDERS_PER_PAGE = 6;
  const folderTotalPages = Math.max(1, Math.ceil(allCourseGroups.length / FOLDERS_PER_PAGE));
  const folderPage = Math.floor(Math.max(0, allCourseGroups.findIndex(group => group.id === openFolder?.id)) / FOLDERS_PER_PAGE) + 1;
  const paginatedFolders = allCourseGroups.slice((folderPage - 1) * FOLDERS_PER_PAGE, folderPage * FOLDERS_PER_PAGE);
  function changeFolderPage(page: number) {
    const firstGroup = allCourseGroups[(page - 1) * FOLDERS_PER_PAGE];
    if (firstGroup) chooseFolder(firstGroup.id);
  }
  const [groupPages, setGroupPages] = useState<Record<string, number>>(() => {
    const course = courseFolders.find(item => item.id === initialCourseId);
    if (!course) return {};
    const groupId = course.folderGroupId || "fg-ai-agentic";
    const index = courseFolders.filter(item => (item.folderGroupId || "fg-ai-agentic") === groupId).findIndex(item => item.id === course.id);
    return { [groupId]: Math.floor(index / COURSES_PER_PAGE) + 1 };
  });

  function closeCourse(restoreFocus = false) {
    cancelSectionOpening();
    iconTilt.onPointerLeave();
    if (selectedCourseId) restoreCourseFocus.current = { id: selectedCourseId, keyboard: restoreFocus };
    if (selectedCourseId) rememberDeckSelection();
    setSelectedCourseId(null);
  }

  function chooseFolder(groupId: string) {
    restoreFolderFocus.current = mobileFoldersOpen;
    closeCourse();
    setOpenFolderId(groupId);
    setSearchQuery("");
    setMobileFoldersOpen(false);
    if (coursePaneRef.current) coursePaneRef.current.scrollTop = 0;
  }

  function changeSearchQuery(value: string) {
    closeCourse();
    setSearchQuery(value);
    setGroupPages({});
  }

  const handlePageChange = (groupId: string, newPage: number) => {
    closeCourse();
    if (courseGridRef.current) courseGridRef.current.scrollTop = 0;
    setGroupPages((prev) => ({ ...prev, [groupId]: newPage }));
  };

  const selectedCourse = courseFolders.find((course) => course.id === selectedCourseId) ?? null;
  const section = selectedCourse?.sections.some(item => item.sectionKey === adminSection) ? adminSection : null;
  const activeUploadedSection = selectedCourse?.sections.find(item => item.id === uploadedSection?.id) ?? null;
  useEffect(() => {
    deckOpenRef.current = Boolean(section || activeUploadedSection || openingSection || launchingSection);
  }, [section, activeUploadedSection, openingSection, launchingSection]);
  const sectionsToCount = useMemo(() => {
    if (!selectedCourse || section || activeUploadedSection || launchingSection) return undefined;
    return selectedCourse.sections.filter(item => !(selectedCourse.slug === APPLIED_AGENTIC_AI_SLUG &&
      (item.sectionKey === "section1" || item.sectionKey === "section2")));
  }, [selectedCourse, section, activeUploadedSection, launchingSection]);
  const sectionSlideCounts = useSectionSlideCounts(selectedCourse?.id ?? "", sectionsToCount);

  useEffect(() => {
    if (section || activeUploadedSection || launchingSection) return;
    const pane = coursePaneRef.current;
    if (selectedCourseId) {
      if (pane) pane.scrollTop = 0;
      sectionListRef.current?.focus({ preventScroll: true });
    } else if (restoreCourseFocus.current) {
      const scrollTarget = isSearchingCourses ? pane : courseGridRef.current;
      if (scrollTarget) scrollTarget.scrollTop = courseScrollTop.current;
      if (restoreCourseFocus.current.keyboard) {
        document.getElementById(`course-choice-${restoreCourseFocus.current.id}`)?.focus({ preventScroll: true });
      } else {
        pane?.focus({ preventScroll: true });
      }
      restoreCourseFocus.current = null;
    }
  }, [selectedCourseId, section, activeUploadedSection, launchingSection, isSearchingCourses]);

  useEffect(() => {
    if (!mobileFoldersOpen && restoreFolderFocus.current) {
      coursePaneRef.current?.focus({ preventScroll: true });
      restoreFolderFocus.current = false;
    }
  }, [mobileFoldersOpen, openFolder?.id]);

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
    let inFlight = false;
    let refreshQueued = false;
    const controller = new AbortController();

    async function fetchCounts() {
      if (disposed || document.visibilityState !== "visible") return;
      if (inFlight) { refreshQueued = true; return; }
      inFlight = true;
      try {
        const response = await fetch("/api/presence", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          success?: boolean;
          counts?: PresenceCounts;
        };
        if (!disposed && payload.success && payload.counts) {
          const counts = payload.counts;
          setPresenceCounts(previous => previous.section1 === counts.section1 && previous.section2 === counts.section2 && previous.total === counts.total ? previous : counts);
        }
      } catch {
        // Ignore network glitches
      } finally {
        inFlight = false;
        if (!disposed && refreshQueued) {
          refreshQueued = false;
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void fetchCounts(), 150);
        }
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
    const resumeCounts = () => { if (document.visibilityState === "visible") void fetchCounts(); };
    document.addEventListener("visibilitychange", resumeCounts);

    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(refreshTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resumeCounts);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [isAdmin, canFacilitate]);

  // Learner heartbeat tracking
  useEffect(() => {
    if (isAdmin || !hasLearnerProfile || !section) return;

    const clientId = getOrCreateClientId();
    let disposed = false;
    let inFlight = false;
    let leaveSent = false;
    const controller = new AbortController();

    async function sendHeartbeat() {
      if (disposed || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      leaveSent = false;
      await fetch("/api/presence", {
        method: "POST",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", section, clientId }),
      }).catch(() => undefined).finally(() => { inFlight = false; });
    }

    void sendHeartbeat();
    const heartbeatTimer = window.setInterval(() => void sendHeartbeat(), 20_000);
    const resumeHeartbeat = () => { if (document.visibilityState === "visible") void sendHeartbeat(); };
    document.addEventListener("visibilitychange", resumeHeartbeat);

    const onLeave = () => {
      if (!leaveSent && navigator.sendBeacon) {
        leaveSent = navigator.sendBeacon(
          "/api/presence",
          JSON.stringify({ action: "leave", section, clientId })
        );
      }
    };

    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      disposed = true;
      controller.abort();
      clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", resumeHeartbeat);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      onLeave();
    };
  }, [isAdmin, hasLearnerProfile, section]);

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

  // Admin section termination polling listener
  useEffect(() => {
    if (isAdmin || !section) return;

    let disposed = false;
    let initialToken: string | null = null;
    let isInitialized = false;
    let inFlight = false;
    const controller = new AbortController();

    async function checkTermination() {
      if (disposed || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch(`/api/section-control?section=${section}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          success?: boolean;
          terminationToken?: string;
        };

        if (!disposed && payload.success) {
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
      } finally {
        inFlight = false;
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
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [isAdmin, section]);

  const handleLaunchBuiltin = useCallback((course: CourseFolder, item: CourseFolderSection, coreSection: SectionId) => {
    iconTilt.onPointerLeave();
    setLaunchingSection(coreSection);
    rememberDeckSelection(course.id, item.id, false, { course: course.slug, section: item.sectionKey });
    // Fetch the display bundle in parallel with the session check.
    void (coreSection === "section1" ? loadSectionOne() : loadSectionTwo()).catch(() => {});
    void openSection(coreSection, () => {
      setActiveUploadedSection(null);
      setAdminSection(coreSection);
      setLaunchingSection(null);
    });
  }, [iconTilt, openSection]);

  function renderCourseSections(course: CourseFolder) {
    return (
      <div id={`course-sections-${course.id}`} className={styles.inlineSections}
        role="region" aria-label={`${course.title} sections`} tabIndex={-1} ref={sectionListRef}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closeCourse(true); } }}>
        <button type="button" className={styles.backToCourses} onClick={event => closeCourse(event.detail === 0)} aria-label="Back to courses">
          <span aria-hidden="true">←</span> Courses
        </button>
        <div className={styles.inlineSectionsHeader}>
          <div>
            <span>{course.folderGroupName || openFolder?.name} / SECTIONS</span>
            <h2 className={styles.illustratedTitle}><LearningAccent /><span>{course.title}</span></h2>
            {course.description && <p>{course.description}</p>}
          </div>
          <span className={styles.sectionTotal}>{course.sections.length} sections</span>
        </div>
        {Boolean(course.systemIcons?.length) && <div className={styles.sectionTools}><CourseToolRow tools={course.systemIcons} /></div>}
        {sectionOpenError && <p role="alert" className={styles.sectionOpenError}>{sectionOpenError}</p>}
          <div className={styles.cards}>
            {course.sections.map((courseSection) => {
              const coreSection = course.slug === APPLIED_AGENTIC_AI_SLUG &&
                (courseSection.sectionKey === "section1" || courseSection.sectionKey === "section2")
                  ? courseSection.sectionKey as SectionId
                  : null;
              const hasUploadedDeck = courseSection.contentType === "pdf" || courseSection.contentType === "tsx" || courseSection.contentType === "pptx";
              const canOpen = Boolean(coreSection || hasUploadedDeck);
              const count = coreSection === "section1"
                ? buildSectionOneDeckItems(isAdmin || Boolean(courseSection.canFacilitate)).length
                : coreSection === "section2" ? sectionTwoDeckItems.length : sectionSlideCounts[courseSection.id];
              return (
                <div key={courseSection.id} className={styles.courseSectionCard}>
                <article
                  className={styles.sectionLaunchButton}
                  data-icon-surface="section"
                  data-disabled={!canOpen || Boolean(openingSection)}
                  aria-busy={openingSection === courseSection.sectionKey}
                >
                  {canOpen && <SectionEnergy />}
                  <span data-energy-exclude>SECTION {courseSection.position}</span>
                  <strong data-energy-exclude className={styles.illustratedTitle} title={courseSection.title}><LearningAccent kind="page" /><span>{courseSection.title}</span></strong>
                  {canOpen && <div className={styles.sectionEnergySpace} aria-hidden="true" />}
                  <small data-energy-exclude className={canOpen ? styles.sectionSlideBadge : undefined} aria-live="polite" aria-atomic="true">
                    {canOpen ? <>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="7" width="14" height="13" rx="2" /><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2M11 12h6m-6 4h4" /></svg>
                      <b className={styles.sectionSlideCount}>{count ?? "…"}</b>
                      <span> slides</span>
                    </> : "Content has not been uploaded yet"}
                  </small>
                  {(isAdmin || courseSection.canFacilitate) && coreSection && <div data-energy-exclude className={styles.cardLiveUsers}>
                    <span className={styles.liveDot} />
                    <span>{presenceCounts[coreSection]} active learners</span>
                  </div>}
                  {canOpen && <button type="button" className={styles.sectionClickCue}
                    data-energy-exclude
                    aria-label={`Open ${courseSection.title}`}
                    disabled={Boolean(openingSection)}
                    aria-busy={openingSection === courseSection.sectionKey}
                  onClick={() => {
                    if (coreSection) handleLaunchBuiltin(course, courseSection, coreSection);
                    else if (hasUploadedDeck) { iconTilt.onPointerLeave(); deckOpenRef.current = true; rememberDeckSelection(course.id, courseSection.id, true, { course: course.slug, section: courseSection.sectionKey }); setActiveUploadedSection(courseSection); }
                  }}
                  >
                    <LearningInnovationIcon kind="section" className={styles.sectionClickArtwork} active={openingSection === courseSection.sectionKey} />
                  </button>}
                </article>
                {coreSection && courseSection.contentType === "pptx" && (
                  <button type="button" className={styles.sectionFilePreview} disabled={Boolean(openingSection)} onClick={() => { rememberDeckSelection(course.id, courseSection.id, true, { course: course.slug, section: courseSection.sectionKey }); setAdminSection(null); setActiveUploadedSection(courseSection); }}>
                    View file
                  </button>
                )}
                {hasUploadedDeck && (
                  <a
                    className={styles.sectionPptxLink}
                    href={`/api/sections/${encodeURIComponent(courseSection.id)}/content?download=1`}
                    download={courseSection.contentType === "tsx" ? (courseSection.sourceFilename || "Lesson.js").replace(/\.tsx$/i,".js") : courseSection.sourceFilename || "Presentation."+courseSection.contentType}
                    title={courseSection.contentType === "tsx" ? "Download the JS lesson and open it with EIU Lesson Player" : "Download the original presentation"}
                  >
                    Download
                  </a>
                )}
                </div>
              );
            })}
            {course.sections.length === 0 && <p>This course does not have any sections yet.</p>}
          </div>
      </div>
    );
  }

  if (!selectedCourse || (!section && !activeUploadedSection && !launchingSection)) {
    return (
      <main className={`${styles.portal} ${styles.innovationPortal}`} {...iconTilt}>
        <div className={styles.innovationBackdrop} aria-hidden="true" />
        <LearningIcon3DLayer />
        <div className={styles.selectorActions}>
          <Link href="/player">EIU Lesson Player ↗</Link>
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
              <CourseDiscoveryHeading />
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
                  onChange={(e) => changeSearchQuery(e.target.value)}
                  aria-label="Search courses"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={() => changeSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <span className={styles.searchStatsBadge} role="status">
                {searchQuery
                  ? `${filteredCourseFolders.length} found`
                  : `${courseFolders.length} ${courseFolders.length === 1 ? "course" : "courses"}`}
              </span>
            </div>
          </div>

          <div className={styles.libraryWorkspace}>
            <button type="button" id="mobile-folder-toggle" className={styles.mobileFolderToggle} aria-expanded={mobileFoldersOpen}
              aria-controls="folder-navigation" onClick={() => setMobileFoldersOpen(value => !value)}>
              <span><strong className={styles.illustratedTitle}><LearningAccent kind="collection" /><span>{openFolder?.name || "Course folders"}</span></strong></span>
              <span aria-hidden="true">{mobileFoldersOpen ? "−" : "+"}</span>
            </button>
            <aside id="folder-navigation"
              className={`${styles.folderNavigation} ${mobileFoldersOpen ? styles.mobileFoldersOpen : ""}`} aria-label="Folder navigation"
              onKeyDown={event => {
                if (event.key === "Escape" && mobileFoldersOpen) {
                  setMobileFoldersOpen(false);
                  document.getElementById("mobile-folder-toggle")?.focus({ preventScroll: true });
                }
              }}>
              <div className={styles.folderShelf} role="group" aria-label="Course folders">
                {paginatedFolders.map(group => (
                  <button type="button" key={group.id}
                    data-icon-surface="folder"
                    className={`${styles.folderChoice} ${!isSearchingCourses && openFolder?.id === group.id ? styles.folderChoiceSelected : ""}`}
                    aria-pressed={!isSearchingCourses && openFolder?.id === group.id} aria-controls="course-folder-content" title={group.name}
                    onClick={() => chooseFolder(group.id)}>
                    <LearningInnovationIcon kind="folder" className={styles.folderArtwork} />
                    {!isSearchingCourses && openFolder?.id === group.id && <span className={styles.folderSelectedMark} aria-hidden="true">✓</span>}
                    <span className={styles.folderChoiceText}>
                      <strong className={styles.illustratedTitle}><LearningAccent kind="collection" /><span className={styles.folderNameText}>{group.name}</span></strong>
                    </span>
                    <span className={styles.folderCourseCount}>{group.courses.length} {group.courses.length === 1 ? "course" : "courses"}</span>
                  </button>
                ))}
              </div>
              {folderTotalPages > 1 && (
                <nav className={styles.folderPageNav} aria-label="Folder pages">
                  <span>{folderPage} / {folderTotalPages}</span>
                  <div>
                    <button type="button" disabled={folderPage === 1} onClick={() => changeFolderPage(folderPage - 1)} aria-label="Previous folder page">←</button>
                    <button type="button" disabled={folderPage === folderTotalPages} onClick={() => changeFolderPage(folderPage + 1)} aria-label="Next folder page">→</button>
                  </div>
                </nav>
              )}
            </aside>
            <div className={`${styles.libraryFolderSections} ${!selectedCourse && !isSearchingCourses ? styles.catalogPane : ""}`} id="course-folder-content" ref={coursePaneRef}
              tabIndex={-1} role="region" aria-label={isSearchingCourses ? "Course library" : `${openFolder?.name || "Course library"} courses`}>
            {selectedCourse ? renderCourseSections(selectedCourse) : groupedCourses.length === 0 ? (
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
                  onClick={() => changeSearchQuery("")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              visibleCourseGroups.map((group) => {
                const totalCourses = group.courses.length;
                const totalPages = Math.max(1, Math.ceil(totalCourses / COURSES_PER_PAGE));
                const currentPage = Math.min(Math.max(1, groupPages[group.id] || 1), totalPages);
                const startIndex = (currentPage - 1) * COURSES_PER_PAGE;
                const paginatedCourses = group.courses.slice(startIndex, startIndex + COURSES_PER_PAGE);
                const aiTraining = group.name.trim().replace(/\s+/g, " ").toLowerCase() === "ai training";

                return (
                  <div key={group.id} className={`${styles.libraryFolderGroup} ${!isSearchingCourses ? styles.singleCourseGroup : ""}`}>
                    {isSearchingCourses && (
                      <div className={styles.libraryFolderHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <LearningAccent kind="collection" />
                          <h2 className={styles.libraryFolderTitle}>{group.name}</h2>
                        </div>
                        <div className={styles.libraryFolderHeaderRight}>
                          <span className={styles.libraryFolderBadge}>
                            {totalCourses} {totalCourses === 1 ? "COURSE" : "COURSES"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className={styles.courseFolderGrid} ref={!isSearchingCourses ? courseGridRef : undefined}>
                      {paginatedCourses.map(course => (
                        <article className={styles.courseFolder} key={course.id} data-icon-surface="course" aria-labelledby={`course-title-${course.id}`}>
                          {aiTraining && ["top", "bottom"].map(edge => <svg key={edge} className={styles.courseElectric} data-edge={edge}
                            viewBox="0 0 600 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                            <path className={styles.electricTrack} d="M0 4h200l8-2h184l8 2h200" vectorEffect="non-scaling-stroke" />
                            <path className={styles.electricPulse} d="M0 4h200l8-2h184l8 2h200" pathLength="100" vectorEffect="non-scaling-stroke" />
                          </svg>)}
                          <h3 className={`${styles.courseTitle} ${styles.illustratedTitle}`} id={`course-title-${course.id}`} title={course.title}><LearningAccent /><span className={styles.courseNameText}>{course.title}</span></h3>
                          <div className={styles.courseCardMain}>
                            <div className={styles.courseCardBody}>
                              <p className={styles.courseDesc}>{course.description ?? ""}</p>
                              <CourseToolRow tools={course.systemIcons} />
                            </div>
                          </div>
                          <div className={styles.folderBadgesRow}>
                            <span className={styles.courseSectionBadge}>
                              {course.sections.length} {course.sections.length === 1 ? "SECTION" : "SECTIONS"}
                            </span>
                            <span className={styles.folderLanguage}>
                              {course.languageLabel === "vi" ? "Vietnamese" : course.languageLabel === "en" ? "English" : "Vietnamese · English"}
                            </span>
                            <span className={styles.unlockedFolderBadge}>
                              <i className={styles.dotUnlocked} aria-hidden="true" /><span>UNLOCKED</span>
                            </span>
                          </div>
                          <button type="button" className={styles.courseEnterButton} id={`course-choice-${course.id}`}
                            aria-label={`Open sections for ${course.title}`} onClick={() => {
                              courseScrollTop.current = (isSearchingCourses ? coursePaneRef.current : courseGridRef.current)?.scrollTop ?? 0;
                              iconTilt.onPointerLeave();
                              rememberDeckSelection(course.id, null, false, { course: course.slug });
                              setSelectedCourseId(course.id);
                              setMobileFoldersOpen(false);
                            }}>
                            <LearningInnovationIcon kind="course" className={styles.enterArtwork} electric={aiTraining} />
                          </button>
                        </article>
                      ))}
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
        onChooseSection={(keyboard = false) => {
          cancelSectionOpening();
          if (launchingSection) {
            setLaunchingSection(null);
            rememberDeckSelection(selectedCourse.id, null, false, { course: selectedCourse.slug });
            return;
          }
          iconTilt.onPointerLeave();
          if (selectedCourseId) restoreCourseFocus.current = { id: selectedCourseId, keyboard };
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
        {launchingSection ? sectionOpenError ? (
          <div role="alert" className={styles.sectionOpenError}>
            <p>{sectionOpenError}</p>
            <button type="button" onClick={() => {
              const item = selectedCourse.sections.find(item => item.sectionKey === launchingSection);
              if (item) handleLaunchBuiltin(selectedCourse, item, launchingSection);
            }}>Try again</button>
          </div>
        ) : <HairlineLoading label="Opening lesson" /> : activeUploadedSection ? (
          <UploadedSectionDeck
            key={`${activeUploadedSection.id}-${activeUploadedSection.contentRevision ?? ""}-${activeUploadedSection.templateKey ?? ""}-${deckSessionKey}`}
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
