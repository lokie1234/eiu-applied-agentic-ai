"use client";
import Link from "next/link";
import PasscodeManager from "./PasscodeManager";
import type { AccessCodes } from "@/lib/auth/passcodes";
import { DEFAULT_IDENTITY_POLICY, type LearningIdentityPolicy } from "@/lib/learningIdentity";
import TemplateLibrary from "./TemplateLibrary";
import VisibilityToggle from "./VisibilityToggle";
import type { SlideTemplate } from "@/lib/auth/courseAccessStorage";

import CourseManagerHeader from "./CourseManagerHeader";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AdminAccessPortal.module.css";
import DriveExport from "./DriveExport";
import CourseSystemIcons from "./CourseSystemIcons";
import DriveImport from "./DriveImport";
import SectionFileUpload from "./SectionFileUpload";
import PcActionIcon from "./PcActionIcon";
import actionIconStyles from "./DriveActionIcon.module.css";
import EiuConfirmDialog from "./EiuConfirmDialog";

type LanguageLabel = "vi" | "en" | "vi_en";

export type CourseFolderGroup = {
  accessCodes?: AccessCodes;
  hidden?: boolean;
  canEdit?: boolean;
  id: string;
  name: string;
  description?: string;
  order: number;
};

export type CourseSystemIcon = {
  id: string;
  name: string;
  url: string;
  scale?: number;
};

type CourseMetadata = {
  terminableSectionIds?: string[];
  hidden?: boolean;
  templateKey?: string;
  sectionTemplates?: Record<string, string>;
  summary: string;
  allowedEmails: string[];
  passcode?: string;
  facilitatorPasscode?: string;
  sectionAccessCodes?: Record<string, AccessCodes>;
  sectionPasscodes?: Record<string, string>;
  unlocked?: boolean;
  folderGroupId?: string;
  folderGroupName?: string;
  folderOrder?: number;
  folderGroups?: CourseFolderGroup[];
  systemIcons?: CourseSystemIcon[];
  systemIconSize?: number;
};

type Course = {
  canEdit?: boolean;
  canDelete?: boolean;
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  language_label: LanguageLabel;
  passcode?: string;
  unlocked?: boolean;
  folderGroupId?: string;
  folderGroupName?: string;
  folderOrder?: number;
  systemIcons?: CourseSystemIcon[];
  systemIconSize?: number;
  metadata: CourseMetadata;
};

type Section = {
  hidden?: boolean;
  canEdit?: boolean;
  id: string;
  course_id: string;
  section_key: string;
  title: string;
  position: number;
  status: "draft" | "active" | "archived";
  passcode: string;
  content_type: "builtin" | "pdf" | "tsx" | "pptx";
  content_path: string | null;
  source_filename: string | null;
  slide_count: number | null;
};

type Payload = {
  driveEnabled?: boolean;
  learningIdentityPolicy?: LearningIdentityPolicy;
  globalAccessCodes?: AccessCodes;
  success: boolean;
  message?: string;
  courses?: Course[];
  sections?: Section[];
  folderGroups?: CourseFolderGroup[];
  generatedCode?: string;
  createdCourseIds?: string[];
  createdFolderGroupId?: string;
};

type EiuDialogState = {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "gold" | "warning" | "info";
  isAlert?: boolean;
  onConfirm?: () => void | Promise<void>;
};

const languageOptions: Array<{ value: LanguageLabel; label: string }> = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
  { value: "vi_en", label: "Vietnamese & English" },
];


function DraggableScrollArea({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest("button, a, input, textarea, select, [contenteditable='true']")) return;
    const el = ref.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    dragCleanup.current?.();

    const startX = e.pageX - el.offsetLeft;
    const scrollLeft = el.scrollLeft;
    let isDown = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDown) return;
      ev.preventDefault();
      const x = ev.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };

    const onMouseUp = () => {
      isDown = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dragCleanup.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dragCleanup.current = onMouseUp;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const el = ref.current;
    if (!el) return;
    if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      title={title}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      {children}
    </div>
  );
}

export default function AdminAccessPortal({ adminEmail, initialTab, initialCourseId, initialSectionId, driveEnabled: initialDriveEnabled }: { adminEmail: string; initialTab?: "layouts"; initialCourseId?: string; initialSectionId?: string; driveEnabled?: boolean }) {
  const isAdmin = true;
  const [driveEnabled, setDriveEnabled] = useState(initialDriveEnabled ?? true);
  const [tab, setTab] = useState<"passcodes" | "courses" | "layouts">(initialTab ?? "courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [courseId, setCourseId] = useState(initialCourseId ?? "");
  const focusedInitialSection = useRef(false);


  // EIU Modal Dialog state
  const [dialog, setDialog] = useState<EiuDialogState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const showConfirm = useCallback(
    ({
      title,
      message,
      detail,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      variant = "danger",
      onConfirm,
    }: {
      title: string;
      message: string;
      detail?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "danger" | "gold" | "warning" | "info";
      onConfirm: () => void | Promise<void>;
    }) => {
      setDialog({
        isOpen: true,
        title,
        message,
        detail,
        confirmLabel,
        cancelLabel,
        variant,
        isAlert: false,
        onConfirm,
      });
    },
    []
  );

  const showAlert = useCallback(
    ({
      title,
      message,
      detail,
      confirmLabel = "Understood",
    }: {
      title: string;
      message: string;
      detail?: string;
      confirmLabel?: string;
    }) => {
      setDialog({
        isOpen: true,
        title,
        message,
        detail,
        confirmLabel,
        variant: "gold",
        isAlert: true,
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Email management state

  // Multi-course selection state for unlock/lock and batch delete
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  // Multi-section selection state for batch delete
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());

  // Multi-folder group selection state for batch delete
  const [selectedFolderGroups, setSelectedFolderGroups] = useState<Set<string>>(new Set());

  // Course settings state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addMultipleSections, setAddMultipleSections] = useState(false);
  const [templates, setTemplates] = useState<SlideTemplate[]>([]);
  const [templateError, setTemplateError] = useState("");
  const [templatesLoadedFor, setTemplatesLoadedFor] = useState<boolean | null>(null);
  const loadLayoutImages = tab === "layouts";
  const templateLoading = templatesLoadedFor !== loadLayoutImages;
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = () => {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      void fetch(loadLayoutImages ? "/api/templates" : "/api/templates?summary=1", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) }).then(async response => {
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.templates)) throw new Error(payload.message || "Unable to load layouts.");
      if (!disposed) { setTemplates(payload.templates); setTemplateError(""); }
    }).catch(() => { if (!disposed) setTemplateError("Unable to load templates. Refresh to try again."); }).finally(() => { inFlight = false; if (!disposed) setTemplatesLoadedFor(loadLayoutImages); }); };
    refresh(); window.addEventListener("focus", refresh);
    return () => { disposed = true; controller.abort(); window.removeEventListener("focus", refresh); };
  }, [loadLayoutImages]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleValue, setSectionTitleValue] = useState("");

  // New course state
  const [showNewCourseBox, setShowNewCourseBox] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [addMultipleCourses, setAddMultipleCourses] = useState(false);
  const [targetFolderForCourse, setTargetFolderForCourse] = useState<string>("fg-ai-agentic");

  // Folder groups state (Folder Lớn)
  const [globalAccessCodes, setGlobalAccessCodes] = useState<AccessCodes>({});
  const [learningIdentityPolicy, setLearningIdentityPolicy] = useState<LearningIdentityPolicy>(DEFAULT_IDENTITY_POLICY);
  const [folderGroups, setFolderGroups] = useState<CourseFolderGroup[]>([
    { id: "fg-ai-agentic", name: "Chương Trình AI & Agentic", order: 1 },
  ]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [showNewFolderBox, setShowNewFolderBox] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const draggedSection = useRef<string | null>(null);
  const [sectionDropTarget, setSectionDropTarget] = useState<string | null>(null);
  const draggedCourse = useRef<{ id: string; folderId: string } | null>(null);
  const [courseDropTarget, setCourseDropTarget] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [languageFeedback, setLanguageFeedback] = useState<{ courseId: string; message: string; failed: boolean } | null>(null);
  const languageSaving = useRef(false);
  const catalogRead = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);
  const pendingMutations = useRef(new Set<string>());
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const catalogVersion = useRef(0);

  const [courseSearch, setCourseSearch] = useState("");

  const apply = useCallback((payload: Payload) => {
    if (payload.courses) {
      setCourses(payload.courses);
      setSelectedCourses(current => new Set([...current].filter(id => payload.courses!.some(course => course.id === id && (isAdmin || (course.canEdit && course.canDelete !== false))))));
    }
    if (payload.createdCourseIds?.[0]) { setCourseId(payload.createdCourseIds[0]); setCourseSearch(""); }
    if (payload.createdFolderGroupId) {
      setTargetFolderForCourse(payload.createdFolderGroupId);
      setCollapsedFolders(current => new Set([...current].filter(id => id !== payload.createdFolderGroupId)));
    }
    if (payload.sections) setSections(payload.sections);
    if (payload.globalAccessCodes) setGlobalAccessCodes(payload.globalAccessCodes);
    if (payload.learningIdentityPolicy) setLearningIdentityPolicy(payload.learningIdentityPolicy);
    if (typeof payload.driveEnabled === "boolean") setDriveEnabled(payload.driveEnabled);
    if (payload.folderGroups) setFolderGroups(payload.folderGroups);
  }, [isAdmin]);

  function toggleFolderCollapse(folderId: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  const loadData = useCallback(() => {
    if (catalogRead.current) return catalogRead.current.promise;
    const controller = new AbortController();
    const version = catalogVersion.current;
    const promise = fetch("/api/admin/access", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
      .then(async (response) => {
        const payload = (await response.json()) as Payload;
        if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load your workspace.");
        if (!controller.signal.aborted && version === catalogVersion.current) apply(payload);
      }).finally(() => { if (catalogRead.current?.controller === controller) catalogRead.current = null; });
    catalogRead.current = { controller, promise };
    return promise;
  }, [apply]);

  useEffect(() => {
    let disposed = false;
    loadData()
      .catch((caught) => {
        if (!disposed && caught?.name !== "AbortError") setError(caught instanceof Error ? caught.message : "Unable to load your workspace.");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      catalogRead.current?.controller.abort();
      catalogRead.current = null;
    };
  }, [loadData]);

  const refreshData = useCallback(() => {
    void loadData().then(() => setError("")).catch(caught => {
      if (caught?.name !== "AbortError") setError(caught instanceof Error ? caught.message : "Unable to refresh your workspace.");
    });
  }, [loadData]);

  const activeCourses = useMemo(() => courses.filter((c) => c.status === "active"), [courses]);
  const effectiveCourseId = activeCourses.some((c) => c.id === courseId) ? courseId : activeCourses[0]?.id ?? "";
  const selectedCourse = activeCourses.find((c) => c.id === effectiveCourseId) ?? null;
  const courseSummary = (selectedCourse?.metadata?.summary ?? selectedCourse?.description ?? "").trim();



  const canEditCourse = Boolean(selectedCourse);



  const courseSections = useMemo(
    () => sections.filter((s) => s.course_id === effectiveCourseId && s.status === "active").sort((a, b) => a.position - b.position),
    [sections, effectiveCourseId]
  );


  useEffect(() => {
    if (!initialSectionId || focusedInitialSection.current || loading || tab !== "courses") return;
    if (!courseSections.some(section => section.id === initialSectionId)) return;
    const target = document.getElementById(`section-${initialSectionId}`);
    if (!target) return;
    focusedInitialSection.current = true;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  }, [initialSectionId, courseSections, loading, tab]);

  const canReorderSections = isAdmin || (canEditCourse && courseSections.every(section => section.canEdit));

  const normalizedCourseSearch = courseSearch.trim().toLowerCase();
  const filteredFolderGroups = useMemo(() => {
    if (!normalizedCourseSearch) return folderGroups;
    return folderGroups.filter((group) => {
      const groupMatch = group.name.toLowerCase().includes(normalizedCourseSearch) ||
        Boolean(group.description && group.description.toLowerCase().includes(normalizedCourseSearch));
      const childCourses = activeCourses.filter(
        (c) => (c.folderGroupId || "fg-ai-agentic") === group.id
      );
      const childMatch = childCourses.some(
        (c) => c.title.toLowerCase().includes(normalizedCourseSearch) ||
               (c.slug && c.slug.toLowerCase().includes(normalizedCourseSearch))
      );
      return groupMatch || childMatch;
    });
  }, [folderGroups, activeCourses, normalizedCourseSearch]);

  // Reset drafts before committing a different course, rather than rendering
  // once with stale fields and scheduling another render from an effect.
  const draftKey = JSON.stringify([effectiveCourseId, selectedCourse?.title, selectedCourse?.metadata?.summary, selectedCourse?.description]);
  const [draftSource, setDraftSource] = useState(draftKey);
  if (draftSource !== draftKey) {
    setDraftSource(draftKey);
    setTitleValue(selectedCourse?.title || "");
    setEditingTitle(false);
    setDescriptionValue(selectedCourse?.metadata?.summary ?? selectedCourse?.description ?? "");
    setEditingDescription(false);
  }

  async function handleSaveTitle() {
    if (!effectiveCourseId) return;
    const cleanTitle = titleValue.trim();
    if (!cleanTitle) return;
    const ok = await mutate(
      { action: "update_course_title", courseId: effectiveCourseId, title: cleanTitle },
      `title:${effectiveCourseId}`,
      `Course name updated to “${cleanTitle}”.`,
      "loading..... Updating course title..."
    );
    if (ok) setEditingTitle(false);
  }

  async function mutate(
    body: Record<string, unknown>,
    key: string,
    successMessage: string,
    processingText?: string,
    localFeedback?: (message: string, failed: boolean) => void
  ) {
    // Ref guards run synchronously, before React can disable a pressed control.
    if (pendingMutations.current.has(key)) return false;
    if (!isAdmin) {
      const action = String(body.action);
      const folderActions = ["update_folder_group", "delete_folder_group", "delete_folder_groups"];
      const courseActions = ["create_section", "set_course_folder_group", "set_course_template", "update_course_title", "update_course_summary", "update_course_description", "update_course_system_icons", "set_course_language", "delete_course", "reorder_sections"];
      const sectionActions = ["delete_section", "delete_sections", "rename_section"];
      let permitted = ["create_course", "create_folder_group"].includes(action);
      if (folderActions.includes(action)) {
        const ids = action === "delete_folder_groups" ? body.folderGroupIds as string[] : [String(body.id)];
        permitted = Boolean(ids?.length) && ids.every(id => folderGroups.some(group => group.id === id && group.canEdit));
      }
      if (action === "create_course" || action === "set_course_folder_group") permitted = folderGroups.some(group => group.id === body.folderGroupId && group.canEdit);
      if (courseActions.includes(action)) permitted = courses.some(course => course.id === body.courseId && course.canEdit) && (action !== "set_course_folder_group" || folderGroups.some(group => group.id === body.folderGroupId && group.canEdit));
      if (sectionActions.includes(action)) {
        const ids = action === "delete_sections" ? body.sectionIds as string[] : [String(body.sectionId)];
        permitted = Boolean(ids?.length) && ids.every(id => sections.some(section => section.id === id && section.canEdit && courses.some(course => course.id === section.course_id && course.canEdit)));
      }
      if (["delete_courses", "reorder_courses"].includes(action)) {
        const ids = body.courseIds as string[];
        permitted = Boolean(ids?.length) && ids.every(id => courses.some(course => course.id === id && course.canEdit && (action !== "delete_courses" || course.canDelete !== false)));
      }
      if (!permitted) {
        if (localFeedback) localFeedback("You can only manage your own courses and sections.", true);
        else setError("You can only manage your own courses and sections.");
        return false;
      }
    }
    pendingMutations.current.add(key);
    catalogVersion.current++;
    catalogRead.current?.controller.abort();
    catalogRead.current = null;
    const previous = mutationQueue.current;
    let release!: () => void;
    mutationQueue.current = new Promise<void>(resolve => { release = resolve; });
    setBusy((current) => new Set(current).add(key));
    if (processingText) {
      setProcessingMessage(processingText);
    }
    if (!localFeedback) {
      setError("");
      setNotice("");
    }
    try {
      // Metadata updates read then write a course record; preserve write order.
      await previous;
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const payload = (await response.json()) as Payload;
      catalogVersion.current++;
      if (payload.courses && payload.sections && payload.folderGroups) apply(payload);
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to save changes.");
      if (!payload.courses || !payload.sections || !payload.folderGroups) apply(payload);
      if (localFeedback) localFeedback(successMessage, false);
      else setNotice(successMessage);
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "An error occurred.";
      if (localFeedback) localFeedback(message, true);
      else setError(message);
      return false;
    } finally {
      pendingMutations.current.delete(key);
      release();
      if (!localFeedback) setProcessingMessage(null);
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  // =========================================================================
  // EMAIL MANAGEMENT HANDLERS (Add nhiều, Xóa nhiều, Search)
  // =========================================================================

  // =========================================================================
  // COURSE SETUP & PASSCODE BYPASS HANDLERS
  // =========================================================================


  // =========================================================================
  // FOLDER GROUP (FOLDER LỚN) HANDLERS
  // =========================================================================

  async function handleCreateFolderGroup(e: FormEvent) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const ok = await mutate(
      {
        action: "create_folder_group",
        name,
        description: newFolderDesc.trim() || undefined,
      },
      "create-folder-group",
      `Created parent folder “${name}”.`,
      "loading..... Creating new parent folder..."
    );
    if (ok) {
      setNewFolderName("");
      setNewFolderDesc("");
      setShowNewFolderBox(false);
    }
  }

  async function handleRenameFolderGroup(id: string) {
    const name = editingFolderName.trim();
    if (!name) return;
    const ok = await mutate(
      { action: "update_folder_group", id, name },
      `rename-folder:${id}`,
      `Renamed parent folder to “${name}”.`,
      "loading..... Updating parent folder name..."
    );
    if (ok) {
      setEditingFolderId(null);
      setEditingFolderName("");
    }
  }

  async function handleDeleteFolderGroup(group: CourseFolderGroup) {
    showConfirm({
      title: `Delete Parent Folder “${group.name}”`,
      message: `Are you sure you want to permanently delete parent folder “${group.name}”?`,
      detail: "All child courses and sections inside this folder will also be permanently deleted.",
      confirmLabel: "Delete Folder & Contents",
      variant: "danger",
      onConfirm: async () => {
        const ok = await mutate(
          { action: "delete_folder_group", id: group.id },
          `delete-folder:${group.id}`,
          `Deleted parent folder “${group.name}” and all contents.`,
          `loading..... Deleting parent folder “${group.name}” and its contents...`
        );
        if (ok) {
          setSelectedFolderGroups((prev) => {
            const next = new Set(prev);
            next.delete(group.id);
            return next;
          });
          const deletedCourseIds = activeCourses.filter((c) => (c.folderGroupId || "fg-ai-agentic") === group.id && c.slug !== "applied-agentic-ai").map((c) => c.id);
          if (deletedCourseIds.includes(effectiveCourseId)) {
            const remaining = activeCourses.filter((c) => !deletedCourseIds.includes(c.id));
            if (remaining.length > 0) setCourseId(remaining[0].id);
          }
        }
      },
    });
  }

  function handleToggleFolderGroupSelection(id: string) {
    setSelectedFolderGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelectedFolderGroups() {
    if (selectedFolderGroups.size === 0) return;
    const count = selectedFolderGroups.size;
    showConfirm({
      title: "Delete Selected Parent Folders",
      message: `Are you sure you want to delete ${count} selected parent folder(s)?`,
      detail: "All child courses and sections inside these folders will also be permanently deleted.",
      confirmLabel: `Delete ${count} Folders & Contents`,
      variant: "danger",
      onConfirm: async () => {
        const folderGroupIds = Array.from(selectedFolderGroups);
        const ok = await mutate(
          { action: "delete_folder_groups", folderGroupIds },
          "delete-folder-groups",
          `Deleted ${count} parent folder(s) and their contents.`,
          `loading..... Deleting ${count} selected parent folders...`
        );
        if (ok) {
          setSelectedFolderGroups(new Set());
          const deletedCourseIds = activeCourses.filter((c) => folderGroupIds.includes(c.folderGroupId || "fg-ai-agentic") && c.slug !== "applied-agentic-ai").map((c) => c.id);
          if (deletedCourseIds.includes(effectiveCourseId)) {
            const remaining = activeCourses.filter((c) => !deletedCourseIds.includes(c.id));
            if (remaining.length > 0) setCourseId(remaining[0].id);
          }
        }
      },
    });
  }

  function handleToggleCourseSelection(id: string) {
    if (!activeCourses.some(course => course.id === id)) return;
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAllCoursesToggle() {
    const selectableCourses = activeCourses;
    if (selectedCourses.size === selectableCourses.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(selectableCourses.map((c) => c.id)));
    }
  }

  async function handleDeleteSelectedCourses() {
    if (selectedCourses.size === 0) return;
    const selectedCourseList = activeCourses.filter((c) => selectedCourses.has(c.id));
    const deletableCourses = selectedCourseList.filter((c) => c.slug !== "applied-agentic-ai");
    if (deletableCourses.length === 0) {
      showAlert({
        title: "Cannot Delete Core Course",
        message: "The core course (Applied Agentic AI) is foundational to the platform and cannot be deleted.",
      });
      return;
    }
    const count = deletableCourses.length;
    showConfirm({
      title: "Delete Selected Courses",
      message: `Are you sure you want to permanently delete ${count} selected course(s) and all their sections?`,
      detail: "This will permanently remove these courses from the database and cannot be undone.",
      confirmLabel: `Delete ${count} Courses`,
      variant: "danger",
      onConfirm: async () => {
        const courseIds = deletableCourses.map((c) => c.id);
        const ok = await mutate(
          { action: "delete_courses", courseIds },
          "delete-selected-courses",
          `Deleted ${count} course(s) from platform.`,
          `loading..... Deleting ${count} selected courses...`
        );
        if (ok) {
          setSelectedCourses(new Set());
          if (courseIds.includes(effectiveCourseId)) {
            const remaining = activeCourses.filter((c) => !courseIds.includes(c.id));
            if (remaining.length > 0) setCourseId(remaining[0].id);
          }
        }
      },
    });
  }

  async function handleDeleteSingleCourse(targetCourse: Course) {
    if (targetCourse.slug === "applied-agentic-ai") {
      showAlert({
        title: "Cannot Delete Core Course",
        message: "The core course (Applied Agentic AI) is foundational to the platform and cannot be deleted.",
      });
      return;
    }
    showConfirm({
      title: `Delete Course “${targetCourse.title}”`,
      message: `Are you sure you want to permanently delete course “${targetCourse.title}” and all its sections?`,
      detail: "This will permanently remove this course and all its sections from the database and cannot be undone.",
      confirmLabel: "Delete Course",
      variant: "danger",
      onConfirm: async () => {
        const ok = await mutate(
          { action: "delete_course", courseId: targetCourse.id },
          `del-course:${targetCourse.id}`,
          `Deleted course “${targetCourse.title}”.`,
          `loading..... Deleting course “${targetCourse.title}”...`
        );
        if (ok) {
          setSelectedCourses((prev) => {
            const next = new Set(prev);
            next.delete(targetCourse.id);
            return next;
          });
          if (effectiveCourseId === targetCourse.id) {
            const remaining = activeCourses.filter((c) => c.id !== targetCourse.id);
            if (remaining.length > 0) setCourseId(remaining[0].id);
          }
        }
      },
    });
  }

  async function handleSaveDescription() {
    if (!effectiveCourseId) return;
    const ok = await mutate(
      { action: "update_course_description", courseId: effectiveCourseId, summary: descriptionValue },
      `desc:${effectiveCourseId}`,
      "Course description updated.",
      "loading..... Updating course description..."
    );
    if (ok) setEditingDescription(false);
  }


  async function setLanguage(languageLabel: LanguageLabel) {
    if (!canEditCourse || languageSaving.current || selectedCourse?.language_label === languageLabel) return;
    const savingCourseId = effectiveCourseId;
    languageSaving.current = true;
    setLanguageFeedback({ courseId: savingCourseId, message: "Saving language…", failed: false });
    try {
      await mutate(
        { action: "set_course_language", courseId: savingCourseId, languageLabel },
        `lang:${savingCourseId}`,
        "Language saved.",
        undefined,
        (message, failed) => setLanguageFeedback({ courseId: savingCourseId, message, failed })
      );
    } finally {
      languageSaving.current = false;
    }
  }

  // =========================================================================
  // COURSE SYSTEM ICONS HANDLERS (Copy-paste / Upload / Compress / Save)
  // =========================================================================

  async function saveSystemIcons(updatedIcons: CourseSystemIcon[]) {
    if (!canEditCourse || !effectiveCourseId) return false;
    return mutate(
      { action: "update_course_system_icons", courseId: effectiveCourseId, systemIcons: updatedIcons },
      `icons:${effectiveCourseId}`,
      "System icons updated successfully."
    );
  }

  // =========================================================================
  // MERGED COURSE SECTIONS HANDLERS (Thêm & Xóa Section gộp vào)
  // =========================================================================

  const [selectionCourse, setSelectionCourse] = useState(effectiveCourseId);
  if (selectionCourse !== effectiveCourseId) {
    setSelectionCourse(effectiveCourseId);
    setSelectedSections(new Set());
  }

  const deletableSections = useMemo(
    () => courseSections.filter((s) => (isAdmin || (selectedCourse?.canEdit && s.canEdit)) && !(selectedCourse?.slug === "applied-agentic-ai" && ["section1", "section2"].includes(s.section_key))),
    [courseSections, selectedCourse?.slug, selectedCourse?.canEdit, isAdmin]
  );

  const isAllSectionsSelected =
    deletableSections.length > 0 && deletableSections.every((s) => selectedSections.has(s.id));

  function handleToggleSectionSelection(id: string) {
    if (!deletableSections.some(section => section.id === id)) return;
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAllSectionsToggle() {
    if (isAllSectionsSelected) {
      setSelectedSections(new Set());
    } else {
      setSelectedSections(new Set(deletableSections.map((s) => s.id)));
    }
  }

  async function handleDeleteSelectedSections() {
    if (selectedSections.size === 0) return;
    const count = selectedSections.size;
    showConfirm({
      title: "Delete Selected Sections",
      message: `Are you sure you want to permanently delete ${count} selected section(s) from this course?`,
      detail: "All lessons and contents inside these sections will be permanently removed.",
      confirmLabel: `Delete ${count} Sections`,
      variant: "danger",
      onConfirm: async () => {
        const sectionIds = Array.from(selectedSections);
        const ok = await mutate(
          { action: "delete_sections", sectionIds },
          "delete-selected-sections",
          `Deleted ${sectionIds.length} section(s) from course.`,
          `loading..... Deleting ${sectionIds.length} selected section(s)...`
        );
        if (ok) setSelectedSections(new Set());
      },
    });
  }

  async function handleAddSection(e: FormEvent) {
    e.preventDefault();
    const title = newSectionTitle.trim();
    if (!title || !effectiveCourseId) return;
    const titles = addMultipleSections ? title.split(/[,.\-]+/u).map((name) => name.trim()).filter(Boolean) : [title];
    if (!titles.length) return;
    const ok = await mutate(
      { action: "create_section", courseId: effectiveCourseId, title, ...(addMultipleSections ? { titles } : {}) },
      `add-sec:${effectiveCourseId}`,
      `Added ${titles.length} section(s) to ${selectedCourse?.title}.`,
      `Creating ${titles.length} section(s)…`
    );
    if (ok) setNewSectionTitle("");
  }

  async function handleReorderSection(sourceId: string, targetId: string) {
    if (!canReorderSections || sourceId === targetId || !effectiveCourseId || processingMessage || busy.has("reorder-sections")) return;
    const ids = courseSections.map((section) => section.id);
    const source = ids.indexOf(sourceId);
    const target = ids.indexOf(targetId);
    if (source < 0 || target < 0) return;
    ids.splice(source, 1);
    ids.splice(target, 0, sourceId);
    await mutate({ action: "reorder_sections", courseId: effectiveCourseId, sectionIds: ids },
      "reorder-sections", "Section order saved.", "Saving section order…");
  }

  async function handleRenameSection(event: FormEvent, section: Section) {
    event.preventDefault();
    const title = sectionTitleValue.trim();
    if (!title || title.length > 120 || busy.has(`rename-sec:${section.id}`)) return;
    const ok = await mutate(
      { action: "rename_section", sectionId: section.id, title },
      `rename-sec:${section.id}`,
      `Renamed section to “${title}”.`,
      `Saving section name…`
    );
    if (ok) setEditingSectionId(null);
  }

  async function handleDeleteSection(section: Section) {
    if (selectedCourse?.slug === "applied-agentic-ai" && ["section1", "section2"].includes(section.section_key)) {
      showAlert({
        title: "Default Platform Section",
        message: "Section 1 and Section 2 are platform default sections for the core course and cannot be deleted.",
      });
      return;
    }
    showConfirm({
      title: "Delete Course Section",
      message: `Are you sure you want to delete section “${section.title}”?`,
      detail: "All lessons and content in this section will be permanently deleted.",
      confirmLabel: "Delete Section",
      variant: "danger",
      onConfirm: async () => {
        const ok = await mutate(
          { action: "delete_section", sectionId: section.id },
          `sec:${section.id}`,
          `Deleted section “${section.title}”.`,
          `loading..... Deleting section “${section.title}”...`
        );
        if (ok) {
          setSelectedSections((prev) => {
            const next = new Set(prev);
            next.delete(section.id);
            return next;
          });
        }
      },
    });
  }

  async function handleCreateCourse(e: FormEvent) {
    e.preventDefault();
    const title = newCourseTitle.trim();
    if (!title) return;
    const titles = addMultipleCourses ? title.split(/[,.\-]+/u).map((name) => name.trim()).filter(Boolean) : [title];
    if (!titles.length) return;
    const targetFolderId = targetFolderForCourse;
    const targetFolder = folderGroups.find((g) => g.id === targetFolderId) || folderGroups[0];
    if (!targetFolder) { setError("Create your own folder before adding a course."); return; }
    const ok = await mutate(
      {
        action: "create_course",
        title,
        ...(addMultipleCourses ? { titles } : {}),
        folderGroupId: targetFolder?.id || "fg-ai-agentic",
        folderGroupName: targetFolder?.name || "AI & Agentic Programs",
      },
      "create-course",
      `Created ${titles.length} course(s) in ${targetFolder?.name || "AI & Agentic Programs"}.`,
      `Creating ${titles.length} course(s)…`
    );
    if (ok) {
      setNewCourseTitle("");
      setShowNewCourseBox(false);
    }
  }

  async function handleReorderCourse(sourceId: string, targetId: string, folderId: string) {
    if (sourceId === targetId || processingMessage || busy.has("reorder-courses")) return;
    const ids = activeCourses.filter((course) => (course.folderGroupId || "fg-ai-agentic") === folderId).map((course) => course.id);
    const source = ids.indexOf(sourceId);
    const target = ids.indexOf(targetId);
    if (source < 0 || target < 0) return;
    ids.splice(source, 1);
    ids.splice(target, 0, sourceId);
    await mutate({ action: "reorder_courses", folderGroupId: folderId, courseIds: ids },
      "reorder-courses", "Course order saved.", "Saving course order…");
  }

  async function signOut() {
    await fetch("/api/signout", { method: "POST" });
    window.location.replace("/");
  }

  return (
    <main className={styles.page}>
      <CourseManagerHeader identity={adminEmail} onSignOut={() => void signOut()} driveEnabled={driveEnabled} />

      {/* EIU Luxury Top Control Row: Segmented Tabs (Left) + Master Access Toolbar (Right) */}
      <div className={styles.topControlRow}>
        <div className={styles.tabsTrack} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "passcodes"} className={`${styles.tabBtn} ${tab === "passcodes" ? styles.tabBtnActive : ""}`} onClick={() => setTab("passcodes")}>Passcodes</button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "courses" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("courses")}
            role="tab"
            aria-selected={tab === "courses"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>Course Setup &amp; Structure</span>
            <span className={styles.tabBadge}>{activeCourses.length}</span>
          </button>
          <button type="button" className={`${styles.tabBtn} ${tab === "layouts" ? styles.tabBtnActive : ""}`} onClick={() => setTab("layouts")} role="tab" aria-selected={tab === "layouts"}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M9 9v9M8 22h8M12 18v4"/></svg>
            <span>Slide Layouts</span><span className={styles.tabBadge}>{templates.length}</span>
          </button>

        </div>


      </div>


      {tab === "courses" && <div className={styles.courseBulkToolbar}><button type="button" className={styles.btnSecondary} onClick={handleSelectAllCoursesToggle} disabled={Boolean(processingMessage)}>Select / clear all courses</button><button type="button" className={styles.btnDangerOutline} onClick={() => void handleDeleteSelectedCourses()} disabled={!selectedCourses.size || Boolean(processingMessage)}>Delete selected ({selectedCourses.size})</button></div>}
      {/* FLOATING HUD OVERLAY (loading..... trực quan nổi bật trên cùng) */}
      {processingMessage && (
        <div className={styles.globalLoadingOverlay} role="status" aria-live="polite">
          <div className={styles.loadingHUDCard}>
            <div className={styles.loadingSpinnerRing}>
              <span className={styles.loadingSpinnerInner} />
            </div>
            <div className={styles.loadingHUDContent}>
              <div className={styles.loadingHUDTitleRow}>
                <strong className={styles.loadingHUDWord}>loading.....</strong>
                <span className={styles.loadingHUDMsg}>
                  {processingMessage.replace(/^loading\.\.\.\.\.\s*/i, "")}
                </span>
                <span className={styles.loadingDotsAnim}>
                  <span>.</span><span>.</span><span>.</span><span>.</span><span>.</span>
                </span>
              </div>
              <div className={styles.loadingProgressBarTrack}>
                <div className={styles.loadingProgressBarFill} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING STATE BANNER (Hiển thị loading...... khi hệ thống đang xử lý) */}
      {processingMessage && (
        <div className={styles.processingBanner} role="status" aria-live="polite">
          <div className={styles.processingSpinnerWrapper}>
            <span className={styles.processingSpinner} />
          </div>
          <div className={styles.processingTextCol}>
            <div className={styles.processingMainLine}>
              <span className={styles.processingTitle}>{processingMessage}</span>
              <span className={styles.loadingDotsAnim}>
                <span>.</span><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span>
              </span>
            </div>
            <span className={styles.processingSub}>
              Please wait while your changes are saved.
            </span>
          </div>
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={refreshData} disabled={loading || Boolean(processingMessage)}>Retry loading workspace</button></div>}
      {notice && !processingMessage && <div className={styles.notice} role="status">{notice}</div>}

      <div className={`${styles.scrollArea} ${tab === "courses" ? styles.scrollAreaCourses : tab === "layouts" ? styles.scrollAreaLayouts : ""}`}>
        {tab === "layouts" ? templateError ? <div className={styles.error} role="alert">{templateError}</div> : templateLoading ? <div className={styles.loading}>Loading layouts...</div> : <TemplateLibrary key="admin" isAdmin={isAdmin} initialTemplates={templates} onTemplatesChange={setTemplates} /> : loading ? (
          <div className={styles.loading}>Loading your workspace…</div>
        ) : tab === "passcodes" ? <PasscodeManager sections={sections} globalCodes={globalAccessCodes} identityPolicy={learningIdentityPolicy} courses={courses} folders={folderGroups} onSave={body => {
          if (body.action === "set_learning_identity_policy") return mutate(body, "learner-information", "Learner information settings saved.", "Loading… Saving learner information settings...");
          const bulk = body.action === "bulk_access_passcodes";
          const generating = body.generate === true || body.operation === "generate";
          const clearing = body.operation === "clear" || (!generating && body.code === "");
          const count = Array.isArray(body.targets) ? body.targets.length : 1;
          const operation = generating ? "Generating" : clearing ? "Clearing" : "Saving";
          const message = body.unhide === true
            ? `loading..... Unhiding content and ${operation.toLowerCase()} passcodes...`
            : `loading..... ${operation} ${bulk ? `passcodes for ${count} selected scopes` : "passcode"}...`;
          return mutate(body, "access-code", bulk ? "Selected passcodes updated." : "Passcode updated.", message);
        }} /> : (
          /* =========================================================================
             FRAME 2: COURSE SETUP & STRUCTURE FRAME (Dual Independent Scroll Panes)
             ========================================================================= */
          <div className={styles.passcodeLayout}>
            {/* Hierarchical Sidebar: Parent Folders -> Child Courses */}
            <aside className={styles.courseList}>
              <div className={styles.courseSidebarTop}>
                <button
                  type="button"
                  className={styles.newFolderTopBtn}
                  onClick={() => setShowNewFolderBox((prev) => !prev)}
                  title="Create New Folder"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>New Folder</span>
                </button>
              </div>


              {/* Real-time Search Box */}
              <div className={styles.courseSearchWrapper}>
                <svg className={styles.courseSearchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  className={styles.courseSearchInput}
                  placeholder="Search folders or courses…"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
                {courseSearch && (
                  <button
                    type="button"
                    className={styles.courseSearchClear}
                    onClick={() => setCourseSearch("")}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Form to create New Folder */}
              {showNewFolderBox && (
                <form onSubmit={handleCreateFolderGroup} className={styles.newFolderInlineBox}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "850", color: "#082945", letterSpacing: "0.04em" }}>
                      CREATE NEW FOLDER
                    </span>
                  </div>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name (e.g. AI & Agentic Curriculum)..."
                    required
                    autoFocus
                    className={styles.folderInputClean}
                  />
                  <input
                    type="text"
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                    placeholder="Short description (optional)..."
                    className={styles.folderInputClean}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="submit"
                      className={styles.btnPrimary}
                      style={{ padding: "6px 14px", fontSize: "11px", borderRadius: "6px" }}
                      disabled={busy.has("create-folder-group") || !newFolderName.trim()}
                    >
                      {busy.has("create-folder-group") ? (
                        <span className={styles.btnLoadingRow}>
                          <span className={styles.btnSpinnerSm} />
                          <span>loading..... Creating...</span>
                        </span>
                      ) : (
                        "Create Folder"
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ padding: "6px 10px", fontSize: "11px", borderRadius: "6px" }}
                      onClick={() => {
                        setShowNewFolderBox(false);
                        setNewFolderName("");
                        setNewFolderDesc("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Selected Folder Groups Batch Toolbar */}
              {selectedFolderGroups.size > 0 && (
                (selectedFolderGroups.size > 0 ? <div className={styles.folderBatchToolbar}>
                  <span className={styles.folderBatchText}>
                    Selected: <b>{selectedFolderGroups.size}</b> folder(s)
                  </span>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px", fontWeight: "750" }}
                    onClick={() => void handleDeleteSelectedFolderGroups()}
                    disabled={busy.has("delete-folder-groups") || Boolean(processingMessage)}
                    title="Delete selected folders"
                  >
                    {busy.has("delete-folder-groups") ? (
                      <span className={styles.btnLoadingRow}>
                        <span className={styles.btnSpinnerSm} />
                        <span>loading.....</span>
                      </span>
                    ) : (
                      `Delete (${selectedFolderGroups.size})`
                    )}
                  </button>
                </div> : null)
              )}

              {/* INDEPENDENT SCROLL PANE 1: Folder Groups & Courses List */}
              <div className={styles.folderScrollContainer}>
                {filteredFolderGroups.length === 0 ? (
                  <div className={styles.courseSearchNoMatch}>
                    <p style={{ margin: "0 0 6px 0" }}>No folders or courses match &ldquo;{courseSearch}&rdquo;.</p>
                    <button
                      type="button"
                      className={styles.courseSearchClearBtn}
                      onClick={() => setCourseSearch("")}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  filteredFolderGroups.map((group) => {
                    const isCollapsed = Boolean(normalizedCourseSearch) ? false : collapsedFolders.has(group.id);
                    const groupCourses = activeCourses.filter(
                      (c) => (c.folderGroupId || "fg-ai-agentic") === group.id
                    );
                    const childCourses = normalizedCourseSearch
                      ? (group.name.toLowerCase().includes(normalizedCourseSearch) || (group.description || "").toLowerCase().includes(normalizedCourseSearch)
                          ? groupCourses
                          : groupCourses.filter((c) =>
                              c.title.toLowerCase().includes(normalizedCourseSearch) ||
                              c.slug.toLowerCase().includes(normalizedCourseSearch) ||
                              (c.metadata?.summary || "").toLowerCase().includes(normalizedCourseSearch) ||
                              (c.description || "").toLowerCase().includes(normalizedCourseSearch)
                            ))
                      : groupCourses;


                    const isFolderChecked = selectedFolderGroups.has(group.id);

                    return (
                      <div key={group.id} className={`${styles.folderGroupCard} ${isFolderChecked ? styles.folderGroupCardSelected : ""}`}>
                        {/* Folder Group Header / Rename Card */}
                        {editingFolderId === group.id ? (
                          <div
                            className={styles.folderRenameCard}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className={styles.folderRenameInputWrap}>
                              <svg className={styles.folderIconGold} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 5h-9.586L8.707 3.293A.997.997 0 0 0 8 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/>
                              </svg>
                              <input
                                type="text"
                                value={editingFolderName}
                                onChange={(e) => setEditingFolderName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleRenameFolderGroup(group.id);
                                  } else if (e.key === "Escape") {
                                    setEditingFolderId(null);
                                  }
                                }}
                                className={styles.folderRenameInput}
                                placeholder="Enter folder name..."
                                autoFocus
                              />
                            </div>
                            <div className={styles.folderRenameActions}>
                              <button
                                type="button"
                                className={styles.folderRenameSaveBtn}
                                onClick={() => void handleRenameFolderGroup(group.id)}
                                disabled={busy.has(`rename-folder:${group.id}`) || !editingFolderName.trim()}
                              >
                                {busy.has(`rename-folder:${group.id}`) ? "..." : "Save"}
                              </button>
                              <button
                                type="button"
                                className={styles.folderRenameCancelBtn}
                                onClick={() => setEditingFolderId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={styles.folderGroupHeader}
                            onClick={() => toggleFolderCollapse(group.id)}
                          >
                            <div className={styles.folderGroupTitleRow}>
                              {(folderGroups.length > 1 || !isAdmin) && (
                                <input
                                  type="checkbox"
                                  checked={isFolderChecked}

                                  onChange={() => handleToggleFolderGroupSelection(group.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={styles.emailRowCheckbox}
                                  title={`Select folder ${group.name}`}
                                />
                              )}
                              <span className={`${styles.folderGroupChevron} ${!isCollapsed ? styles.folderGroupChevronOpen : ""}`}>
                                ▶
                              </span>
                              <svg className={styles.folderIconGold} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 5h-9.586L8.707 3.293A.997.997 0 0 0 8 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/>
                              </svg>
                              <span className={styles.folderGroupNameText} title={group.name}>
                                {group.name}
                              </span>
                              <span className={styles.folderGroupBadge}>{childCourses.length}</span>
                            </div>

                            {/* Quick Folder Actions (Compact Icons) */}
                            {(<div className={styles.folderGroupActions} onClick={(e) => e.stopPropagation()}>
                              {isAdmin && driveEnabled && <DriveExport groupId={group.id} label={`Save folder ${group.name} to Drive`} onSaved={refreshData} compact disabled={Boolean(processingMessage)} />}
                              {isAdmin && <VisibilityToggle hidden={Boolean(group.hidden)} label={`folder ${group.name}`} busy={busy.has(`hide-folder:${group.id}`)} disabled={Boolean(processingMessage) || busy.has(`hide-folder:${group.id}`)} onToggle={() => void mutate({ action: "set_folder_group_hidden", folderGroupId: group.id, hidden: !group.hidden }, `hide-folder:${group.id}`, "Folder visibility updated.")} />}


                              <button
                                type="button"
                                className={styles.folderActionIconBtn}
                                onClick={() => {
                                  setEditingFolderId(group.id);
                                  setEditingFolderName(group.name);
                                }}
                                title="Rename folder"
                              >
                                ✎
                              </button>

                              {(folderGroups.length > 1 || !isAdmin) && (
                                <button
                                  type="button"
                                  className={styles.folderActionDeleteBtn}
                                  onClick={() => void handleDeleteFolderGroup(group)}
                                  disabled={busy.has(`delete-folder:${group.id}`) || Boolean(processingMessage)}
                                  title="Delete folder"
                                >
                                  ×
                                </button>
                              )}
                            </div>)}
                          </div>
                        )}

                        {/* Child Courses in this Parent Folder - COMPACT SLEEK LIST */}
                        {!isCollapsed && (
                          <div className={styles.folderGroupCoursesList}>
                            {childCourses.length === 0 ? (
                              <div className={styles.compactFolderEmpty}>
                                <span>No courses yet</span>
                                {(<button
                                  type="button"
                                  className={styles.compactAddCourseInlineBtn}
                                  onClick={() => {
                                    setTargetFolderForCourse(group.id);
                                    setShowNewCourseBox(true);
                                  }}
                                >
                                  + Add Course
                                </button>)}
                              </div>
                            ) : (
                              <>
                                <div className={styles.compactCourseGroup}>
                                  {childCourses.map((course) => {
                                    const countSecs = sections.filter((s) => s.course_id === course.id && s.status === "active").length;
                                    const isSelected = effectiveCourseId === course.id;
                                    const isChecked = selectedCourses.has(course.id);


                                    return (
                                      <div
                                        key={course.id}
                                        className={`${styles.compactCourseRow} ${isSelected ? styles.compactCourseRowSelected : ""} ${courseDropTarget === course.id ? styles.sectionDropTarget : ""}`}
                                        onDragOver={(event) => {
                                          if (draggedCourse.current?.folderId !== group.id || processingMessage) return;
                                          event.preventDefault();
                                          event.dataTransfer.dropEffect = "move";
                                          setCourseDropTarget(course.id);
                                        }}
                                        onDrop={(event) => {
                                          event.preventDefault();
                                          const source = draggedCourse.current;
                                          draggedCourse.current = null;
                                          setCourseDropTarget(null);
                                          if (source?.folderId === group.id) void handleReorderCourse(source.id, course.id, group.id);
                                        }}
                                      >
                                        {(<button type="button" className={styles.sectionDragHandle}
                                          draggable={!processingMessage && !busy.has("reorder-courses")}
                                          disabled={Boolean(processingMessage) || busy.has("reorder-courses")}
                                          aria-label={`Reorder ${course.title}`} title="Drag to reorder · Arrow Up/Down to move"
                                          onDragStart={(event) => {
                                            draggedCourse.current = { id: course.id, folderId: group.id };
                                            event.dataTransfer.effectAllowed = "move";
                                            event.dataTransfer.setData("text/plain", course.id);
                                          }}
                                          onDragEnd={() => { draggedCourse.current = null; setCourseDropTarget(null); }}
                                          onKeyDown={(event) => {
                                            if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
                                            event.preventDefault();
                                            const index = groupCourses.findIndex((item) => item.id === course.id);
                                            const target = groupCourses[index + (event.key === "ArrowUp" ? -1 : 1)];
                                            if (target) void handleReorderCourse(course.id, target.id, group.id);
                                          }}
                                        >⠿</button>)}
                                        {(<input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleCourseSelection(course.id)}
                                          className={styles.emailRowCheckbox}
                                          title={`Select ${course.title}`}
                                          onClick={(e) => e.stopPropagation()}
                                        />)}
                                        <button
                                          type="button"
                                          className={styles.compactCourseMain}
                                          onClick={() => setCourseId(course.id)}
                                          title={`${course.title} (${countSecs} sections)`}
                                        >
                                          <span className={styles.compactCourseTitle}>
                                            {course.title}
                                          </span>
                                          <div className={styles.compactCourseMetaGroup}>
                                            <span className={styles.compactCourseSecCount}>{countSecs}s</span>
                                            <span className={styles.compactPillLocked}>
                                              PASSCODE
                                            </span>
                                          </div>
                                        </button>
                                        {isAdmin && <VisibilityToggle hidden={Boolean(course.metadata.hidden)} label={`course ${course.title}`} busy={busy.has(`hide-course:${course.id}`)} disabled={Boolean(processingMessage) || busy.has(`hide-course:${course.id}`)} onToggle={() => void mutate({ action: "set_course_hidden", courseId: course.id, hidden: !course.metadata.hidden }, `hide-course:${course.id}`, "Course visibility updated.")} />}
                                        {course.slug !== "applied-agentic-ai" && (
                                          (<button
                                            type="button"
                                            className={styles.courseRowDeleteBtn}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleDeleteSingleCourse(course);
                                            }}
                                            disabled={busy.has(`del-course:${course.id}`) || Boolean(processingMessage)}
                                            title={`Delete course “${course.title}”`}
                                          >
                                            ×
                                          </button>)
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {(<button
                                  type="button"
                                  className={styles.compactAddCourseBtn}
                                  onClick={() => {
                                    setTargetFolderForCourse(group.id);
                                    setShowNewCourseBox(true);
                                  }}
                                  title={`Add course to “${group.name}”`}
                                >
                                  + Add Course
                                </button>)}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Form to Create New Course (Sub-Folder) or Trigger Button */}
              {showNewCourseBox ? (
                <form onSubmit={handleCreateCourse} className={styles.newCourseInlineBox}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: "850", color: "#082945" }}>
                      CREATE NEW COURSE
                    </span>
                  </div>

                  <label style={{ fontSize: "11px", fontWeight: "700", color: "#687987" }}>
                    Folder:
                    <select
                      value={folderGroups.some(group => group.id === targetFolderForCourse) ? targetFolderForCourse : folderGroups[0]?.id || ""}
                      onChange={(e) => setTargetFolderForCourse(e.target.value)}
                      className={styles.folderSelectClean}
                    >
                      {folderGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          📁 {g.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.bulkSectionOption}>
                    <input type="checkbox" checked={addMultipleCourses} onChange={(event) => setAddMultipleCourses(event.target.checked)} />
                    Add multiple courses · Separate names with commas, hyphens, or periods
                  </label>
                  <input
                    type="text"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    placeholder={addMultipleCourses ? "Example: Course One, Course Two - Course Three. Course Four" : "e.g. Next.js Fullstack Masterclass"}
                    required
                    autoFocus
                    className={styles.folderInputClean}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="submit"
                      className={styles.btnPrimary}
                      style={{ padding: "6px 14px", fontSize: "11px", borderRadius: "6px" }}
                      disabled={busy.has("create-course") || !newCourseTitle.trim()}
                    >
                      {busy.has("create-course") ? (
                        <span className={styles.btnLoadingRow}>
                          <span className={styles.btnSpinnerSm} />
                          <span>loading..... Creating...</span>
                        </span>
                      ) : (
                        addMultipleCourses ? "Create Courses" : "Create Course"
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ padding: "6px 10px", fontSize: "11px", borderRadius: "6px" }}
                      onClick={() => {
                        setShowNewCourseBox(false);
                        setNewCourseTitle("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.newCourseSidebarBtn}
                  disabled={!folderGroups.length}
                  title={!folderGroups.length ? "Create your own folder first" : "Create a course"}
                  onClick={() => setShowNewCourseBox(true)}
                >
                  + New Course
                </button>
              )}
            </aside>

              {/* Main Workspace for Selected Course */}
              <section className={styles.workspace} aria-label="Selected course">
                {selectedCourse ? (
                  <>
                    {/* UNIFIED COURSE COMMAND HUB (Gộp toàn bộ layout hiển thị & điều khiển nhanh) */}
                    <div className={styles.courseCommandHub}>

                      {/* Main Course Info (Title & Description inline) */}
                      <div className={styles.commandHubTitleBox}>
                        <div className={styles.courseHeading}>
                        {editingTitle ? (
                          <div className={styles.titleEditBox}>
                            <input
                              type="text"
                              value={titleValue}
                              onChange={(e) => setTitleValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSaveTitle();
                                } else if (e.key === "Escape") {
                                  setTitleValue(selectedCourse?.title || "");
                                  setEditingTitle(false);
                                }
                              }}
                              placeholder="Enter course title…"
                              className={styles.titleInput}
                              autoFocus
                              required
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveTitle()}
                              disabled={busy.has(`title:${effectiveCourseId}`) || !titleValue.trim()}
                              className={styles.descSaveBtn}
                            >
                              {busy.has(`title:${effectiveCourseId}`) ? "Save…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTitleValue(selectedCourse?.title || "");
                                setEditingTitle(false);
                              }}
                              className={styles.descCancelBtn}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={styles.titleDisplayRow}>
                            <h2>{selectedCourse.title}</h2>
                            {canEditCourse && (<button
                              type="button"
                              onClick={() => {
                                setTitleValue(selectedCourse.title);
                                setEditingTitle(true);
                              }}
                              className={styles.inlineEditBtn}
                              title="Edit course title"
                            >
                              ✎ Edit Title
                            </button>)}
                          </div>
                        )}

                          <div className={styles.courseFileActions} role="group" aria-label="Course Drive files">
                          {isAdmin && driveEnabled && <DriveExport courseId={selectedCourse.id} label="Save course files to Drive" onSaved={refreshData} disabled={Boolean(processingMessage)} />}
                          </div>
                        </div>

                        <section className={styles.summaryPanel} aria-label="Course summary">
                        <span className={styles.summaryLabel}>Summary</span>
                        {editingDescription ? (
                          <div className={styles.descEditBox}>
                            <input
                              type="text"
                              aria-label="Course summary"
                              value={descriptionValue}
                              onChange={(e) => setDescriptionValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSaveDescription();
                                } else if (e.key === "Escape") {
                                  setDescriptionValue(selectedCourse.metadata?.summary ?? selectedCourse.description ?? "");
                                  setEditingDescription(false);
                                }
                              }}
                              placeholder="Add a short overview of this course…"
                              className={styles.descInput}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveDescription()}
                              disabled={busy.has(`desc:${effectiveCourseId}`)}
                              className={styles.descSaveBtn}
                            >
                              {busy.has(`desc:${effectiveCourseId}`) ? "Save…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDescriptionValue(selectedCourse.metadata?.summary ?? selectedCourse.description ?? "");
                                setEditingDescription(false);
                              }}
                              className={styles.descCancelBtn}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={styles.descInlineRow}>
                            <p className={`${styles.workspaceDescText} ${courseSummary ? "" : styles.summaryEmpty}`}>
                              {courseSummary || "No summary yet."}
                            </p>
                            {canEditCourse && (<button
                              type="button"
                              onClick={() => {
                                setDescriptionValue(selectedCourse.metadata?.summary ?? selectedCourse.description ?? "");
                                setEditingDescription(true);
                              }}
                              className={styles.inlineDescEditBtn}
                              title="Edit course summary"
                            >
                              ✎ Edit Summary
                            </button>)}
                          </div>
                        )}
                        </section>
                      </div>

                      {/* Passcode Quick Strip */}
                      {isAdmin && (<div className={styles.commandHubPasscodeStrip}><span>Learner &amp; Facilitator access</span><button type="button" className={styles.managePasscodesButton} onClick={() => setTab("passcodes")}>Manage passcodes</button></div>)}
                    </div>

                    {/* COURSE WORKSPACE SPLIT: Khung Section (Màu Đỏ - Trái) & Khung Icon (Màu Đen - Phải) */}
                    <div className={styles.courseBottomGrid}>
                      {/* 1. MERGED SECTIONS MANAGEMENT (Khung section chiếm phần màu đỏ) */}
                      <div className={styles.mergedSectionsBlock}>
                      <div className={styles.mergedSectionsHeader}>
                        <div className={styles.mergedSectionsTitle}>
                          <div className={styles.badgeIndex}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                          </div>
                          <div>
                            <h3>Course Sections &amp; Structure ({courseSections.length})</h3>
                            <p>
                              {canEditCourse ? "Manage, add, and remove curriculum sections for this course." : "View the curriculum and learning materials in this course."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className={styles.sectionUploadHelp}>
                        Import lesson JS from your PC or Drive into the project for editing. Select a Drive destination for PDF/PPTX attachments or exports.
                      </p>

                      {/* Multi-Section Batch Action Toolbar */}
                      {deletableSections.length > 0 && (
                        <div className={styles.sectionBatchToolbar}>
                          <label className={styles.sectionSelectAllLabel}>
                            <input
                              type="checkbox"
                              checked={isAllSectionsSelected}
                              onChange={handleSelectAllSectionsToggle}
                              className={styles.emailRowCheckbox}
                            />
                            <span>Select all ({deletableSections.length} deletable sections)</span>
                          </label>

                          <div className={styles.sectionBatchRight}>
                            {selectedSections.size > 0 && (
                              <span className={styles.emailCountBadge}>
                                Selected: {selectedSections.size}
                              </span>
                            )}
                            <button
                              type="button"
                              className={styles.btnDanger}
                              style={{ padding: "5px 12px", fontSize: "11px", borderRadius: "7px", fontWeight: "750" }}
                              onClick={() => void handleDeleteSelectedSections()}
                              disabled={selectedSections.size === 0 || busy.has("delete-selected-sections") || Boolean(processingMessage)}
                              title="Permanently delete selected sections"
                            >
                              {busy.has("delete-selected-sections") ? (
                                <span className={styles.btnLoadingRow}>
                                  <span className={styles.btnSpinnerSm} />
                                  <span>loading..... Deleting...</span>
                                </span>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  <span>Delete Selected Sections ({selectedSections.size})</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Section List */}

                      <div className={styles.sectionItemsContainer}>
                        {courseSections.length === 0 ? (
                          <div className={styles.noEmailMessage}>
                            No sections created in this course folder yet.
                          </div>
                        ) : (
                          courseSections.map((section, index) => {

                            const isDefault = selectedCourse.slug === "applied-agentic-ai" && ["section1", "section2"].includes(section.section_key);
                            const isChecked = selectedSections.has(section.id);
                            return (
                              <div
                                key={section.id}
                                id={`section-${section.id}`}
                                tabIndex={-1}
                                className={`${styles.sectionItemRow} ${isChecked ? styles.sectionItemRowSelected : ""} ${sectionDropTarget === section.id ? styles.sectionDropTarget : ""} ${editingSectionId === section.id ? styles.sectionItemRowEditing : ""}`}
                                onDragOver={(event) => {
                                  if (!canReorderSections || !draggedSection.current || processingMessage) return;
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  setSectionDropTarget(section.id);
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const source = draggedSection.current;
                                  draggedSection.current = null;
                                  setSectionDropTarget(null);
                                  if (canReorderSections && source) void handleReorderSection(source, section.id);
                                }}
                              >
                                <div className={styles.sectionItemLeft}>
                                  {canReorderSections && (<button type="button" className={styles.sectionDragHandle}
                                    draggable={canReorderSections && !processingMessage && !busy.has("reorder-sections")}
                                    disabled={!canReorderSections || Boolean(processingMessage) || busy.has("reorder-sections")}
                                    aria-label={`Reorder ${section.title}`}
                                    title="Drag to reorder · Arrow Up/Down to move"
                                    onDragStart={(event) => {
                                      draggedSection.current = section.id;
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData("text/plain", section.id);
                                    }}
                                    onDragEnd={() => { draggedSection.current = null; setSectionDropTarget(null); }}
                                    onKeyDown={(event) => {
                                      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
                                      event.preventDefault();
                                      const target = courseSections[index + (event.key === "ArrowUp" ? -1 : 1)];
                                      if (target) void handleReorderSection(section.id, target.id);
                                    }}
                                  >⠿</button>)}
                                  {!isDefault && (
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleSectionSelection(section.id)}
                                      className={styles.emailRowCheckbox}
                                      title={`Select section “${section.title}”`}
                                    />
                                  )}
                                  <span className={styles.sectionItemPosition}>
                                    Section {index + 1}
                                  </span>
                                  <DraggableScrollArea
                                    className={styles.sectionTitleScrollArea}
                                    title={`${section.title} (kéo qua lại để xem hết)`}
                                  >
                                    {editingSectionId === section.id ? (
                                      <form onSubmit={(event) => void handleRenameSection(event, section)} className={`${styles.addSectionForm} ${styles.sectionRenameForm}`}>
                                        <input
                                          className={styles.addSectionInput}
                                          aria-label="Section name"
                                          value={sectionTitleValue}
                                          onChange={(event) => setSectionTitleValue(event.target.value)}
                                          maxLength={120}
                                          required
                                          autoFocus
                                          disabled={busy.has(`rename-sec:${section.id}`)}
                                        />
                                        <button type="submit" className={styles.addSectionButton} disabled={!sectionTitleValue.trim() || busy.has(`rename-sec:${section.id}`)}>
                                          {busy.has(`rename-sec:${section.id}`) ? "Saving…" : "Save"}
                                        </button>
                                        <button type="button" className={styles.removeBtn} onClick={() => setEditingSectionId(null)} disabled={busy.has(`rename-sec:${section.id}`)}>Cancel</button>
                                      </form>
                                    ) : (
                                      <span className={styles.sectionItemTitle}>
                                        {section.title}
                                      </span>
                                    )}
                                    <span className={styles.sectionContentMeta}>
                                      {section.source_filename
                                        ? `${isDefault ? "Built-in deck + PPTX attachment" : section.content_type === "tsx" ? "JS" : section.content_type.toUpperCase()} · ${section.content_path?.startsWith("drive:") ? "Drive" : "Legacy file"} · ${section.content_type === "tsx" ? section.source_filename.replace(/\.tsx$/i, ".js") : section.source_filename}`
                                        : isDefault
                                          ? "Built-in interactive deck"
                                          : "No presentation file"}
                                    </span>
                                  </DraggableScrollArea>
                                </div>
                                <div className={styles.sectionItemRight}>
                                  {isAdmin && <button type="button"
                                    className={`${styles.visibilityToggle} ${selectedCourse.metadata?.terminableSectionIds?.includes(section.id) ? styles.terminationEnabled : styles.visibilityToggleHidden}`}
                                    aria-label={`Enable Terminate section for ${section.title}`}
                                    title={`${selectedCourse.metadata?.terminableSectionIds?.includes(section.id) ? "Disable" : "Enable"} Terminate section`}
                                    aria-pressed={selectedCourse.metadata?.terminableSectionIds?.includes(section.id) === true}
                                    disabled={Boolean(processingMessage) || busy.has(`termination:${section.id}`)}
                                    onClick={event => { event.stopPropagation(); void mutate({ action: "set_section_termination", sectionId: section.id, enabled: !selectedCourse.metadata?.terminableSectionIds?.includes(section.id) }, `termination:${section.id}`, "Section termination setting updated.", "Updating Terminate section setting..."); }}>
                                    {busy.has(`termination:${section.id}`) ? <span className={styles.btnSpinnerSm} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                      <path opacity={selectedCourse.metadata?.terminableSectionIds?.includes(section.id) ? 1 : .35} d="M5 5h14M12 5v15" />
                                      {!selectedCourse.metadata?.terminableSectionIds?.includes(section.id) && <path d="m3 3 18 18" />}
                                    </svg>}
                                  </button>}
                                  <VisibilityToggle hidden={Boolean(section.hidden)} label={`section ${section.title}`} busy={busy.has(`hide-section:${section.id}`)} disabled={Boolean(processingMessage) || busy.has(`hide-section:${section.id}`)} onToggle={() => void mutate({ action: "set_section_hidden", sectionId: section.id, hidden: !section.hidden }, `hide-section:${section.id}`, "Section visibility updated.")} />
                                  {isAdmin && <div className={styles.sectionFileActions} role="group" aria-label="PC file actions">
                                    <SectionFileUpload key={section.id} sectionId={section.id} title={section.title} builtin={isDefault} onSaved={refreshData} disabled={Boolean(processingMessage)} />
                                    {(isDefault || section.content_path || section.content_type === "tsx") && <a
                                      className={actionIconStyles.button}
                                      href={`/api/sections/${encodeURIComponent(section.id)}/content?download=1${isDefault ? "&builtin=1" : ""}`}
                                      download={isDefault ? `${section.section_key}.js` : (section.source_filename || `section.${section.content_type === "tsx" ? "js" : section.content_type}`).replace(/\.tsx$/i, ".js")}
                                      aria-label={isDefault || section.content_type === "tsx" ? `Download ${section.title} as JS` : `Download ${section.title} to PC`}
                                      title="Download to PC"
                                      onClick={event => event.stopPropagation()}
                                    ><PcActionIcon direction="download" /></a>}
                                  </div>}
                                  {isAdmin && driveEnabled && <div className={styles.sectionFileActions} role="group" aria-label="Drive file actions">
                                    <DriveImport sectionId={section.id} title={section.title} onSaved={refreshData} disabled={Boolean(processingMessage)} />
                                    <DriveExport sectionId={section.id} label={`Save ${section.title} to Drive`} allowReplace={!isDefault} onSaved={refreshData} disabled={Boolean(processingMessage)} />
                                  </div>}
                                  <Link className={styles.sectionUploadButton} href={`/learn?courseId=${encodeURIComponent(selectedCourse.id)}&sectionId=${encodeURIComponent(section.id)}`}>View</Link>

                                  {(<button
                                    type="button"
                                    className={`${styles.addSectionButton} ${styles.sectionActionIcon}`}
                                    aria-label={`Rename section ${section.title}`}
                                    title="Rename section"
                                    onClick={() => {
                                      setEditingSectionId(section.id);
                                      setSectionTitleValue(section.title);
                                    }}
                                    disabled={Boolean(processingMessage) || editingSectionId === section.id}
                                  >
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-13 13H3v-5ZM14 5l5 5" /></svg>
                                  </button>)}
                                  {!isDefault && (
                                    <button
                                      type="button"
                                      className={`${styles.removeBtn} ${styles.sectionActionIcon}`}
                                      aria-label={`Delete section ${section.title}`}
                                      onClick={() => void handleDeleteSection(section)}
                                      disabled={busy.has(`sec:${section.id}`)}
                                      title={`Delete section “${section.title}”`}
                                    >
                                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add Section Form */}
                      {canEditCourse && <>
                      <label className={styles.bulkSectionOption}>
                        <input type="checkbox" checked={addMultipleSections} onChange={(event) => setAddMultipleSections(event.target.checked)} />
                        Add multiple sections · Separate names with commas, hyphens, or periods
                      </label>

                      <form onSubmit={handleAddSection} className={styles.addSectionForm}>
                        <input
                          type="text"
                          value={newSectionTitle}
                          onChange={(e) => setNewSectionTitle(e.target.value)}
                          placeholder={addMultipleSections ? "Example: Section One, Section Two - Section Three. Section Four" : "New section title (e.g. Module 3: Advanced Function Calling)…"}
                          className={styles.addSectionInput}
                          required
                        />
                        <button
                          type="submit"
                          className={styles.addSectionButton}
                          disabled={busy.has(`add-sec:${effectiveCourseId}`) || !newSectionTitle.trim()}
                        >
                          {busy.has(`add-sec:${effectiveCourseId}`) ? "Adding…" : addMultipleSections ? "+ Add Sections" : "+ Add Section"}
                        </button>
                      </form>
                      </>}
                    </div>

                      <aside className={styles.courseSettingsRail} aria-label="Course appearance">
                      <CourseSystemIcons key={effectiveCourseId}
                        icons={selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || []}
                        editable={canEditCourse} disabled={Boolean(processingMessage) || busy.has(`icons:${effectiveCourseId}`)}
                        onSave={saveSystemIcons} />
                      <div className={styles.templateSetup}>
                        <div className={styles.systemIconsHeader}>
                          <div className={styles.systemIconsTitleArea}>
                            <span className={styles.badgeIndex}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg></span>
                            <div><h3><label htmlFor="course-slide-template">Slide template</label></h3><p>Layout for PPTX, PDF and JS slides.</p></div>
                          </div>
                        </div>
                        <select id="course-slide-template" aria-label="Slide template" value={selectedCourse.metadata?.templateKey ?? (Object.keys(selectedCourse.metadata?.sectionTemplates ?? {}).length ? "__legacy" : "")} disabled={!canEditCourse || Boolean(processingMessage) || busy.has(`template:${effectiveCourseId}`) || Boolean(templateError)} onChange={event => void mutate({ action: "set_course_template", courseId: effectiveCourseId, templateKey: event.target.value }, `template:${effectiveCourseId}`, "Course template updated.", "Applying slide template...")}>
                          <option value="">Original slides (no template)</option>
                          {selectedCourse.metadata?.templateKey === undefined && Object.keys(selectedCourse.metadata?.sectionTemplates ?? {}).length > 0 && <option disabled value="__legacy">Existing section layouts</option>}
                          {selectedCourse.metadata?.templateKey && !templates.some(template => template.id === selectedCourse.metadata.templateKey) && <option value={selectedCourse.metadata.templateKey}>Deleted layout - choose another</option>}
                          {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                        </select>
                        {templateError && <p role="alert">{templateError}</p>}
                      </div>
                      <section className={styles.courseLanguage} aria-labelledby="course-language-heading">
                        <div className={styles.systemIconsHeader}>
                          <div className={styles.systemIconsTitleArea}>
                            <span className={styles.badgeIndex}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></span>
                            <div><h3 id="course-language-heading">Language</h3><p>Language label for this course.</p></div>
                          </div>
                        </div>
                        <div className={styles.langSelector} role="group" aria-label="Course language">
                          {languageOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              aria-pressed={selectedCourse.language_label === opt.value}
                              className={`${styles.langBtn} ${selectedCourse.language_label === opt.value ? styles.langActive : ""}`}
                              onClick={() => void setLanguage(opt.value)}
                              disabled={!canEditCourse || busy.has(`lang:${effectiveCourseId}`)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className={`${styles.languageFeedback} ${languageFeedback?.courseId === effectiveCourseId && languageFeedback.failed ? styles.languageFeedbackError : ""}`} role="status" aria-live="polite">
                          {languageFeedback?.courseId === effectiveCourseId ? languageFeedback.message : ""}
                        </p>
                      </section>
                      </aside>
                    </div>
                  </>
                ) : (
                  <div className={styles.noEmailMessage}>No course selected.</div>
                )}
              </section>
            </div>
        )}
      </div>

      {/* =========================================================================
          EIU LUXURY MODAL POP-UP DIALOG (Chuẩn EIU Luxury Design System)
          ========================================================================= */}
      <EiuConfirmDialog dialog={dialog} onClose={closeDialog} />
    </main>
  );
}
