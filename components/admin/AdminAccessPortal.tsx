"use client";
import TeacherAccounts from "./TeacherAccounts";

import CourseManagerHeader from "./CourseManagerHeader";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AdminAccessPortal.module.css";
import { createUploadQueue } from "@/lib/uploadQueue";
import { uploadSectionFile } from "@/lib/uploadSectionFile";
import SectionBatchUpload from "./SectionBatchUpload";

type LanguageLabel = "vi" | "en" | "vi_en";

export type CourseFolderGroup = {
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
  summary: string;
  allowedEmails: string[];
  passcode?: string;
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
  success: boolean;
  message?: string;
  courses?: Course[];
  sections?: Section[];
  folderGroups?: CourseFolderGroup[];
  authorizedEmails?: string[];
  generatedCode?: string;
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

const FIXED_ADMIN_EMAIL = "son.lam@eiu.edu.vn";

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;

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
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
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

export default function AdminAccessPortal({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<"emails" | "courses" | "teachers">("emails");
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>([]);
  const [courseId, setCourseId] = useState("");
  const [iconProcessing, setIconProcessing] = useState<{
    stage: string;
    source: string;
    previewUrl?: string;
  } | null>(null);
  const [iconDragActive, setIconDragActive] = useState(false);

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
  const [bulkEmailText, setBulkEmailText] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Multi-course selection state for unlock/lock and batch delete
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  // Multi-section selection state for batch delete
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());

  // Multi-folder group selection state for batch delete
  const [selectedFolderGroups, setSelectedFolderGroups] = useState<Set<string>>(new Set());

  // Course settings state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingCoursePasscode, setEditingCoursePasscode] = useState(false);
  const [customCoursePasscode, setCustomCoursePasscode] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addMultipleSections, setAddMultipleSections] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleValue, setSectionTitleValue] = useState("");

  // New course state
  const [showNewCourseBox, setShowNewCourseBox] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [addMultipleCourses, setAddMultipleCourses] = useState(false);
  const [targetFolderForCourse, setTargetFolderForCourse] = useState<string>("fg-ai-agentic");

  // Folder groups state (Folder Lớn)
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
  const sectionUploadQueue = useRef(createUploadQueue());
  const pendingSectionUploads = useRef(new Set<string>());
  const draggedSection = useRef<string | null>(null);
  const [sectionDropTarget, setSectionDropTarget] = useState<string | null>(null);
  const draggedCourse = useRef<{ id: string; folderId: string } | null>(null);
  const [courseDropTarget, setCourseDropTarget] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const apply = useCallback((payload: Payload) => {
    if (payload.courses) setCourses(payload.courses);
    if (payload.sections) setSections(payload.sections);
    if (payload.folderGroups) setFolderGroups(payload.folderGroups);
    if (payload.authorizedEmails) setAuthorizedEmails(payload.authorizedEmails);
  }, []);

  function toggleFolderCollapse(folderId: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  const loadData = useCallback(() => {
    return fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as Payload;
        if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load administration data.");
        apply(payload);
      });
  }, [apply]);

  useEffect(() => {
    let disposed = false;
    loadData()
      .catch((caught) => {
        if (!disposed) setError(caught instanceof Error ? caught.message : "Unable to load administration data.");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [loadData]);

  const [courseSearch, setCourseSearch] = useState("");

  const activeCourses = useMemo(() => courses.filter((c) => c.status === "active"), [courses]);
  const effectiveCourseId = activeCourses.some((c) => c.id === courseId) ? courseId : activeCourses[0]?.id ?? "";
  const selectedCourse = activeCourses.find((c) => c.id === effectiveCourseId) ?? null;
  const courseSections = useMemo(
    () => sections.filter((s) => s.course_id === effectiveCourseId && s.status === "active").sort((a, b) => a.position - b.position),
    [sections, effectiveCourseId]
  );

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

  useEffect(() => {
    setTitleValue(selectedCourse?.title || "");
    setEditingTitle(false);
    setDescriptionValue(selectedCourse?.metadata?.summary || selectedCourse?.description || "");
    setEditingDescription(false);
    setEditingCoursePasscode(false);
    setCustomCoursePasscode("");
  }, [
    effectiveCourseId,
    selectedCourse?.title,
    selectedCourse?.metadata?.summary,
    selectedCourse?.description,
    selectedCourse?.passcode,
    selectedCourse?.metadata?.passcode,
  ]);

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
    processingText?: string
  ) {
    setBusy((current) => new Set(current).add(key));
    if (processingText) {
      setProcessingMessage(processingText);
    }
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to save changes.");
      apply(payload);
      setNotice(successMessage);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "An error occurred.");
      return false;
    } finally {
      setProcessingMessage(null);
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

  const filteredEmails = useMemo(() => {
    const q = emailSearch.trim().toLowerCase();
    if (!q) return authorizedEmails;
    return authorizedEmails.filter((e) => e.toLowerCase().includes(q));
  }, [authorizedEmails, emailSearch]);

  const selectableEmails = useMemo(() => {
    return filteredEmails.filter((e) => e.toLowerCase() !== FIXED_ADMIN_EMAIL.toLowerCase());
  }, [filteredEmails]);

  const isAllSelected = selectableEmails.length > 0 && selectableEmails.every((e) => selectedEmails.has(e));

  function handleToggleSelectAll() {
    if (isAllSelected) {
      // Unselect all in current filtered list
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        for (const e of selectableEmails) next.delete(e);
        return next;
      });
    } else {
      // Select all in current filtered list
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        for (const e of selectableEmails) next.add(e);
        return next;
      });
    }
  }

  function handleToggleEmail(email: string) {
    if (email.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase()) return;
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }

  async function handleBulkAddEmails() {
    if (!bulkEmailText.trim()) return;
    const ok = await mutate(
      {
        action: "grant_emails_bulk",
        rawEmails: bulkEmailText,
        mode: "append",
      },
      "bulk-add-emails",
      "Successfully authorized student emails.",
      "loading..... Adding learner emails to platform..."
    );
    if (ok) setBulkEmailText("");
  }

  async function handleBulkReplaceEmails() {
    if (!bulkEmailText.trim()) return;
    showConfirm({
      title: "Replace All Learner Emails",
      message: "This action will replace the ENTIRE current learner emails whitelist with the new entries provided above.",
      detail: "The fixed admin email (son.lam@eiu.edu.vn) will always be preserved safely.",
      confirmLabel: "Replace All",
      cancelLabel: "Keep Existing List",
      variant: "danger",
      onConfirm: async () => {
        const ok = await mutate(
          {
            action: "grant_emails_bulk",
            rawEmails: bulkEmailText,
            mode: "replace",
          },
          "bulk-replace-emails",
          "Replaced platform authorized emails list.",
          "loading..... Replacing authorized learner emails list..."
        );
        if (ok) {
          setBulkEmailText("");
          setSelectedEmails(new Set());
        }
      },
    });
  }

  async function handleDeleteSelectedEmails() {
    if (selectedEmails.size === 0) return;
    const count = selectedEmails.size;
    showConfirm({
      title: "Revoke Selected Learner Access",
      message: `Are you sure you want to revoke access for ${count} selected learner email(s)?`,
      detail: "These accounts will immediately lose platform access.",
      confirmLabel: `Delete ${count} Emails`,
      variant: "danger",
      onConfirm: async () => {
        const emailsToDelete = Array.from(selectedEmails);
        const ok = await mutate(
          {
            action: "remove_emails",
            emails: emailsToDelete,
          },
          "delete-selected-emails",
          `Removed ${emailsToDelete.length} email(s) from platform access.`,
          `loading..... Deleting ${emailsToDelete.length} selected emails...`
        );
        if (ok) {
          setSelectedEmails((prev) => {
            const next = new Set(prev);
            for (const e of emailsToDelete) next.delete(e);
            return next;
          });
        }
      },
    });
  }

  async function handleRemoveSingleEmail(email: string) {
    if (email.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase()) {
      showAlert({
        title: "Protected Administrator",
        message: "The fixed admin email (son.lam@eiu.edu.vn) is protected and cannot be removed.",
      });
      return;
    }
    showConfirm({
      title: "Revoke Learner Access",
      message: `Are you sure you want to revoke platform access for “${email}”?`,
      confirmLabel: "Revoke Access",
      variant: "danger",
      onConfirm: async () => {
        const ok = await mutate(
          {
            action: "remove_emails",
            emails: [email],
          },
          `remove-email:${email}`,
          `Revoked access for ${email}.`,
          `loading..... Revoking access for ${email}...`
        );
        if (ok) {
          setSelectedEmails((prev) => {
            const next = new Set(prev);
            next.delete(email);
            return next;
          });
        }
      },
    });
  }

  async function handleClearAllEmails() {
    showConfirm({
      title: "Revoke All Learner Access",
      message: "Are you sure you want to revoke access for ALL learner emails across the platform?",
      detail: "The fixed admin account will remain unaffected. All learner emails will be cleared.",
      confirmLabel: "Clear All Learners",
      variant: "danger",
      onConfirm: async () => {
        const ok = await mutate(
          { action: "clear_emails" },
          "clear-all-emails",
          "Cleared all learner emails from platform access.",
          "loading..... Clearing all learner emails..."
        );
        if (ok) setSelectedEmails(new Set());
      },
    });
  }

  // =========================================================================
  // COURSE SETUP & PASSCODE BYPASS HANDLERS
  // =========================================================================

  async function handleSetAllCoursesUnlocked(unlocked: boolean) {
    showConfirm({
      title: unlocked ? "Unlock All Courses" : "Lock All Courses",
      message: unlocked
        ? "Are you sure you want to UNLOCK all courses? Logged-in learners can access and study directly without passcodes."
        : "Are you sure you want to LOCK all courses? Learners will need to enter the course passcode to access.",
      confirmLabel: unlocked ? "Unlock All Courses" : "Lock All Courses",
      variant: unlocked ? "gold" : "warning",
      onConfirm: async () => {
        await mutate(
          { action: "set_all_courses_unlocked", unlocked },
          "unlock-all",
          unlocked ? "All courses are now UNLOCKED (no passcode required)." : "All courses are now LOCKED (passcode required).",
          unlocked ? "loading..... Unlocking all courses..." : "loading..... Locking all courses..."
        );
      },
    });
  }

  async function handleSetSelectedCoursesUnlocked(unlocked: boolean) {
    if (selectedCourses.size === 0) return;
    const courseIds = Array.from(selectedCourses);
    await mutate(
      {
        action: "set_course_unlocked",
        courseIds,
        unlocked,
      },
      "unlock-selected",
      unlocked
        ? `Unlocked ${courseIds.length} course(s) (no passcode required).`
        : `Locked ${courseIds.length} course(s) (passcode required).`,
      unlocked
        ? `loading..... Unlocking ${courseIds.length} selected course(s)...`
        : `loading..... Locking ${courseIds.length} selected course(s)...`
    );
  }

  async function handleToggleSingleCourseUnlocked(course: Course) {
    const nextUnlocked = !(course.unlocked ?? course.metadata?.unlocked ?? false);
    await mutate(
      {
        action: "set_course_unlocked",
        courseId: course.id,
        unlocked: nextUnlocked,
      },
      `unlock-course:${course.id}`,
      nextUnlocked
        ? `Course “${course.title}” is now UNLOCKED (no passcode required).`
        : `Course “${course.title}” is now LOCKED (passcode required).`,
      nextUnlocked ? `loading..... Unlocking “${course.title}”...` : `loading..... Locking “${course.title}”...`
    );
  }

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

  async function handleMoveCourseFolder(targetCourseId: string, folderGroupId: string) {
    const targetGroup = folderGroups.find((g) => g.id === folderGroupId);
    const targetName = targetGroup?.name || "AI & Agentic Programs";
    await mutate(
      {
        action: "set_course_folder_group",
        courseId: targetCourseId,
        folderGroupId,
        folderGroupName: targetName,
      },
      `move-course:${targetCourseId}`,
      `Moved course to folder “${targetName}”.`,
      `loading..... Moving course to folder “${targetName}”...`
    );
  }

  async function handleToggleFolderGroupUnlocked(group: CourseFolderGroup, unlocked: boolean) {
    const label = unlocked ? "Unlock All in" : "Lock All in";
    showConfirm({
      title: `${label} “${group.name}”`,
      message: `Are you sure you want to ${unlocked ? "unlock" : "lock"} all courses in parent folder “${group.name}”?`,
      confirmLabel: unlocked ? "Unlock All Courses" : "Lock All Courses",
      variant: unlocked ? "gold" : "warning",
      onConfirm: async () => {
        await mutate(
          { action: "set_folder_group_unlocked", folderGroupId: group.id, unlocked },
          `unlock-folder:${group.id}`,
          unlocked
            ? `Unlocked all courses in folder “${group.name}”.`
            : `Locked all courses in folder “${group.name}”.`,
          unlocked
            ? `loading..... Unlocking all courses in folder “${group.name}”...`
            : `loading..... Locking all courses in folder “${group.name}”...`
        );
      },
    });
  }

  function handleToggleCourseSelection(id: string) {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAllCoursesToggle() {
    if (selectedCourses.size === activeCourses.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(activeCourses.map((c) => c.id)));
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

  async function handleGenerateCoursePasscode() {
    const key = `gen-pass:${effectiveCourseId}`;
    setBusy((current) => new Set(current).add(key));
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_course_passcode",
          courseId: effectiveCourseId,
        }),
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to generate passcode.");
      apply(payload);
      setNotice(`Generated new folder passcode: ${payload.generatedCode}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate passcode.");
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleSaveCoursePasscode() {
    const code = customCoursePasscode.trim();
    if (!code) return;
    const ok = await mutate(
      {
        action: "set_course_passcode",
        courseId: effectiveCourseId,
        code,
      },
      `set-pass:${effectiveCourseId}`,
      `Updated folder passcode to ${code}.`
    );
    if (ok) {
      setEditingCoursePasscode(false);
      setCustomCoursePasscode("");
    }
  }

  async function setLanguage(languageLabel: LanguageLabel) {
    await mutate(
      { action: "set_course_language", courseId: effectiveCourseId, languageLabel },
      `lang:${effectiveCourseId}`,
      "Updated course folder language label."
    );
  }

  // =========================================================================
  // COURSE SYSTEM ICONS HANDLERS (Copy-paste / Upload / Compress / Save)
  // =========================================================================

  /**
   * Smart Boundary Flood-Fill Background Removal on HTML5 Canvas.
   * Starts from image perimeter, detects exterior background color (white, light-gray, or black),
   * and converts exterior background to transparent alpha without affecting interior graphics.
   */
  function removeCanvasBackground(canvas: HTMLCanvasElement, tolerance = 38): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    if (w <= 0 || h <= 0) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Check corners to detect background color
    const corners = [
      0, // top-left
      (w - 1) * 4, // top-right
      ((h - 1) * w) * 4, // bottom-left
      ((h - 1) * w + (w - 1)) * 4, // bottom-right
    ];

    let transparentCorners = 0;
    for (const c of corners) {
      if (data[c + 3] < 128) transparentCorners++;
    }
    // If corners are already transparent, no background removal is needed
    if (transparentCorners >= 3) return;

    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (const c of corners) {
      if (data[c + 3] >= 128) {
        sumR += data[c];
        sumG += data[c + 1];
        sumB += data[c + 2];
        count++;
      }
    }
    if (count === 0) return;
    const bgR = Math.round(sumR / count);
    const bgG = Math.round(sumG / count);
    const bgB = Math.round(sumB / count);

    // BFS Flood Fill from perimeter
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    for (let x = 0; x < w; x++) {
      queue.push(x, 0);
      queue.push(x, h - 1);
      visited[x] = 1;
      visited[(h - 1) * w + x] = 1;
    }
    for (let y = 1; y < h - 1; y++) {
      queue.push(0, y);
      queue.push(w - 1, y);
      visited[y * w] = 1;
      visited[y * w + (w - 1)] = 1;
    }

    const softEdgeBand = 16;
    let head = 0;
    while (head < queue.length) {
      const px = queue[head++];
      const py = queue[head++];
      const idx = (py * w + px) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a === 0) {
        const neighbors = [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              queue.push(nx, ny);
            }
          }
        }
        continue;
      }

      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      if (dist <= tolerance) {
        data[idx + 3] = 0;
        const neighbors = [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              queue.push(nx, ny);
            }
          }
        }
      } else if (dist < tolerance + softEdgeBand) {
        const factor = (dist - tolerance) / softEdgeBand;
        data[idx + 3] = Math.round(data[idx + 3] * factor);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function compressAndResizeIcon(
    file: File | Blob | string,
    maxWidth = 64,
    maxHeight = 64,
    shouldRemoveBg = true
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const processSrc = (src: string) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          if (shouldRemoveBg) {
            try {
              removeCanvasBackground(canvas);
            } catch {
              // fallback gracefully
            }
          }

          try {
            const pngUrl = canvas.toDataURL("image/png");
            resolve(pngUrl);
          } catch {
            resolve(src);
          }
        };
        img.onerror = () => reject(new Error("Unable to decode image."));
        img.src = src;
      };

      if (typeof file === "string") {
        processSrc(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          processSrc(e.target?.result as string);
        };
        reader.onerror = () => reject(new Error("Unable to read file."));
        reader.readAsDataURL(file);
      }
    });
  }

  async function saveSystemIcons(updatedIcons: CourseSystemIcon[]) {
    if (!effectiveCourseId) return;
    setBusy((prev) => new Set(prev).add(`icons:${effectiveCourseId}`));
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_course_system_icons",
          courseId: effectiveCourseId,
          systemIcons: updatedIcons,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save icons.");
      }
      setCourses((prev) =>
        prev.map((c) =>
          c.id === effectiveCourseId
            ? {
                ...c,
                systemIcons: updatedIcons,
                metadata: { ...c.metadata, systemIcons: updatedIcons },
              }
            : c
        )
      );
      setNotice("System icons updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update icons.");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(`icons:${effectiveCourseId}`);
        return next;
      });
    }
  }

  async function handleAddIcon(name: string, url: string) {
    if (!selectedCourse || !effectiveCourseId) return;
    const currentIcons: CourseSystemIcon[] = selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || [];
    const newIcon: CourseSystemIcon = {
      id: `icon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      url,
      scale: 1.0,
    };
    await saveSystemIcons([...currentIcons, newIcon]);
  }

  async function handleRemoveIcon(iconId: string) {
    if (!selectedCourse || !effectiveCourseId) return;
    const currentIcons: CourseSystemIcon[] = selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || [];
    await saveSystemIcons(currentIcons.filter((ic) => ic.id !== iconId));
  }

  function handleRenameIcon(iconId: string, newName: string) {
    if (!selectedCourse || !effectiveCourseId) return;
    const currentIcons: CourseSystemIcon[] = selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || [];
    const updated = currentIcons.map((ic) => (ic.id === iconId ? { ...ic, name: newName } : ic));
    setCourses((prev) =>
      prev.map((c) =>
        c.id === effectiveCourseId
          ? {
              ...c,
              systemIcons: updated,
              metadata: { ...c.metadata, systemIcons: updated },
            }
          : c
      )
    );
  }

  async function processIncomingIconFile(file: File | Blob, name: string, source: string) {
    if (iconProcessing) return;
    try {
      setIconProcessing({ stage: "Đang tách nền…", source });
      // 100% automatic boundary background removal
      const compressedUrl = await compressAndResizeIcon(file, 64, 64, true);
      setIconProcessing({ stage: "Đang lưu icon…", source, previewUrl: compressedUrl });
      await handleAddIcon(name, compressedUrl);
    } catch {
      setError(`Could not process ${source} image.`);
    } finally {
      setIconProcessing(null);
    }
  }

  async function handlePasteImage(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        await processIncomingIconFile(file, "", "pasted");
        break;
      }
    }
  }

  function handleIconDragOver(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!iconDragActive) setIconDragActive(true);
  }

  function handleIconDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIconDragActive(false);
  }

  async function handleIconDrop(e: React.DragEvent) {
    e.preventDefault();
    setIconDragActive(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) {
      setError("Please drop an image file (PNG, JPG, WEBP, SVG).");
      return;
    }
    const autoName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "";
    await processIncomingIconFile(file, autoName.toLowerCase() === "image" ? "" : autoName, "dropped");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const autoName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "";
    try {
      await processIncomingIconFile(file, autoName.toLowerCase() === "image" ? "" : autoName, "uploaded");
    } finally {
      e.target.value = "";
    }
  }

  // =========================================================================
  // MERGED COURSE SECTIONS HANDLERS (Thêm & Xóa Section gộp vào)
  // =========================================================================

  // Reset selected sections when active course changes
  useEffect(() => {
    setSelectedSections(new Set());
  }, [effectiveCourseId]);

  const deletableSections = useMemo(
    () => courseSections.filter((s) => !(selectedCourse?.slug === "applied-agentic-ai" && ["section1", "section2"].includes(s.section_key))),
    [courseSections, selectedCourse?.slug]
  );

  const isAllSectionsSelected =
    deletableSections.length > 0 && deletableSections.every((s) => selectedSections.has(s.id));

  function handleToggleSectionSelection(id: string) {
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
    if (sourceId === targetId || !effectiveCourseId || processingMessage || busy.has("reorder-sections")) return;
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

  async function handleSectionContentUpload(section: Section, file: File | undefined, onProgress?: (value: number) => void): Promise<boolean> {
    if (!file) return false;
    if (file.size > 50 * 1024 * 1024) {
      setError("The maximum file size is 50 MB.");
      setNotice("");
      return false;
    }
    const key = `upload-section:${section.id}`;
    if (pendingSectionUploads.current.has(key)) return false;
    pendingSectionUploads.current.add(key);
    setBusy((current) => new Set(current).add(key));
    return sectionUploadQueue.current(async () => {
    setError("");
    setNotice("");
    try {
      const payload = (await uploadSectionFile(`/api/admin/sections/${encodeURIComponent(section.id)}/content`, file, onProgress)) as {
        success?: boolean;
        message?: string;
        contentType: Section["content_type"];
        contentPath: string;
        sourceFilename: string;
        slideCount: number | null;
      };
      setSections((current) => current.map((item) => item.id === section.id ? {
        ...item,
        content_type: payload.contentType,
        content_path: payload.contentPath,
        source_filename: payload.sourceFilename,
        slide_count: payload.slideCount,
      } : item));
      setNotice(file.name.toLowerCase().endsWith(".pptx")
        ? `Uploaded "${file.name}" with all package content preserved. Open the section to preview or download the file.`
        : `Uploaded "${file.name}". The section now opens in the shared presentation frame.`);
      return true;
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "TimeoutError"
        ? `Upload of "${file.name}" timed out. Refresh to check whether it was saved before retrying.`
        : `Upload of "${file.name}" failed: ${caught instanceof Error ? caught.message : "Unable to upload section content."}`);
      return false;
    } finally {
      pendingSectionUploads.current.delete(key);
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
    });
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
    const targetFolderId = targetFolderForCourse || folderGroups[0]?.id || "fg-ai-agentic";
    const targetFolder = folderGroups.find((g) => g.id === targetFolderId) || folderGroups[0];
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
      <CourseManagerHeader role="admin" identity={adminEmail} onSignOut={() => void signOut()} />

      {/* EIU Luxury Top Control Row: Segmented Tabs (Left) + Master Access Toolbar (Right) */}
      <div className={styles.topControlRow}>
        <div className={styles.tabsTrack} role="tablist">
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "emails" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("emails")}
            role="tab"
            aria-selected={tab === "emails"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span>Authorized Emails</span>
            <span className={styles.tabBadge}>{authorizedEmails.length}</span>
          </button>
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
          <button type="button" className={`${styles.tabBtn} ${tab === "teachers" ? styles.tabBtnActive : ""}`} onClick={() => setTab("teachers")} role="tab" aria-selected={tab === "teachers"}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></svg>
            <span>Teacher Accounts</span>
          </button>
        </div>

        {tab === "courses" && (
          <div className={styles.masterAccessToolbar}>
            <div className={styles.masterAccessLeft}>
              <div className={styles.masterAccessBrand}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                <span>ACCESS BYPASS CONTROL</span>
              </div>
              <div className={styles.masterAccessDivider} />
              <label className={styles.unlockSelectAllLabel}>
                <input
                  type="checkbox"
                  checked={selectedCourses.size > 0 && selectedCourses.size === activeCourses.length}
                  onChange={handleSelectAllCoursesToggle}
                  className={styles.unlockCheckbox}
                />
                <span>Select All ({selectedCourses.size}/{activeCourses.length})</span>
              </label>
            </div>

            <div className={styles.masterAccessRight}>
              {/* Global Unlock / Lock All */}
              <div className={styles.masterGlobalBtns}>
                <button
                  type="button"
                  className={styles.btnUnlockAllCompact}
                  onClick={() => void handleSetAllCoursesUnlocked(true)}
                  disabled={busy.has("unlock-all") || Boolean(processingMessage)}
                  title="Unlock all courses for free access"
                >
                  {busy.has("unlock-all") ? (
                    <span className={styles.btnLoadingRow}>
                      <span className={styles.btnSpinnerSm} />
                      <span>loading...</span>
                    </span>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      <span>Unlock All</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.btnLockAllCompact}
                  onClick={() => void handleSetAllCoursesUnlocked(false)}
                  disabled={busy.has("unlock-all") || Boolean(processingMessage)}
                  title="Require passcode for all courses"
                >
                  {busy.has("unlock-all") ? (
                    <span className={styles.btnLoadingRow}>
                      <span className={styles.btnSpinnerSm} />
                      <span>loading...</span>
                    </span>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span>Lock All</span>
                    </>
                  )}
                </button>
              </div>

              {/* Batch Selective Actions (When courses are selected) */}
              {selectedCourses.size > 0 && (
                <div className={styles.selectiveActionBtnsCompact}>
                  <button
                    type="button"
                    className={`${styles.btnSelectiveActionCompact} ${styles.btnSelectiveUnlock}`}
                    onClick={() => void handleSetSelectedCoursesUnlocked(true)}
                    disabled={busy.has("unlock-selected") || Boolean(processingMessage)}
                    title="Unlock selected courses"
                  >
                    {busy.has("unlock-selected") ? (
                      <span className={styles.btnLoadingRow}><span className={styles.btnSpinnerSm} /><span>loading...</span></span>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                        <span>Unlock ({selectedCourses.size})</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnSelectiveActionCompact} ${styles.btnSelectiveLock}`}
                    onClick={() => void handleSetSelectedCoursesUnlocked(false)}
                    disabled={busy.has("unlock-selected") || Boolean(processingMessage)}
                    title="Lock selected courses"
                  >
                    {busy.has("unlock-selected") ? (
                      <span className={styles.btnLoadingRow}><span className={styles.btnSpinnerSm} /><span>loading...</span></span>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span>Lock ({selectedCourses.size})</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnSelectiveActionCompact} ${styles.btnSelectiveDelete}`}
                    onClick={() => void handleDeleteSelectedCourses()}
                    disabled={busy.has("delete-selected-courses") || Boolean(processingMessage)}
                    title="Permanently delete selected courses"
                  >
                    {busy.has("delete-selected-courses") ? (
                      <span className={styles.btnLoadingRow}><span className={styles.btnSpinnerSm} /><span>loading...</span></span>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Delete ({selectedCourses.size})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
              Synchronizing updates with Supabase database, please wait a moment...
            </span>
          </div>
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && !processingMessage && <div className={styles.notice} role="status">{notice}</div>}

      <div className={`${styles.scrollArea} ${tab === "courses" ? styles.scrollAreaCourses : ""}`}>
        {tab === "teachers" ? <TeacherAccounts /> : loading ? (
          <div className={styles.loading}>Loading administration data…</div>
        ) : tab === "emails" ? (
          /* =========================================================================
             FRAME 1: DEDICATED AUTHORIZED EMAIL MANAGEMENT FRAME (Add nhiều, Xóa nhiều, Search)
             ========================================================================= */
          <div className={styles.emailManagementLayout}>
            {/* Left Column: Bulk Add / Replace Input */}
            <div className={styles.emailFrameCard}>
              <div className={styles.emailFrameHead}>
                <span>BATCH ENROLLMENT</span>
                <h2>Add Authorized Emails</h2>
                <p>
                  Paste Gmail or EIU email addresses (separated by commas, spaces, or newlines). Anyone listed can sign in with their email to view all courses.
                </p>
              </div>

              <textarea
                className={styles.bulkTextarea}
                rows={10}
                value={bulkEmailText}
                onChange={(e) => setBulkEmailText(e.target.value)}
                placeholder={"student1@gmail.com\nstudent2@eiu.edu.vn\nstudent3@gmail.com"}
              />

              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void handleBulkAddEmails()}
                  disabled={!bulkEmailText.trim() || busy.has("bulk-add-emails") || Boolean(processingMessage)}
                >
                  {busy.has("bulk-add-emails") ? (
                    <span className={styles.btnLoadingRow}>
                      <span className={styles.btnSpinner} />
                      <span>Adding emails...</span>
                    </span>
                  ) : (
                    "+ Add to List (Bulk Add)"
                  )}
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => void handleBulkReplaceEmails()}
                  disabled={!bulkEmailText.trim() || busy.has("bulk-replace-emails") || Boolean(processingMessage)}
                >
                  {busy.has("bulk-replace-emails") ? (
                    <span className={styles.btnLoadingRow}>
                      <span className={styles.btnSpinner} />
                      <span>Replacing...</span>
                    </span>
                  ) : (
                    "Replace All"
                  )}
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setBulkEmailText("")}
                  disabled={!bulkEmailText || Boolean(processingMessage)}
                >
                  Clear Input
                </button>
              </div>
            </div>

            {/* Right Column: Searchable, Multi-Select Email Directory */}
            <div className={styles.emailFrameCard}>
              <div className={styles.emailFrameHead}>
                <span>ACCESS DIRECTORY &amp; PERMISSIONS</span>
                <h2>Active Learner Access List</h2>
                <p>
                  Search, multi-select checkboxes for batch delete, or manage individual learner permissions.
                </p>
              </div>

              {/* Real-time Search Box with Icon */}
              <div className={styles.emailSearchWrapper}>
                <span className={styles.emailSearchIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  type="text"
                  className={styles.emailSearchInput}
                  placeholder="Search emails in list (e.g. gmail, eiu, student name)…"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </div>

              {/* Multi-Select Action Toolbar */}
              <div className={styles.emailToolbar}>
                <label className={styles.emailSelectAllBox}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    disabled={selectableEmails.length === 0}
                    className={styles.emailRowCheckbox}
                  />
                  <span>Select All ({selectableEmails.length})</span>
                </label>

                <div className={styles.emailBatchActions}>
                  <span className={styles.emailCountBadge}>
                    Selected: {selectedEmails.size}
                  </span>

                  <button
                    type="button"
                    className={styles.btnDanger}
                    style={{ padding: "6px 14px", fontSize: "11px", borderRadius: "8px", fontWeight: "750" }}
                    onClick={() => void handleDeleteSelectedEmails()}
                    disabled={selectedEmails.size === 0 || busy.has("delete-selected-emails") || Boolean(processingMessage)}
                  >
                    {busy.has("delete-selected-emails") ? (
                      <span className={styles.btnLoadingRow}>
                        <span className={styles.btnSpinner} />
                        <span>Deleting {selectedEmails.size} email(s)...</span>
                      </span>
                    ) : (
                      `Delete Selected (${selectedEmails.size})`
                    )}
                  </button>

                  {authorizedEmails.length > 1 && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ padding: "6px 10px", fontSize: "11px", borderRadius: "8px" }}
                      onClick={() => void handleClearAllEmails()}
                      disabled={busy.has("clear-all-emails") || Boolean(processingMessage)}
                    >
                      {busy.has("clear-all-emails") ? (
                        <span className={styles.btnLoadingRow}>
                          <span className={styles.btnSpinner} />
                          <span>Clearing all...</span>
                        </span>
                      ) : (
                        "Clear All Learners"
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Email List */}
              <div className={styles.emailListScroll} style={{ maxHeight: "420px" }}>
                {Boolean(processingMessage) && (
                  <div className={styles.emailListProcessingBar}>
                    <span className={styles.btnSpinnerSm} />
                    <span>Synchronizing learner access list...</span>
                  </div>
                )}
                {filteredEmails.length === 0 ? (
                  <div className={styles.noEmailMessage}>
                    {emailSearch ? `No emails match “${emailSearch}”.` : "No authorized student emails found."}
                  </div>
                ) : (
                  filteredEmails.map((email) => {
                    const isAdmin = email.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase();
                    const isSelected = selectedEmails.has(email);
                    return (
                      <div
                        key={email}
                        className={`${styles.emailRow} ${isSelected ? styles.emailRowSelected : ""}`}
                      >
                        <div className={styles.emailRowLeft}>
                          {!isAdmin ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleEmail(email)}
                              className={styles.emailRowCheckbox}
                              aria-label={`Select ${email}`}
                            />
                          ) : (
                            <span style={{ width: "16px", display: "inline-block" }} />
                          )}
                          <span style={{ fontSize: "13px" }}>{email}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {isAdmin ? (
                            <span className={styles.adminTag}>FIXED ADMIN</span>
                          ) : (
                            <button
                              type="button"
                              className={styles.removeBtn}
                              onClick={() => void handleRemoveSingleEmail(email)}
                              disabled={busy.has(`remove-email:${email}`) || Boolean(processingMessage)}
                              title={`Revoke access for ${email}`}
                            >
                              {busy.has(`remove-email:${email}`) ? (
                                <span className={styles.rowRemovingState}>
                                  <span className={styles.btnSpinnerSm} />
                                  <span>Deleting...</span>
                                </span>
                              ) : (
                                "Remove"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
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
                <div className={styles.folderBatchToolbar}>
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
                </div>
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

                    const allUnlocked = childCourses.length > 0 && childCourses.every((c) => Boolean(c.unlocked ?? c.metadata?.unlocked));
                    const isFolderBusy = busy.has(`unlock-folder:${group.id}`);
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
                              {folderGroups.length > 1 && (
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
                            <div className={styles.folderGroupActions} onClick={(e) => e.stopPropagation()}>
                              {childCourses.length > 0 && (
                                <button
                                  type="button"
                                  className={allUnlocked ? styles.folderBtnLockIcon : styles.folderBtnUnlockIcon}
                                  onClick={() => void handleToggleFolderGroupUnlocked(group, !allUnlocked)}
                                  disabled={isFolderBusy || Boolean(processingMessage)}
                                  title={allUnlocked ? `Lock all in ${group.name}` : `Unlock all in ${group.name}`}
                                >
                                  {isFolderBusy ? (
                                    <span className={styles.btnSpinnerSm} />
                                  ) : allUnlocked ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/></svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                                  )}
                                </button>
                              )}

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

                              {folderGroups.length > 1 && (
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
                            </div>
                          </div>
                        )}

                        {/* Child Courses in this Parent Folder - COMPACT SLEEK LIST */}
                        {!isCollapsed && (
                          <div className={styles.folderGroupCoursesList}>
                            {childCourses.length === 0 ? (
                              <div className={styles.compactFolderEmpty}>
                                <span>No courses yet</span>
                                <button
                                  type="button"
                                  className={styles.compactAddCourseInlineBtn}
                                  onClick={() => {
                                    setTargetFolderForCourse(group.id);
                                    setShowNewCourseBox(true);
                                  }}
                                >
                                  + Add Course
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className={styles.compactCourseGroup}>
                                  {childCourses.map((course) => {
                                    const countSecs = sections.filter((s) => s.course_id === course.id && s.status === "active").length;
                                    const isSelected = effectiveCourseId === course.id;
                                    const isChecked = selectedCourses.has(course.id);
                                    const isUnlocked = Boolean(course.unlocked ?? course.metadata?.unlocked);

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
                                        <button type="button" className={styles.sectionDragHandle}
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
                                        >⠿</button>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleCourseSelection(course.id)}
                                          className={styles.emailRowCheckbox}
                                          title={`Select ${course.title}`}
                                          onClick={(e) => e.stopPropagation()}
                                        />
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
                                            <span className={isUnlocked ? styles.compactPillUnlocked : styles.compactPillLocked}>
                                              {isUnlocked ? "UNLOCKED" : "PASS"}
                                            </span>
                                          </div>
                                        </button>
                                        {course.slug !== "applied-agentic-ai" && (
                                          <button
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
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <button
                                  type="button"
                                  className={styles.compactAddCourseBtn}
                                  onClick={() => {
                                    setTargetFolderForCourse(group.id);
                                    setShowNewCourseBox(true);
                                  }}
                                  title={`Add course to “${group.name}”`}
                                >
                                  + Add Course
                                </button>
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
                      value={targetFolderForCourse}
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
                  onClick={() => setShowNewCourseBox(true)}
                >
                  + New Course
                </button>
              )}
            </aside>

              {/* Main Workspace for Selected Course */}
              <section className={styles.workspace}>
                {selectedCourse ? (
                  <>
                    {/* UNIFIED COURSE COMMAND HUB (Gộp toàn bộ layout hiển thị & điều khiển nhanh) */}
                    <div className={styles.courseCommandHub}>
                      {/* Top Bar: Parent Folder, Course Status, and Language */}
                      <div className={styles.commandHubTopRow}>
                        <div className={styles.commandHubTopLeft}>
                          {/* Folder Pill */}
                          <div className={styles.parentFolderPill}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#b39159">
                              <path d="M20 5h-9.586L8.707 3.293A.997.997 0 0 0 8 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/>
                            </svg>
                            <span className={styles.parentFolderLabel}>Folder:</span>
                            <select
                              value={selectedCourse.folderGroupId || "fg-ai-agentic"}
                              onChange={(e) => void handleMoveCourseFolder(selectedCourse.id, e.target.value)}
                              disabled={busy.has(`move-course:${selectedCourse.id}`) || Boolean(processingMessage)}
                              className={styles.parentFolderSelect}
                            >
                              {folderGroups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  📁 {g.name}
                                </option>
                              ))}
                            </select>
                            {busy.has(`move-course:${selectedCourse.id}`) && (
                              <span className={styles.movingFolderBadge}>
                                <span className={styles.btnSpinnerSm} />
                              </span>
                            )}
                          </div>

                          {/* Instant 1-Click Toggle Passcode Requirement */}
                          <button
                            type="button"
                            className={Boolean(selectedCourse.unlocked ?? selectedCourse.metadata?.unlocked) ? styles.unlockToggleBtnUnlocked : styles.unlockToggleBtnLocked}
                            onClick={() => void handleToggleSingleCourseUnlocked(selectedCourse)}
                            disabled={busy.has(`unlock-course:${selectedCourse.id}`) || Boolean(processingMessage)}
                            title="Click to toggle Unlocked / Passcode Protected"
                          >
                            {busy.has(`unlock-course:${selectedCourse.id}`) ? (
                              <span className={styles.btnLoadingRow}>
                                <span className={styles.btnSpinnerSm} />
                                <span>loading.....</span>
                              </span>
                            ) : Boolean(selectedCourse.unlocked ?? selectedCourse.metadata?.unlocked) ? (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                                <span>UNLOCKED (Free Access)</span>
                              </>
                            ) : (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <span>PASSCODE PROTECTED</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Language Selector Pill */}
                        <div className={styles.langSelector}>
                          {languageOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`${styles.langBtn} ${selectedCourse.language_label === opt.value ? styles.langActive : ""}`}
                              onClick={() => void setLanguage(opt.value)}
                              disabled={busy.has(`lang:${effectiveCourseId}`)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Main Course Info (Title & Description inline) */}
                      <div className={styles.commandHubTitleBox}>
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
                            <button
                              type="button"
                              onClick={() => {
                                setTitleValue(selectedCourse.title);
                                setEditingTitle(true);
                              }}
                              className={styles.inlineEditBtn}
                              title="Edit course title"
                            >
                              ✎ Edit Title
                            </button>
                          </div>
                        )}

                        {/* Inline Description */}
                        {editingDescription ? (
                          <div className={styles.descEditBox} style={{ marginTop: "4px" }}>
                            <input
                              type="text"
                              value={descriptionValue}
                              onChange={(e) => setDescriptionValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSaveDescription();
                                } else if (e.key === "Escape") {
                                  setDescriptionValue(selectedCourse.metadata?.summary || selectedCourse.description || "");
                                  setEditingDescription(false);
                                }
                              }}
                              placeholder="Course description (e.g. Gemini -> Google sheets -> GAS -> Web App)..."
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
                                setDescriptionValue(selectedCourse.metadata?.summary || selectedCourse.description || "");
                                setEditingDescription(false);
                              }}
                              className={styles.descCancelBtn}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={styles.descInlineRow}>
                            <p className={styles.workspaceDescText}>
                              {selectedCourse.metadata?.summary || selectedCourse.description || "Gemini -> Google sheets -> GAS -> Web App"}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setDescriptionValue(selectedCourse.metadata?.summary || selectedCourse.description || "");
                                setEditingDescription(true);
                              }}
                              className={styles.inlineDescEditBtn}
                              title="Edit course summary"
                            >
                              ✎ Edit Summary
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Passcode Quick Strip */}
                      <div className={styles.commandHubPasscodeStrip}>
                        <div className={styles.passcodeStripLeft}>
                          <span className={styles.passcodeStripLabel}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><circle cx="12" cy="16" r="1.5"/></svg>
                            PASSCODE:
                          </span>
                          {editingCoursePasscode ? (
                            <div className={styles.passcodeEditInline}>
                              <input
                                type="text"
                                value={customCoursePasscode}
                                onChange={(e) => setCustomCoursePasscode(e.target.value.slice(0, 10))}
                                placeholder="e.g. 1611"
                                className={styles.passcodeInputCompact}
                                autoFocus
                              />
                              <button
                                type="button"
                                className={styles.btnPasscodeSave}
                                onClick={() => void handleSaveCoursePasscode()}
                                disabled={busy.has(`set-pass:${effectiveCourseId}`)}
                              >
                                {busy.has(`set-pass:${effectiveCourseId}`) ? "..." : "Save"}
                              </button>
                              <button
                                type="button"
                                className={styles.btnPasscodeCancel}
                                onClick={() => {
                                  setEditingCoursePasscode(false);
                                  setCustomCoursePasscode("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className={styles.passcodePillDisplay}>
                              <span className={styles.passcodeNumberCompact}>
                                {selectedCourse.passcode || selectedCourse.metadata?.passcode || "1611"}
                              </span>
                              <span className={styles.passcodeStatusPill}>ACTIVE</span>
                            </div>
                          )}
                        </div>

                        {!editingCoursePasscode && (
                          <div className={styles.passcodeStripActions}>
                            <button
                              type="button"
                              className={styles.passcodeActionBtn}
                              onClick={() => {
                                const code = selectedCourse.passcode || selectedCourse.metadata?.passcode || "1611";
                                void navigator.clipboard.writeText(code);
                                setNotice(`Passcode ${code} copied to clipboard.`);
                              }}
                              title="Copy passcode to clipboard"
                            >
                              📋 Copy
                            </button>
                            <button
                              type="button"
                              className={styles.passcodeActionBtn}
                              onClick={() => {
                                setCustomCoursePasscode(selectedCourse.passcode || selectedCourse.metadata?.passcode || "1611");
                                setEditingCoursePasscode(true);
                              }}
                              title="Set custom passcode"
                            >
                              ✎ Edit Code
                            </button>
                            <button
                              type="button"
                              className={styles.passcodeActionBtnPrimary}
                              onClick={() => void handleGenerateCoursePasscode()}
                              disabled={busy.has(`gen-pass:${effectiveCourseId}`)}
                              title="Generate random 4-digit code"
                            >
                              {busy.has(`gen-pass:${effectiveCourseId}`) ? "Generating..." : "🎲 Generate New"}
                            </button>
                          </div>
                        )}
                      </div>
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
                              Manage, add, and remove curriculum sections for this course.
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className={styles.sectionUploadHelp}>
                        PDF / TSX / PPTX · Up to 50 MB. PPTX files stay unchanged; download and open in PowerPoint for audio, animations, and add-ins.
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
                      <SectionBatchUpload key={effectiveCourseId} sections={courseSections} coreCourse={selectedCourse.slug === "applied-agentic-ai"}
                        upload={(target, file, progress) => {
                          const section = courseSections.find((item) => item.id === target.id);
                          return section ? handleSectionContentUpload(section, file, progress) : Promise.resolve(false);
                        }} />
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
                                className={`${styles.sectionItemRow} ${isChecked ? styles.sectionItemRowSelected : ""} ${sectionDropTarget === section.id ? styles.sectionDropTarget : ""}`}
                                onDragOver={(event) => {
                                  if (!draggedSection.current || processingMessage) return;
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = "move";
                                  setSectionDropTarget(section.id);
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  const source = draggedSection.current;
                                  draggedSection.current = null;
                                  setSectionDropTarget(null);
                                  if (source) void handleReorderSection(source, section.id);
                                }}
                              >
                                <div className={styles.sectionItemLeft}>
                                  <button type="button" className={styles.sectionDragHandle}
                                    draggable={!processingMessage && !busy.has("reorder-sections")}
                                    disabled={Boolean(processingMessage) || busy.has("reorder-sections")}
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
                                  >⠿</button>
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
                                      <form onSubmit={(event) => void handleRenameSection(event, section)} className={styles.addSectionForm}>
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
                                        ? `${isDefault ? "Built-in deck + PPTX attachment" : section.content_type.toUpperCase()} · ${section.source_filename}`
                                        : isDefault
                                          ? "Built-in interactive deck"
                                          : "No presentation file"}
                                    </span>
                                  </DraggableScrollArea>
                                </div>
                                <div className={styles.sectionItemRight}>
                                  {section.source_filename && (
                                    <a
                                      className={styles.sectionUploadButton}
                                      href={`/api/sections/${encodeURIComponent(section.id)}/content?download=1`}
                                      download={section.source_filename}
                                      title="Download the uploaded file"
                                    >
                                      Download
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    className={styles.addSectionButton}
                                    onClick={() => {
                                      setEditingSectionId(section.id);
                                      setSectionTitleValue(section.title);
                                    }}
                                    disabled={Boolean(processingMessage) || editingSectionId === section.id}
                                  >
                                    Rename
                                  </button>
                                  {!isDefault && (
                                    <button
                                      type="button"
                                      className={styles.removeBtn}
                                      onClick={() => void handleDeleteSection(section)}
                                      disabled={busy.has(`sec:${section.id}`)}
                                      title={`Delete section “${section.title}”`}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add Section Form */}
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
                    </div>

                    {/* 2. SYSTEM & TECH ICONS BLOCK (Khung icon chỉ chiếm phần màu đen) */}
                      <div className={styles.systemIconsBlock}>
                        <div className={styles.systemIconsHeader}>
                          <div className={styles.systemIconsTitleArea}>
                            <div className={styles.badgeIndex}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                <line x1="6" y1="6" x2="6.01" y2="6"/>
                                <line x1="6" y1="18" x2="6.01" y2="18"/>
                              </svg>
                            </div>
                            <div>
                              <h3>Tech Stack Icons ({(selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || []).length})</h3>
                              <p>Paste with Ctrl+V or upload</p>
                            </div>
                          </div>

                          <div className={styles.systemIconsHeaderActions}>
                            <label className={styles.iconUploadBtn} title="Upload icon image">
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(e) => void handleFileUpload(e)}
                                disabled={!!iconProcessing}
                                style={{ display: "none" }}
                              />
                              <span>📁 Upload</span>
                            </label>
                          </div>
                        </div>

                        {/* Paste / Drop Zone */}
                        <div
                          className={`${styles.iconPasteZone} ${iconDragActive ? styles.iconPasteZoneDragActive : ""} ${iconProcessing ? styles.iconPasteZoneBusy : ""}`}
                          tabIndex={0}
                          onPaste={(e) => void handlePasteImage(e)}
                          onDragOver={handleIconDragOver}
                          onDragEnter={handleIconDragOver}
                          onDragLeave={handleIconDragLeave}
                          onDrop={(e) => void handleIconDrop(e)}
                          aria-busy={!!iconProcessing}
                          title="Click here and press Ctrl+V, or drop an image file"
                        >
                          {iconProcessing ? (
                            <div className={styles.pasteZoneContent} role="status" aria-live="polite">
                              <span className={styles.iconLoadingSpinner} aria-hidden="true" />
                              <span className={styles.pasteZoneText}>
                                {iconProcessing.stage}
                                <span className={styles.iconLoadingDots} aria-hidden="true">
                                  <i />
                                  <i />
                                  <i />
                                </span>
                              </span>
                            </div>
                          ) : iconDragActive ? (
                            <div className={styles.pasteZoneContent}>
                              <span className={styles.pasteShortcut}>⬇</span>
                              <span className={styles.pasteZoneText}>Thả ảnh vào đây</span>
                            </div>
                          ) : (
                            <div className={styles.pasteZoneContent}>
                              <span className={styles.pasteShortcut}>Ctrl + V</span>
                              <span className={styles.pasteZoneText}>
                                Click &amp; <strong>Ctrl+V</strong> hoặc kéo thả ảnh icon
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Pending (processing) icon placeholder */}
                        {iconProcessing && (
                          <div className={`${styles.systemIconItem} ${styles.systemIconItemLoading}`}>
                            <div className={styles.systemIconPreviewWrap}>
                              {iconProcessing.previewUrl ? (
                                <img
                                  src={iconProcessing.previewUrl}
                                  alt="Processing icon"
                                  className={styles.systemIconAdminImg}
                                />
                              ) : (
                                <span className={styles.iconLoadingSpinnerSmall} aria-hidden="true" />
                              )}
                            </div>
                            <span className={styles.iconSkeletonBar} />
                          </div>
                        )}

                        {/* Current Icons List */}
                        {((selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || []).length > 0) ? (
                          <div className={styles.systemIconsGrid}>
                            {(selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || []).map((icon) => (
                              <div key={icon.id} className={styles.systemIconItem}>
                                <div className={styles.systemIconPreviewWrap}>
                                  <img
                                    src={icon.url}
                                    alt={icon.name || "Icon"}
                                    className={styles.systemIconAdminImg}
                                  />
                                </div>
                                <input
                                  type="text"
                                  className={styles.systemIconNameInput}
                                  value={icon.name && icon.name.toLowerCase() !== "system" ? icon.name : ""}
                                  onChange={(e) => handleRenameIcon(icon.id, e.target.value)}
                                  onBlur={() => void saveSystemIcons(selectedCourse.systemIcons || selectedCourse.metadata?.systemIcons || [])}
                                  placeholder="Label (optional)"
                                  title="Click to rename or leave empty"
                                />
                                <button
                                  type="button"
                                  className={styles.systemIconDeleteBtn}
                                  onClick={() => void handleRemoveIcon(icon.id)}
                                  title="Delete icon"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : !iconProcessing ? (
                          <div className={styles.noIconsNotice}>
                            No icons added yet. Press <strong>Ctrl+V</strong> or click <strong>Upload</strong>.
                          </div>
                        ) : null}
                      </div>
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
      {dialog.isOpen && (
        <div className={styles.eiuModalBackdrop} role="dialog" aria-modal="true" onClick={closeDialog}>
          <div className={styles.eiuModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.eiuModalHeader}>
              <div className={styles.eiuModalBadgeRow}>
                <span className={styles.eiuModalBrandTag}>EIU SYSTEM GOVERNANCE</span>
                <span className={dialog.variant === "danger" ? styles.eiuModalBadgeDanger : styles.eiuModalBadgeGold}>
                  {dialog.variant === "danger" ? "DANGER ZONE" : "NOTICE"}
                </span>
              </div>
              <div className={styles.eiuModalTitleRow}>
                <div className={dialog.variant === "danger" ? styles.eiuModalIconDanger : styles.eiuModalIconGold}>
                  {dialog.variant === "danger" ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  )}
                </div>
                <h3>{dialog.title}</h3>
              </div>
            </div>

            <div className={styles.eiuModalBody}>
              <p className={styles.eiuModalMessage}>{dialog.message}</p>
              {dialog.detail && (
                <div className={styles.eiuModalDetailBox}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{dialog.detail}</span>
                </div>
              )}
            </div>

            <div className={styles.eiuModalFooter}>
              {!dialog.isAlert && (
                <button
                  type="button"
                  className={styles.eiuModalBtnCancel}
                  onClick={closeDialog}
                >
                  {dialog.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                type="button"
                className={dialog.variant === "danger" ? styles.eiuModalBtnDanger : styles.eiuModalBtnConfirm}
                onClick={async () => {
                  const onConfirmFn = dialog.onConfirm;
                  closeDialog();
                  if (onConfirmFn) {
                    await onConfirmFn();
                  }
                }}
                autoFocus
              >
                {dialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
