"use client";

import dynamic from "next/dynamic";
import { useLearningLanguage } from "@/lib/learningLanguage";
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

function ActionIcon({ kind }: { kind: "access" | "learning" | "teaching" | "ai" | "report" | "reset" | "signout" }) {
  return <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === "access" ? <><path d="m10 3-.6 2.2-2 .9-2-.7-2 3.4 1.6 1.5v2.4l-1.6 1.5 2 3.4 2-.7 2 .9L10 21h4l.6-2.2 2-.9 2 .7 2-3.4-1.6-1.5v-2.4l1.6-1.5-2-3.4-2 .7-2-.9L14 3Z" /><circle cx="12" cy="12" r="3" /></>
      : kind === "learning" ? <><path d="M12 6C9 3.5 5 3.5 2 5v14c3-1.5 7-1.5 10 1 3-2.5 7-2.5 10-1V5c-3-1.5-7-1.5-10 1Z" fill="currentColor" fillOpacity=".14" /><path d="M12 6v14M5 8l4 1M5 12l4 1m6-4 4-1m-4 5 4-1" /></>
      : kind === "teaching" ? <><path d="M8 3h14v12H11M15 7h4m-6 4h6M15 15v5m-3 1 3-1 3 1" /><circle cx="5" cy="9" r="2.5" fill="currentColor" fillOpacity=".2" /><path d="M1 21v-4a4 4 0 0 1 4-4h2l5-5M5 17v4" /></>
      : kind === "ai" ? <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4m-2-2h4" /></>
      : kind === "report" ? <><path d="M10 3h11v18H10Z" fill="#21a366" stroke="#107c41" /><path d="M14 7h4m-4 5h4m-4 5h4" stroke="#fff" strokeWidth="1.2" /><path d="M2 6h11v12H2Z" fill="#107c41" stroke="#107c41" /><path d="m5 9 5 6m0-6-5 6" stroke="#fff" /></>
      : kind === "reset" ? <><path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" /><path d="M12 8v5l3 2" /></>
      : <><path d="M10 4H4v16h6m4-13 5 5-5 5m-6-5h11" /></>}
  </svg>;
}
type HierarchyChoice = { folder: string; course: string; section: string };
function HierarchyScopeFields({ folders, courses, sections, value, onChange, disabled }: {
  folders: ReportSectionOption[]; courses: ReportCourseOption[]; sections: ReportScopeOption[];
  value: HierarchyChoice; onChange: (value: HierarchyChoice) => void; disabled: boolean;
}) {
  const { t } = useLearningLanguage();
  const courseOptions = courses.filter(course => value.folder === "all" || course.folderGroupId === value.folder);
  const sectionOptions = sections.filter(section => (value.folder === "all" || section.folderGroupId === value.folder) && (value.course === "all" || section.courseId === value.course));
  return <>
    <label className={styles.exportSectionField}><span>{t("Folder scope")}</span>
      <select value={value.folder} onChange={event=>onChange({folder:event.target.value,course:"all",section:"all"})} disabled={disabled}>
        <option value="all">{t("All folders")} ({folders.length})</option>
        {folders.map(folder=><option key={folder.value} value={folder.value}>{folder.label}</option>)}
      </select>
    </label>
    <label className={styles.exportSectionField}><span>{t("Course scope")}</span>
      <select value={value.course} onChange={event=>onChange({...value,course:event.target.value,section:"all"})} disabled={disabled}>
        <option value="all">{t("All courses")} ({courseOptions.length})</option>
        {value.folder === "all" ? folders.map(folder=><optgroup key={folder.value} label={folder.label}>
          {courseOptions.filter(course=>course.folderGroupId===folder.value).map(course=><option key={course.value} value={course.value}>{course.label}</option>)}
        </optgroup>) : courseOptions.map(course=><option key={course.value} value={course.value}>{course.label}</option>)}
      </select>
    </label>
    <label className={styles.exportSectionField}><span>{t("Section scope")}</span>
      <select value={value.section} onChange={event=>onChange({...value,section:event.target.value})} disabled={disabled}>
        <option value="all">{t("All sections")} ({sectionOptions.length})</option>
        {value.course === "all" ? courseOptions.map(course=><optgroup key={course.value} label={`${folders.find(folder=>folder.value===course.folderGroupId)?.label || ""} / ${course.label}`}>
          {sectionOptions.filter(section=>section.courseId===course.value).map(section=><option key={section.value} value={section.value}>{section.label}</option>)}
        </optgroup>) : sectionOptions.map(section=><option key={section.value} value={section.value}>{section.label}</option>)}
      </select><small>{t("New courses and sections appear automatically.")}</small>
    </label>
  </>;
}

type TerminateStatus = "idle" | "sending" | "success" | "error";
type ReportStatus = "idle" | "exporting" | "error";
type ReportSectionOption = { value: string; label: string };
type ReportScopeOption = ReportSectionOption & { courseId: string; courseTitle: string; folderGroupId: string };
type ReportCourseOption = ReportSectionOption & { folderGroupId: string };
type CourseFolderSection = {
  canFacilitate?: boolean;
  hidden?: boolean;
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
  hidden?: boolean;
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
  bySection?: Record<string,number>;
  byCourse?: Record<string,number>;
  byFolder?: Record<string,number>;
}

function FunctionDropdown({ children, languagePicker = false }: { children: ReactNode; languagePicker?: boolean }) {
  const { t, language } = useLearningLanguage();
  const menuId = languagePicker ? "course-languages" : "course-functions";
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className={languagePicker ? `${styles.languageDropdown} ${styles.languageControl}` : styles.functionDropdown} ref={container}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} id={`${menuId}-trigger`} type="button" className={languagePicker ? styles.languageTrigger : styles.functionTrigger} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
      {languagePicker ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>}
      {languagePicker ? <><span className={styles.languageButtonLabel}>{t("Language", "Ngôn ngữ")} · </span>{language === "vi" ? "VIE" : "ENG"}</> : t("Functions")}
      <svg className={styles.functionChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <nav id={menuId} aria-label={languagePicker ? t("Language", "Ngôn ngữ") : t("Course functions")} data-function-menu={languagePicker ? undefined : true} data-language-menu={languagePicker ? true : undefined} className={styles.selectorActions}
      onClick={event => { if ((event.target as Element).closest("a,button")) { setOpen(false); if (languagePicker) trigger.current?.focus(); } }}>{children}</nav>}
  </div>;
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
  value,
  label,
}: {
  counts: PresenceCounts;
  currentSection?: SectionId | null;
  value?: number;
  label?: string;
}) {
  const { t } = useLearningLanguage();
  const activeCount =
    value !== undefined ? value : currentSection === "section1"
      ? counts.section1
      : currentSection === "section2"
        ? counts.section2
        : counts.total;

  const sectionLabel =
    label || (currentSection === "section1"
      ? "Section 1"
      : currentSection === "section2"
        ? "Section 2"
        : "Online");

  return (
    <div
      className={styles.activeUsersWidget}
      aria-label={`${activeCount} learners active in ${sectionLabel}`}
    >
      <span className={styles.liveDot} aria-hidden="true" />
      {sectionLabel !== "Online" && <><span className={styles.liveSectionLabel}>{sectionLabel}</span><span className={styles.liveUsersDivider}>·</span></>}
      <strong className={styles.activeUsersCount}>
        {activeCount}
      </strong>
      <span className={styles.liveUsersUnit}>{t("online", "trực tuyến")}</span>
    </div>
  );
}

function DeckShell({
  children,
  isAdmin,
  canFacilitate,
  presenceCounts,
  currentSection,
  currentSectionId,
  currentSectionTitle,
  statusNotice,
  onChooseSection,
  onOpenTerminate,
  onSignOut,
  onExitPreview,
  courseTitle,
}: {
  children: ReactNode;
  isAdmin: boolean;
  canFacilitate: boolean;
  presenceCounts: PresenceCounts;
  currentSection?: SectionId | null;
  currentSectionId?: string;
  currentSectionTitle?: string;
  statusNotice?: string;
  onChooseSection?: (keyboard?: boolean) => void;
  onOpenTerminate?: () => void;
  onSignOut: () => void;
  onExitPreview?: () => void;
  courseTitle: string;
}) {
  const { t } = useLearningLanguage();
  return (
    <div className={styles.lessonShell}>
      <div className={styles.deckViewport}>{children}</div>

      <aside className={styles.actionBar} aria-label={t("Session controls")}>
        <div className={styles.actionBarIdentity} aria-live="polite">
          <span>EIU · {courseTitle.toUpperCase()}</span>
          <strong>
            {(statusNotice && t(statusNotice)) || (isAdmin ? t("Admin mode") : canFacilitate ? t("Teaching mode") : t("Learning session"))}
          </strong>
        </div>

        {canFacilitate && presenceCounts && (
          <ActiveUsersTaskbarWidget
            counts={presenceCounts}
            currentSection={currentSection}
            value={currentSectionId ? presenceCounts.bySection?.[currentSectionId] ?? 0 : undefined}
            label={currentSectionTitle}
          />
        )}

        <div className={styles.actionBarButtons}>
          {onExitPreview && <button type="button" className={styles.secondaryButton} onClick={onExitPreview}>{t("Back to admin", "Quay lại admin")}</button>}
          {isAdmin && (
            <Link href="/admin/access">
              <ActionIcon kind="access" />{t("Access settings")}</Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/ai"
              className={styles.aiButton}
            >
              <ActionIcon kind="ai" />{t("AI Knowledge")}</Link>
          )}
          {onChooseSection && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={event => onChooseSection(event.detail === 0)}
            >{t("Courses")}</button>
          )}

          {isAdmin && onOpenTerminate && (
            <button
              type="button"
              className={styles.terminateBtn}
              onClick={onOpenTerminate}
            >{t("Terminate Section")}</button>
          )}

          <button
            type="button"
            className={styles.signOutButton}
            onClick={onSignOut}
          >
            <ActionIcon kind="signout" />{t("Sign out")}</button>
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
  isAdmin: sessionIsAdmin,
  canFacilitate: sessionCanFacilitate = false,
  courseFolders: sessionCourseFolders,
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
  const { t, language, setLanguage } = useLearningLanguage();
  const router = useRouter();
  const iconTilt = useInnovationTilt();
  // Preview changes presentation only; the administrator session stays intact.
  // Keep session-bound polling independent of this local mode.
  const [accessPreview, setAccessPreview] = useState<"learning" | "teaching" | null>(null);
  const previewMode = sessionIsAdmin ? accessPreview : null;
  const isAdmin = sessionIsAdmin && previewMode === null;
  const canFacilitate = previewMode ? previewMode === "teaching" : sessionCanFacilitate;
  const courseFolders = useMemo(() => !previewMode ? sessionCourseFolders : sessionCourseFolders
    .filter(course => !course.hidden)
    .map(course => ({ ...course, sections: course.sections.filter(item => !item.hidden)
      .map(item => ({ ...item, canFacilitate: previewMode === "teaching" })) }))
    .filter(course => course.sections.length > 0), [sessionCourseFolders, previewMode]);
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
  const [exportCourse, setExportCourse] = useState("all");
  const [exportFolder, setExportFolder] = useState("all");
  const [reportFolders, setReportFolders] = useState<ReportSectionOption[]>([]);
  const [reportCourses, setReportCourses] = useState<ReportCourseOption[]>([]);
  const [reportScopes, setReportScopes] = useState<ReportScopeOption[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetFolder, setResetFolder] = useState("all");
  const [resetCourse, setResetCourse] = useState("all");
  const [resetSection, setResetSection] = useState("all");
  const [scopeMetadataReady, setScopeMetadataReady] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [resetNotice, setResetNotice] = useState("");
  const learnerProfile = initialProfile;
  const hasLearnerProfile = Boolean(learnerProfile);
  const [deckSessionKey, setDeckSessionKey] = useState(0);

  function changeAccessPreview(mode: "learning" | "teaching" | null) {
    if (!sessionIsAdmin || mode === previewMode) return;
    cancelSectionOpening();
    iconTilt.onPointerLeave();
    setLaunchingSection(null);
    setAdminSection(null);
    setActiveUploadedSection(null);
    setShowExportModal(false);
    setShowResetModal(false);
    setShowTerminate(false);
    rememberDeckSelection();
    setAccessPreview(mode);
  }

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

  const COURSES_PER_PAGE = 12;
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
  const sectionSlideCounts = useSectionSlideCounts(selectedCourse?.id ?? "", sectionsToCount, isAdmin || previewMode === "teaching");

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

  const activeLessonSection = activeUploadedSection || selectedCourse?.sections.find(item => item.sectionKey === section);
  const activeSectionId = activeLessonSection?.id;
  const canFacilitateCurrent = isAdmin || Boolean(activeLessonSection?.canFacilitate);
  const resetScopes = reportScopes.filter(scope => (resetFolder === "all" || scope.folderGroupId === resetFolder) && (resetCourse === "all" || scope.courseId === resetCourse));
  const resetScopeValid = scopeMetadataReady && (resetFolder === "all" || reportFolders.some(folder=>folder.value===resetFolder))
    && (resetCourse === "all" || reportCourses.some(course=>course.value===resetCourse && (resetFolder==="all" || course.folderGroupId===resetFolder)))
    && (resetSection === "all" || resetScopes.some(scope=>scope.value===resetSection))
    && (resetScopes.length > 0 || resetFolder==="all" && resetCourse==="all" && resetSection==="all");
  const resetIsGlobal = resetFolder === "all" && resetCourse === "all" && resetSection === "all";
  const resetSectionLabel = [resetFolder === "all" ? t("All folders") : reportFolders.find(folder=>folder.value===resetFolder)?.label,
    resetCourse === "all" ? t("All courses") : reportCourses.find(course=>course.value===resetCourse)?.label,
    resetSection === "all" ? `${t("All sections")} (${resetScopes.length})` : resetScopes.find(scope=>scope.value===resetSection)?.label].filter(Boolean).join(" / ");

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
          folders?: ReportSectionOption[];
          courses?: ReportCourseOption[];
          courseSections?: ReportScopeOption[];
        };
        if (!response.ok || !payload.success || !Array.isArray(payload.folders) || !Array.isArray(payload.courses) || !Array.isArray(payload.courseSections)) throw new Error("Unable to load current folder, course and section scopes. Reopen this dialog to retry.");
        if (disposed) return;
        setScopeMetadataReady(Array.isArray(payload.folders) && Array.isArray(payload.courses) && Array.isArray(payload.courseSections));
        if (Array.isArray(payload.folders)) setReportFolders(payload.folders);
        if (Array.isArray(payload.courses)) setReportCourses(payload.courses);
        if (Array.isArray(payload.courseSections)) setReportScopes(payload.courseSections);
        setExportCourse(current => current === "all" || payload.courses?.some(course => course.value === current) ? current : "all");
        setExportFolder(current => current === "all" || payload.folders?.some(folder => folder.value === current) ? current : "all");
        setExportSection((current) =>
          current === "all" || payload.courseSections?.some((section) => section.value === current)
            ? current
            : "all"
        );
      } catch (error) {
        if (!disposed && showResetModal) { setResetStatus("error"); setResetNotice(error instanceof Error ? error.message : "Unable to load reset scopes."); }
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
    if (!sessionIsAdmin && !sessionCanFacilitate) return;

    let disposed = false;
    let refreshTimer: number | undefined;
    let inFlight = false;
    let refreshQueued = false;
    let lastRequestedAt = 0;
    const controller = new AbortController();

    async function fetchCounts() {
      if (disposed || document.visibilityState !== "visible") return;
      if (inFlight) { refreshQueued = true; return; }
      if (lastRequestedAt && Date.now() - lastRequestedAt < 750) {
        if (!refreshTimer) refreshTimer = window.setTimeout(() => { refreshTimer=undefined;void fetchCounts(); },750-(Date.now()-lastRequestedAt));
        return;
      }
      lastRequestedAt=Date.now();
      inFlight = true;
      try {
        const response = await fetch("/api/presence?scope=all", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]) });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          success?: boolean;
          counts?: PresenceCounts;
        };
        if (!disposed && payload.success && payload.counts) {
          const counts = payload.counts;
          setPresenceCounts(previous => JSON.stringify(previous) === JSON.stringify(counts) ? previous : counts);
        }
      } catch {
        // Ignore network glitches
      } finally {
        inFlight = false;
        if (!disposed && refreshQueued) {
          refreshQueued = false;
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => { refreshTimer = undefined; void fetchCounts(); }, 80);
        }
      }
    }

    void fetchCounts();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel("eiu:presence")
      .on("broadcast", { event: "presence_changed" }, () => {
        if (!refreshTimer) refreshTimer = window.setTimeout(() => { refreshTimer=undefined;void fetchCounts(); }, 80);
      })
      .subscribe(status => { if (status === "SUBSCRIBED") void fetchCounts(); });
    const interval = window.setInterval(() => void fetchCounts(), 5_000);
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
  }, [sessionIsAdmin, sessionCanFacilitate]);

  // One presence stream covers built-in lessons, JS, PDF and PPTX sections.
  // Opening is logged once; steady heartbeats only update the active row.
  useEffect(() => {
    if (sessionIsAdmin || canFacilitateCurrent || !hasLearnerProfile || !activeSectionId) return;
    const clientId = getOrCreateClientId();
    const sectionId = activeSectionId;
    const entryId = `${clientId}:${sectionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    let disposed = false, inFlight = false, leaveSent = false, needsEntry = true, resumeQueued = false;
    const controller = new AbortController();
    function onLeave() {
      if(!leaveSent && navigator.sendBeacon)leaveSent=navigator.sendBeacon("/api/presence",JSON.stringify({action:"leave",sectionId,clientId}));
    }
    async function sendHeartbeat() {
      if (disposed || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;leaveSent = false;
      try {
        const response = await fetch("/api/presence", {
          method: "POST", signal: AbortSignal.any([controller.signal,AbortSignal.timeout(15_000)]),
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({action:needsEntry ? "enter" : "heartbeat",sectionId,clientId,entryId}),
        });
        if(response.ok) needsEntry=false;
      } catch { /* A later heartbeat retries without blocking the lesson. */ }
      finally {
        inFlight=false;
        if(disposed || document.visibilityState !== "visible") { resumeQueued=false;leaveSent=false;onLeave(); }
        else if(resumeQueued) { resumeQueued=false;void sendHeartbeat(); }
      }
    }
    void sendHeartbeat();
    const heartbeatTimer = window.setInterval(()=>void sendHeartbeat(),20_000);
    const onVisibility = () => {
      if(document.visibilityState === "visible") { if(inFlight)resumeQueued=true;else void sendHeartbeat(); }
      else onLeave();
    };
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("pagehide",onLeave);
    return ()=>{
      disposed=true;controller.abort();window.clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("pagehide",onLeave);onLeave();
    };
  },[sessionIsAdmin,canFacilitateCurrent,hasLearnerProfile,activeSectionId]);


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
        `/api/admin/report?date=${encodeURIComponent(dateParam)}&tzOffset=${encodeURIComponent(tzOffset)}&folderId=${encodeURIComponent(exportFolder)}&courseId=${encodeURIComponent(exportCourse)}&sectionId=${encodeURIComponent(exportSection)}`,
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
    if (!sessionIsAdmin && !canFacilitateCurrent && activeSectionId) {
      const clientId = getOrCreateClientId();
      await fetch("/api/presence", {
        method: "POST",
        signal: AbortSignal.timeout(3000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", sectionId:activeSectionId, clientId }),
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

    if (!resetScopeValid) { setResetStatus("error"); setResetNotice("Load and choose a valid reset scope first."); return; }
    setResetStatus("sending");
    setResetNotice("");

    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
          folderId: resetFolder,
          courseId: resetCourse,
          sectionId: resetSection,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        legacySections?: string[];
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "The confirmation value is incorrect.");
      }

      setResetStatus("success");
      setResetNotice(payload.message || `Data for ${resetSectionLabel} was deleted.`);
      for (const section of payload.legacySections || []) {
        if (section === "section1" || section === "section2") clearSlideInteractionStorage(section);
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
    if (sessionIsAdmin || !section) return;

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
  }, [sessionIsAdmin, section]);

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
        role="region" aria-label={`${course.title} · ${t("sections", "học phần")}`} tabIndex={-1} ref={sectionListRef}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closeCourse(true); } }}>
        <div className={styles.inlineSectionsHeader}>
          <div>
            <h2 className={styles.illustratedTitle}><LearningAccent /><span>{course.title}</span></h2>
            {course.description && <p>{course.description}</p>}
          </div>
          <button type="button" className={styles.backToCourses} onClick={event => closeCourse(event.detail === 0)} aria-label={t("Back to courses")}>
            <svg className={styles.backToCoursesArrow} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19 12H5m7 7-7-7 7-7" />
            </svg>
            <span className={styles.backToCoursesLabel}>{t("Courses")}</span>
          </button>
        </div>
        <div className={styles.sectionTools}>
          {Boolean(course.systemIcons?.length) && <CourseToolRow tools={course.systemIcons} />}
          <span className={styles.sectionTotal}>{course.sections.length} {t("sections", "học phần")}</span>
        </div>
        {sectionOpenError && <p role="alert" className={styles.sectionOpenError}>{t(sectionOpenError)}</p>}
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
                  <span data-energy-exclude>{t("SECTION")} {courseSection.position}</span>
                  <strong data-energy-exclude className={styles.illustratedTitle}><LearningAccent kind="page" /><span>{courseSection.title}</span></strong>
                  {canOpen && <div className={styles.sectionEnergySpace} aria-hidden="true" />}
                  <small data-energy-exclude className={canOpen ? styles.sectionSlideBadge : undefined} aria-live="polite" aria-atomic="true">
                    {canOpen ? <>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="7" width="14" height="13" rx="2" /><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2M11 12h6m-6 4h4" /></svg>
                      <b className={styles.sectionSlideCount}>{count ?? "…"}</b>
                      <span> {t("slides", "trang trình chiếu")}</span>
                    </> : t("Content has not been uploaded yet")}
                  </small>
                  {(isAdmin || courseSection.canFacilitate) && <div data-energy-exclude className={styles.cardLiveUsers}>
                    <span className={styles.liveDot} />
                    <span>{presenceCounts.bySection?.[courseSection.id] ?? (coreSection ? presenceCounts[coreSection] : 0)} {t("online", "trực tuyến")}</span>
                  </div>}
                  {canOpen && <button type="button" className={styles.sectionClickCue}
                    data-energy-exclude
                    aria-label={`${t("Open", "Mở")} ${courseSection.title}`}
                    disabled={Boolean(openingSection)}
                    aria-busy={openingSection === courseSection.sectionKey}
                  onClick={() => {
                    if (coreSection) handleLaunchBuiltin(course, courseSection, coreSection);
                    else if (hasUploadedDeck) { iconTilt.onPointerLeave();
    deckOpenRef.current = true; rememberDeckSelection(course.id, courseSection.id, true, { course: course.slug, section: courseSection.sectionKey }); setActiveUploadedSection(courseSection); }
                  }}
                  >
                    <LearningInnovationIcon kind="section" className={styles.sectionClickArtwork} active={openingSection === courseSection.sectionKey} />
                  </button>}
                </article>
                {coreSection && courseSection.contentType === "pptx" && (
                  <button type="button" className={styles.sectionFilePreview} disabled={Boolean(openingSection)} onClick={() => { rememberDeckSelection(course.id, courseSection.id, true, { course: course.slug, section: courseSection.sectionKey }); setAdminSection(null); setActiveUploadedSection(courseSection); }}>{t("View file")}</button>
                )}
                {hasUploadedDeck && courseSection.contentType !== "tsx" && course.id !== "a857595d-def0-4543-9216-a680c6abfe26" && !course.title?.includes("Web App") && (
                  <a
                    className={styles.sectionPptxLink}
                    href={`/api/sections/${encodeURIComponent(courseSection.id)}/content?download=1`}
                    download={courseSection.sourceFilename || "Presentation."+courseSection.contentType}
                    aria-label={t("Download the original presentation")}
                  >{t("Download")}</a>
                )}
                </div>
              );
            })}
            {course.sections.length === 0 && <p>{t("This course does not have any sections yet.")}</p>}
          </div>
      </div>
    );
  }

  if (!selectedCourse || (!section && !activeUploadedSection && !launchingSection)) {
    return (
      <main className={`${styles.portal} ${styles.innovationPortal}`} lang={language} {...iconTilt}>
        <div className={styles.innovationBackdrop} aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} className={styles.networkParticle} />)}
        </div>
        <LearningIcon3DLayer />

        <section className={`${styles.panel} ${styles.learningSpacePanel}`}>
          <div className={styles.libraryMasthead}>
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
              <span>{isAdmin ? t("ADMIN LEARNING SPACE") : t("MY LEARNING SPACE")}</span>
              <strong>EIU Interactive Learning Space</strong>
            </div>
          </div>

          <div className={styles.mastheadActions}>
          {sessionIsAdmin && <div className={styles.accessModes}>
            <button type="button" className={styles.accessModeButton} data-access-preview="learning" aria-pressed={previewMode === "learning"} onClick={() => changeAccessPreview("learning")}><ActionIcon kind="learning" />{t("Learning Access", "Learning Access")}</button>
            <button type="button" className={styles.accessModeButton} data-access-preview="teaching" aria-pressed={previewMode === "teaching"} onClick={() => changeAccessPreview("teaching")}><ActionIcon kind="teaching" />{t("Teaching Access", "Teaching Access")}</button>
          </div>}
          <FunctionDropdown languagePicker>
            {(["vi", "en"] as const).map(code => <button key={code} type="button" className={styles.languageOption} data-language-option={code} aria-pressed={language === code} onClick={() => setLanguage(code)}>
              {code === "vi" ? t("Vietnamese") : t("English")}<span aria-hidden="true">{language === code ? "✓" : ""}</span>
            </button>)}
          </FunctionDropdown>
          <FunctionDropdown>
          {isAdmin && <Link href="/admin/access" className={styles.accessButton}><ActionIcon kind="access" />{t("Access settings")}</Link>}
          {isAdmin && <Link href="/admin/ai" className={styles.aiButton}><ActionIcon kind="ai" />{t("AI Knowledge")}</Link>}
          {isAdmin && (
            <button
              type="button"
              className={styles.reportButton}
              onClick={() => {
                setScopeMetadataReady(false);
                setReportNotice("");
                setShowExportModal(true);
              }}
              disabled={reportStatus === "exporting"}
            >
              <ActionIcon kind="report" />{reportStatus === "exporting" ? t("Exporting…") : t("Report")}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={styles.resetDataButton}
              onClick={() => {
                setScopeMetadataReady(false);
                setResetFolder(selectedCourse?.folderGroupId || openFolder?.id || "all");
                setResetCourse(selectedCourse?.id || "all");
                setResetSection("all");
                setResetPassword("");
                setResetStatus("idle");
                setResetNotice("");
                setShowResetModal(true);
              }}
            >
              <ActionIcon kind="reset" />{t("Reset data")}</button>
          )}
          <button type="button" className={styles.signOutButton} onClick={signOut}><ActionIcon kind="signout" />{t("Sign out")}</button>
        </FunctionDropdown>
          </div>
          </div>

          {previewMode && <div className={styles.accessPreviewBar} data-access-preview-mode={previewMode}>
            <span role="status">{t("Preview", "Xem thử")} · {previewMode === "learning" ? "Learning Access" : "Teaching Access"}</span>
            <button type="button" className={styles.functionTrigger} onClick={() => changeAccessPreview(null)}>{t("Back to admin", "Quay lại admin")}</button>
          </div>}

          <div className={styles.libraryHeaderToolbar}>
            <div className={styles.libraryHeaderTitleArea}>
              <CourseDiscoveryHeading onlineCount={isAdmin || canFacilitate ? presenceCounts.total : undefined} />
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
                  placeholder={t("Search courses or topics...")}
                  value={searchQuery}
                  onChange={(e) => changeSearchQuery(e.target.value)}
                  aria-label={t("Search courses")}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={() => changeSearchQuery("")}
                    aria-label={t("Clear search")}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.libraryWorkspace}>
            <button type="button" id="mobile-folder-toggle" className={styles.mobileFolderToggle} aria-expanded={mobileFoldersOpen}
              aria-controls="folder-navigation" onClick={() => setMobileFoldersOpen(value => !value)}>
              <span><strong className={styles.illustratedTitle}><LearningAccent kind="collection" /><span>{openFolder?.name || t("Course folders")}</span></strong></span>
              <span aria-hidden="true">{mobileFoldersOpen ? "−" : "+"}</span>
            </button>
            <aside id="folder-navigation"
              className={`${styles.folderNavigation} ${mobileFoldersOpen ? styles.mobileFoldersOpen : ""}`} aria-label={t("Folder navigation")}
              onKeyDown={event => {
                if (event.key === "Escape" && mobileFoldersOpen) {
                  setMobileFoldersOpen(false);
                  document.getElementById("mobile-folder-toggle")?.focus({ preventScroll: true });
                }
              }}>
              <div className={styles.folderShelf} role="group" aria-label={t("Course folders")}>
                {paginatedFolders.map(group => (
                  <button type="button" key={group.id}
                    data-icon-surface="folder"
                    className={`${styles.folderChoice} ${!isSearchingCourses && openFolder?.id === group.id ? styles.folderChoiceSelected : ""}`}
                    aria-pressed={!isSearchingCourses && openFolder?.id === group.id} aria-controls="course-folder-content"
                    onClick={() => chooseFolder(group.id)}>
                    <LearningInnovationIcon kind="folder" className={styles.folderArtwork} />
                    {!isSearchingCourses && openFolder?.id === group.id && <span className={styles.folderSelectedMark} aria-hidden="true">✓</span>}
                    <span className={styles.folderChoiceText}>
                      <strong className={styles.illustratedTitle}><LearningAccent kind="collection" /><span className={styles.folderNameText}>{group.name}</span></strong>
                    </span>
                    <span className={styles.folderMetaRow}>
                      {(isAdmin || canFacilitate) && <span className={styles.folderLearners}><i className={styles.liveDot} aria-hidden="true" />{presenceCounts.byFolder?.[group.id] ?? 0} {t("online", "trực tuyến")}</span>}
                      <span className={styles.folderCourseCount}>{group.courses.length} {group.courses.length === 1 ? t("course") : t("courses")}</span>
                    </span>
                  </button>
                ))}
              </div>
              {folderTotalPages > 1 && (
                <nav className={styles.folderPageNav} aria-label={t("Folder pages")}>
                  <span>{folderPage} / {folderTotalPages}</span>
                  <div>
                    <button type="button" disabled={folderPage === 1} onClick={() => changeFolderPage(folderPage - 1)} aria-label={t("Previous folder page")}>←</button>
                    <button type="button" disabled={folderPage === folderTotalPages} onClick={() => changeFolderPage(folderPage + 1)} aria-label={t("Next folder page")}>→</button>
                  </div>
                </nav>
              )}
            </aside>
            <div className={`${styles.libraryFolderSections} ${!selectedCourse && !isSearchingCourses ? styles.catalogPane : ""}`} id="course-folder-content" ref={coursePaneRef}
              tabIndex={-1} role="region" aria-label={isSearchingCourses ? t("Course library") : `${openFolder?.name || t("Course library")} courses`}>
            {selectedCourse ? renderCourseSections(selectedCourse) : groupedCourses.length === 0 ? (
              <div className={styles.emptySearch}>
                <div className={styles.emptySearchIcon} aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e9ca8b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3>{t("No courses found")}</h3>
                <p>{t(`No courses match “${searchQuery}”. Try another keyword or clear search.`, `Không tìm thấy khóa học phù hợp với “${searchQuery}”. Thử từ khóa khác hoặc xóa tìm kiếm.`)}</p>
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => changeSearchQuery("")}
                >{t("Clear search")}</button>
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
                            {totalCourses} {totalCourses === 1 ? t("COURSE") : t("COURSES")}
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
                          <div className={styles.courseCardHeader}>
                            <h3 className={`${styles.courseTitle} ${styles.illustratedTitle}`} id={`course-title-${course.id}`}><LearningAccent /><span className={styles.courseNameText}>{course.title}</span></h3>
                            {(isAdmin || course.sections.some(item=>item.canFacilitate)) && <span className={styles.courseLearners}><i className={styles.liveDot} aria-hidden="true" />{presenceCounts.byCourse?.[course.id] ?? 0} {t("online", "trực tuyến")}</span>}
                          </div>
                          <div className={styles.courseCardMain}>
                            <div className={styles.courseCardBody}>
                              <p className={styles.courseDesc}>{course.description ?? ""}</p>
                              <CourseToolRow tools={course.systemIcons} />
                            </div>
                          </div>
                          <div className={styles.folderBadgesRow}>
                            <span className={styles.courseSectionBadge}>
                              {course.sections.length} {course.sections.length === 1 ? t("SECTION") : t("SECTIONS")}
                            </span>
                            <span className={styles.folderLanguage}>
                              <span className={styles.languageFull}>{course.languageLabel === "vi" ? t("Vietnamese") : course.languageLabel === "en" ? t("English") : t("Vietnamese · English")}</span>
                              <span className={styles.languageShort}>{course.languageLabel === "vi" ? "VI" : course.languageLabel === "en" ? "EN" : "VI · EN"}</span>
                            </span>
                            <span className={styles.unlockedFolderBadge}>
                              <i className={styles.dotUnlocked} aria-hidden="true" /><span>{t("UNLOCKED")}</span>
                            </span>
                          </div>
                          <button type="button" className={styles.courseEnterButton} id={`course-choice-${course.id}`}
                            aria-label={`${t("Open sections for", "Mở học phần của")} ${course.title}`} onClick={() => {
                              courseScrollTop.current = (isSearchingCourses ? coursePaneRef.current : courseGridRef.current)?.scrollTop ?? 0;
                              iconTilt.onPointerLeave();
    rememberDeckSelection(course.id, null, false, { course: course.slug });
                              setSelectedCourseId(course.id);
                              setMobileFoldersOpen(false);
                            }}>
                            <LearningInnovationIcon kind="course" className={styles.enterArtwork} />
                          </button>
                        </article>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className={styles.groupPaginationFooter}>
                        <span className={styles.paginationDetail}>
                          {t("Showing", "Hiển thị")} {startIndex + 1}–{Math.min(startIndex + COURSES_PER_PAGE, totalCourses)} {t("of", "trên")} {totalCourses} {t("courses")}</span>
                        <div className={styles.pagePills}>
                          <button
                            type="button"
                            className={styles.pagePillNav}
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(group.id, currentPage - 1)}
                          >{t("‹ Prev")}</button>
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
                          >{t("Next ›")}</button>
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
              <span>{t("ANALYTICS REPORT")}</span>
              <h2 id="export-report-title">{t("Export Excel report")}</h2>
              <p>{t("Choose a folder, then a course and one or all of its sections.")}</p>

              <HierarchyScopeFields folders={reportFolders} courses={reportCourses} sections={reportScopes}
                value={{folder:exportFolder,course:exportCourse,section:exportSection}}
                onChange={value=>{setExportFolder(value.folder);setExportCourse(value.course);setExportSection(value.section);}}
                disabled={reportStatus === "exporting"} />

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
                    <strong>{t("Today", "Hôm nay")} ({formatVNDate(getTodayDateString())})</strong>
                    <small>{t("Only learners and activity recorded today")}</small>
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
                    <strong>{t("Specific date")}</strong>
                    <small>{t("Choose the class date to export")}</small>
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
                    <strong>{t("All time")}</strong>
                    <small>{t("Export the complete learner history")}</small>
                  </div>
                </label>
              </div>

              {reportStatus === "error" && reportNotice && (
                <p className={styles.reportError} role="alert">
                  {t(reportNotice)}
                </p>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowExportModal(false)}
                  disabled={reportStatus === "exporting"}
                >{t("Close")}</button>
                <button
                  type="button"
                  className={styles.confirmReportButton}
                  onClick={() => void exportReport()}
                  disabled={reportStatus === "exporting"}
                >
                  {reportStatus === "exporting" ? t("Exporting file…") : t("Download Excel file")}
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
              <span className={styles.dangerEyebrow}>{t("DANGER · ADMINISTRATIVE ACTION")}</span>
              <h2 id="reset-modal-title">
                {resetIsGlobal ? t("Reset all data?") : t("Reset selected data?")}
              </h2>

              <HierarchyScopeFields folders={reportFolders} courses={reportCourses} sections={reportScopes}
                value={{folder:resetFolder,course:resetCourse,section:resetSection}}
                onChange={value=>{setResetFolder(value.folder);setResetCourse(value.course);setResetSection(value.section);setResetNotice("");}}
                disabled={!scopeMetadataReady || resetStatus === "sending" || resetStatus === "success"} />
              {!scopeMetadataReady && resetStatus !== "error" && <p role="status">{t("Loading current folders, courses and sections...")}</p>}

              <div className={styles.dangerWarningBox}>
                <strong>{t("This action cannot be undone:")}</strong>
                {t(`It permanently deletes ${resetSectionLabel} data, including learner profiles, activity logs, ideas, showcase entries, quiz results, feedback, and active sessions.`, `Thao tác này xóa vĩnh viễn dữ liệu ${resetSectionLabel}, bao gồm hồ sơ học viên, nhật ký hoạt động, ý tưởng, bài nộp, kết quả kiểm tra, phản hồi và phiên đang hoạt động.`)}
              </div>

              <label className={styles.resetPasswordField}>
                <span>{t("Confirmation passcode")}</span>
                <input
                  type="password"
                  className={styles.resetPasswordInput}
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    if (resetStatus === "error") setResetNotice("");
                  }}
                  placeholder={t("Enter confirmation passcode")}
                  autoComplete="off"
                  autoFocus
                  required
                />
              </label>

              {resetStatus === "error" && resetNotice && (
                <p className={styles.resetErrorNotice} role="alert">
                  {t(resetNotice)}
                </p>
              )}

              {resetStatus === "success" && resetNotice && (
                <p className={styles.resetSuccessNotice} role="status">
                  ✓ {t(resetNotice)}
                </p>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowResetModal(false)}
                  disabled={resetStatus === "sending"}
                >{t("Cancel")}</button>
                <button
                  type="submit"
                  className={styles.confirmResetButton}
                  disabled={!resetScopeValid || resetStatus === "sending" || resetStatus === "success"}
                >
                  {resetStatus === "sending"
                    ? t("Deleting data…")
                    : resetIsGlobal
                      ? t("Delete all data")
                      : t("Delete selected data")}
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
        currentSectionId={activeSectionId}
        currentSectionTitle={activeLessonSection?.title}
        statusNotice={previewMode ? `${t("Preview", "Xem thử")} · ${previewMode === "learning" ? "Learning Access" : "Teaching Access"}` : isAdmin ? terminateNotice : undefined}
        onExitPreview={previewMode ? () => changeAccessPreview(null) : undefined}
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
            <p>{t(sectionOpenError)}</p>
            <button type="button" onClick={() => {
              const item = selectedCourse.sections.find(item => item.sectionKey === launchingSection);
              if (item) handleLaunchBuiltin(selectedCourse, item, launchingSection);
            }}>{t("Try again")}</button>
          </div>
        ) : <HairlineLoading label={t("Opening lesson")} /> : activeUploadedSection ? (
          <UploadedSectionDeck
            key={`${activeUploadedSection.id}-${activeUploadedSection.contentRevision ?? ""}-${activeUploadedSection.templateKey ?? ""}-${deckSessionKey}`}
            sectionId={activeUploadedSection.id}
            isAdmin={isAdmin || Boolean(activeUploadedSection.canFacilitate)}
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
            <span>{t("ADMIN ACTION")}</span>
            <h2 id="terminate-title">{t("Terminate current section?")}</h2>
            <p>{t("Learners in this section will return to the access screen.")}</p>
            {terminateStatus === "error" && terminateNotice && (
              <p role="alert">{t(terminateNotice)}</p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowTerminate(false)}
                disabled={terminateStatus === "sending"}
              >{t("Cancel")}</button>
              <button
                type="button"
                className={styles.confirmTerminateButton}
                onClick={() => void terminateSection()}
                disabled={terminateStatus === "sending"}
              >
                {terminateStatus === "sending" ? t("Terminating...") : t("Terminate")}
              </button>
            </div>
          </section>
        </div>
      )}

    </>
  );
}
