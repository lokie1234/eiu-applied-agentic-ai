"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminAccessPortal.module.css";

type LanguageLabel = "vi" | "en" | "vi_en";

type CourseMetadata = {
  summary: string;
  allowedEmails: string[];
  passcode?: string;
  sectionPasscodes?: Record<string, string>;
  unlocked?: boolean;
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
};

type Payload = {
  success: boolean;
  message?: string;
  courses?: Course[];
  sections?: Section[];
  authorizedEmails?: string[];
  generatedCode?: string;
};

const languageOptions: Array<{ value: LanguageLabel; label: string }> = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
  { value: "vi_en", label: "Vietnamese & English" },
];

const FIXED_ADMIN_EMAIL = "son.lam@eiu.edu.vn";

export default function AdminAccessPortal({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<"emails" | "courses">("emails");
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>([]);
  const [courseId, setCourseId] = useState("");

  // Email management state
  const [bulkEmailText, setBulkEmailText] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Multi-course selection state for unlock/lock
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  // Course settings state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingCoursePasscode, setEditingCoursePasscode] = useState(false);
  const [customCoursePasscode, setCustomCoursePasscode] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");

  // New course state
  const [showNewCourseBox, setShowNewCourseBox] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const apply = useCallback((payload: Payload) => {
    if (payload.courses) setCourses(payload.courses);
    if (payload.sections) setSections(payload.sections);
    if (payload.authorizedEmails) setAuthorizedEmails(payload.authorizedEmails);
  }, []);

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

  const activeCourses = useMemo(() => courses.filter((c) => c.status === "active"), [courses]);
  const effectiveCourseId = activeCourses.some((c) => c.id === courseId) ? courseId : activeCourses[0]?.id ?? "";
  const selectedCourse = activeCourses.find((c) => c.id === effectiveCourseId) ?? null;
  const courseSections = useMemo(
    () => sections.filter((s) => s.course_id === effectiveCourseId && s.status === "active").sort((a, b) => a.position - b.position),
    [sections, effectiveCourseId]
  );

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
      "Đang cập nhật tên khóa học......"
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
      "Đang thêm email học viên vào hệ thống......"
    );
    if (ok) setBulkEmailText("");
  }

  async function handleBulkReplaceEmails() {
    if (!bulkEmailText.trim()) return;
    if (!confirm("This will replace all authorized learner emails on the platform. Are you sure?")) {
      return;
    }
    const ok = await mutate(
      {
        action: "grant_emails_bulk",
        rawEmails: bulkEmailText,
        mode: "replace",
      },
      "bulk-replace-emails",
      "Replaced platform authorized emails list.",
      "Đang thay thế toàn bộ danh sách email học viên......"
    );
    if (ok) {
      setBulkEmailText("");
      setSelectedEmails(new Set());
    }
  }

  async function handleDeleteSelectedEmails() {
    if (selectedEmails.size === 0) return;
    if (!confirm(`Are you sure you want to remove access for ${selectedEmails.size} selected email(s)?`)) {
      return;
    }
    const emailsToDelete = Array.from(selectedEmails);
    const ok = await mutate(
      {
        action: "remove_emails",
        emails: emailsToDelete,
      },
      "delete-selected-emails",
      `Removed ${emailsToDelete.length} email(s) from platform access.`,
      `Đang xóa ${emailsToDelete.length} email đã chọn khỏi hệ thống......`
    );
    if (ok) {
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        for (const e of emailsToDelete) next.delete(e);
        return next;
      });
    }
  }

  async function handleRemoveSingleEmail(email: string) {
    if (email.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase()) {
      alert("The fixed administrator email cannot be removed.");
      return;
    }
    if (!confirm(`Revoke platform access for ${email}?`)) return;
    const ok = await mutate(
      {
        action: "remove_emails",
        emails: [email],
      },
      `remove-email:${email}`,
      `Revoked access for ${email}.`,
      `Đang thu hồi quyền truy cập của ${email}......`
    );
    if (ok) {
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        next.delete(email);
        return next;
      });
    }
  }

  async function handleClearAllEmails() {
    if (!confirm("Are you sure you want to revoke access for ALL learner emails? The fixed admin account will remain active.")) {
      return;
    }
    const ok = await mutate(
      { action: "clear_emails" },
      "clear-all-emails",
      "Cleared all learner emails from platform access.",
      "Đang thu hồi quyền toàn bộ email học viên......"
    );
    if (ok) setSelectedEmails(new Set());
  }

  // =========================================================================
  // COURSE SETUP & PASSCODE BYPASS HANDLERS
  // =========================================================================

  async function handleSetAllCoursesUnlocked(unlocked: boolean) {
    const label = unlocked ? "unlock all courses" : "lock all courses (require passcode)";
    if (!confirm(`Are you sure you want to ${label}?`)) return;
    await mutate(
      { action: "set_all_courses_unlocked", unlocked },
      "unlock-all",
      unlocked ? "All courses are now UNLOCKED (no passcode required)." : "All courses are now LOCKED (passcode required).",
      unlocked ? "Đang mở khóa toàn bộ khóa học......" : "Đang khóa lại toàn bộ khóa học......"
    );
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
        ? `Đang mở khóa ${courseIds.length} khóa học đã chọn......`
        : `Đang khóa ${courseIds.length} khóa học đã chọn......`
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
      nextUnlocked ? `Đang mở khóa “${course.title}”......` : `Đang khóa “${course.title}”......`
    );
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

  async function handleSaveDescription() {
    if (!effectiveCourseId) return;
    const ok = await mutate(
      { action: "update_course_description", courseId: effectiveCourseId, summary: descriptionValue },
      `desc:${effectiveCourseId}`,
      "Folder description updated.",
      "Đang cập nhật mô tả khóa học......"
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
  // MERGED COURSE SECTIONS HANDLERS (Thêm & Xóa Section gộp vào)
  // =========================================================================

  async function handleAddSection(e: FormEvent) {
    e.preventDefault();
    const title = newSectionTitle.trim();
    if (!title || !effectiveCourseId) return;
    const ok = await mutate(
      { action: "create_section", courseId: effectiveCourseId, title },
      `add-sec:${effectiveCourseId}`,
      `Added section “${title}” to ${selectedCourse?.title}.`
    );
    if (ok) setNewSectionTitle("");
  }

  async function handleDeleteSection(section: Section) {
    if (["section1", "section2"].includes(section.section_key)) {
      alert("The default Section 1 and Section 2 cannot be deleted.");
      return;
    }
    if (!confirm(`Delete section “${section.title}”?`)) return;
    await mutate(
      { action: "delete_section", sectionId: section.id },
      `sec:${section.id}`,
      `Deleted section “${section.title}”.`
    );
  }

  async function handleCreateCourse(e: FormEvent) {
    e.preventDefault();
    const title = newCourseTitle.trim();
    if (!title) return;
    const ok = await mutate(
      { action: "create_course", title },
      "create-course",
      `Created course “${title}”.`
    );
    if (ok) {
      setNewCourseTitle("");
      setShowNewCourseBox(false);
    }
  }

  async function handleDeleteCourse(course: Course) {
    if (course.slug === "applied-agentic-ai") {
      alert("The core course cannot be deleted.");
      return;
    }
    if (!confirm(`Delete course “${course.title}” and all its sections?`)) return;
    await mutate(
      { action: "delete_course", courseId: course.id },
      `course:${course.id}`,
      `Deleted course “${course.title}”.`
    );
  }

  async function signOut() {
    await fetch("/api/signout", { method: "POST" });
    window.location.replace("/");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <span>EIU · LEARNING PLATFORM ADMINISTRATION</span>
          <h1>Admin Control Center</h1>
          <p>
            Admin: <b>{adminEmail}</b> · Centralized Learner Access &amp; Course Management
          </p>
        </div>
        <nav className={styles.headerNav}>
          <Link href="/learn">Learning Space</Link>
          <Link href="/admin/ai">✦ AI Knowledge</Link>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </nav>
      </header>

      {/* EIU Luxury Segmented Tabs Navigation */}
      <div className={styles.tabsNavWrapper}>
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
        </div>
      </div>

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
              Hệ thống đang đồng bộ dữ liệu vào cơ sở dữ liệu Supabase, vui lòng đợi trong giây lát...
            </span>
          </div>
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && !processingMessage && <div className={styles.notice} role="status">{notice}</div>}

      <div className={styles.scrollArea}>
        {loading ? (
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
                      <span>Đang thêm email......</span>
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
                      <span>Đang thay thế......</span>
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
                        <span>Đang xóa {selectedEmails.size} email......</span>
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
                          <span>Đang xóa tất cả......</span>
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
                    <span>Hệ thống đang đồng bộ danh sách email học viên......</span>
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
                                  <span>Đang xóa......</span>
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
             FRAME 2: COURSE SETUP & STRUCTURE FRAME (Gộp Section + Special Unlock All Courses)
             ========================================================================= */
          <div>
            {/* SPECIAL FUNCTION BANNER: UNLOCK ALL COURSES / PASSCODE BYPASS */}
            <div className={styles.unlockBanner}>
              <div className={styles.unlockBannerHead}>
                <div className={styles.unlockBannerTitle}>
                  <span>EIU PLATFORM ACCESS CONTROL</span>
                  <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                    Course Passcode Bypass (Unlock Courses)
                  </h3>
                  <p>
                    When unlocked, logged-in learners can access and study courses directly without entering individual course passcodes.
                  </p>
                </div>
                <div className={styles.unlockMasterButtons}>
                  <button
                    type="button"
                    className={styles.btnUnlockAll}
                    onClick={() => void handleSetAllCoursesUnlocked(true)}
                    disabled={busy.has("unlock-all")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                    Unlock All Courses
                  </button>
                  <button
                    type="button"
                    className={styles.btnLockAll}
                    onClick={() => void handleSetAllCoursesUnlocked(false)}
                    disabled={busy.has("unlock-all")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Lock All Courses
                  </button>
                </div>
              </div>

              {/* Selective Multi-Unlock Controls */}
              <div className={styles.unlockSelectiveRow}>
                <div className={styles.unlockSelectiveLeft}>
                  <label className={styles.unlockSelectAllLabel}>
                    <input
                      type="checkbox"
                      checked={selectedCourses.size > 0 && selectedCourses.size === activeCourses.length}
                      onChange={handleSelectAllCoursesToggle}
                      className={styles.unlockCheckbox}
                    />
                    <span>Select All Courses ({selectedCourses.size}/{activeCourses.length})</span>
                  </label>
                  <span className={styles.unlockSelectiveDivider}>•</span>
                  <span className={styles.unlockSelectiveLabel}>
                    Tick courses in sidebar to toggle passcode requirement
                  </span>
                </div>

                <div className={styles.selectiveActionBtns}>
                  <button
                    type="button"
                    className={`${styles.btnSelectiveAction} ${styles.btnSelectiveUnlock}`}
                    onClick={() => void handleSetSelectedCoursesUnlocked(true)}
                    disabled={selectedCourses.size === 0 || busy.has("unlock-selected")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                    <span>Unlock Selected ({selectedCourses.size})</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnSelectiveAction} ${styles.btnSelectiveLock}`}
                    onClick={() => void handleSetSelectedCoursesUnlocked(false)}
                    disabled={selectedCourses.size === 0 || busy.has("unlock-selected")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Lock Selected ({selectedCourses.size})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Course Workspace Layout */}
            <div className={styles.passcodeLayout}>
              {/* Sidebar list of courses */}
              <aside className={styles.courseList}>
                <span className={styles.courseListHeading}>COURSE FOLDERS</span>
                {activeCourses.map((course) => {
                  const countSecs = sections.filter((s) => s.course_id === course.id && s.status === "active").length;
                  const isSelected = effectiveCourseId === course.id;
                  const isChecked = selectedCourses.has(course.id);
                  const isUnlocked = Boolean(course.unlocked ?? course.metadata?.unlocked);

                  return (
                    <div
                      key={course.id}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCourseSelection(course.id)}
                        className={styles.emailRowCheckbox}
                        title={`Select ${course.title} for batch unlock/lock`}
                      />
                      <button
                        type="button"
                        className={`${styles.courseItem} ${isSelected ? styles.selectedCourse : ""}`}
                        style={{ flex: 1 }}
                        onClick={() => setCourseId(course.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                          <span className={styles.courseItemTitle}>{course.title}</span>
                          <span className={isUnlocked ? styles.pillUnlocked : styles.pillLocked}>
                            {isUnlocked ? "UNLOCKED" : "PASSCODE"}
                          </span>
                        </div>
                        <span className={styles.courseItemMeta}>
                          <span>{countSecs} sections</span>
                          <span>•</span>
                          <span>{course.language_label.toUpperCase()}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}

                {/* Add New Course Button / Inline Form */}
                {showNewCourseBox ? (
                  <form onSubmit={handleCreateCourse} className={styles.newCourseInlineBox}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#082945" }}>NEW COURSE FOLDER</span>
                    <input
                      type="text"
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      placeholder="e.g. Next.js Fullstack Masterclass"
                      required
                      autoFocus
                      style={{
                        height: "36px",
                        padding: "0 10px",
                        border: "1px solid #d4dce3",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="submit"
                        className={styles.btnPrimary}
                        style={{ padding: "6px 12px", fontSize: "11px", borderRadius: "6px" }}
                        disabled={busy.has("create-course") || !newCourseTitle.trim()}
                      >
                        Create
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
                    + Create New Course Folder
                  </button>
                )}
              </aside>

              {/* Main Workspace for Selected Course */}
              <section className={styles.workspace}>
                {selectedCourse ? (
                  <>
                    <div className={styles.workspaceHead}>
                      <div className={styles.workspaceHeadTitle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span>FOLDER SETUP &amp; STRUCTURE</span>
                          <span className={Boolean(selectedCourse.unlocked ?? selectedCourse.metadata?.unlocked) ? styles.pillUnlocked : styles.pillLocked}>
                            {Boolean(selectedCourse.unlocked ?? selectedCourse.metadata?.unlocked) ? "UNLOCKED (FREE ACCESS)" : "PASSCODE PROTECTED"}
                          </span>
                        </div>
                        {/* Editable Course Title */}
                        <div className={styles.courseTitleRow}>
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
                                {busy.has(`title:${effectiveCourseId}`) ? "Saving…" : "Save"}
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
                                className={styles.titleEditBtn}
                                title="Edit course name"
                              >
                                ✎ Edit Name
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Folder Description Row */}
                        <div className={styles.workspaceDescriptionRow}>
                          <div className={styles.descHeaderRow}>
                            <span className={styles.descCardLabel}>FOLDER DESCRIPTION / SUMMARY</span>
                            {!editingDescription && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDescriptionValue(selectedCourse.metadata?.summary || selectedCourse.description || "");
                                  setEditingDescription(true);
                                }}
                                className={styles.descEditBtn}
                                title="Edit folder description"
                              >
                                ✎ Edit Description
                              </button>
                            )}
                          </div>
                          {editingDescription ? (
                            <div className={styles.descEditBox}>
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
                                placeholder="Folder description (e.g. Gemini -> Google sheets -> GAS -> Web App)"
                                className={styles.descInput}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveDescription()}
                                disabled={busy.has(`desc:${effectiveCourseId}`)}
                                className={styles.descSaveBtn}
                              >
                                {busy.has(`desc:${effectiveCourseId}`) ? "Saving…" : "Save"}
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
                            <div className={styles.descDisplayBox}>
                              <p className={styles.workspaceDescText}>
                                {selectedCourse.metadata?.summary || selectedCourse.description || "Gemini -> Google sheets -> GAS -> Web App"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Header Actions / Meta */}
                      <div className={styles.workspaceMetaBar}>
                        {/* Instant Unlock Toggle */}
                        <button
                          type="button"
                          className={Boolean(selectedCourse.unlocked ?? selectedCourse.metadata?.unlocked) ? styles.unlockToggleBtnUnlocked : styles.unlockToggleBtnLocked}
                          onClick={() => void handleToggleSingleCourseUnlocked(selectedCourse)}
                          disabled={busy.has(`unlock-course:${selectedCourse.id}`)}
                          title="Toggle passcode bypass for this course"
                        >
                          {Boolean(selectedCourse.unlocked ?? selectedCourse.metadata?.unlocked) ? (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                              <span>Unlocked · Click to Require Passcode</span>
                            </>
                          ) : (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                              <span>Protected · Click to Unlock</span>
                            </>
                          )}
                        </button>

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

                        {selectedCourse.slug !== "applied-agentic-ai" && (
                          <button
                            type="button"
                            className={styles.btnDanger}
                            style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "750" }}
                            onClick={() => void handleDeleteCourse(selectedCourse)}
                            disabled={busy.has(`course:${selectedCourse.id}`)}
                          >
                            Delete Course
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 1. Folder Passcode Block */}
                    <div className={styles.sectionBlock}>
                      <div className={styles.sectionBlockHeader}>
                        <div className={styles.badgeIndex}>01</div>
                        <div>
                          <h3>Course Folder Passcode</h3>
                          <p>
                            The access code required to open this course when locked. (If unlocked via the function above, learners bypass this).
                          </p>
                        </div>
                      </div>

                      <div className={styles.folderPasscodeCard}>
                        <div className={styles.passcodeMainInfo}>
                          <span className={styles.passcodeCardLabel}>ACTIVE PASSCODE</span>
                          {editingCoursePasscode ? (
                            <div className={styles.passcodeEditRow}>
                              <input
                                type="text"
                                value={customCoursePasscode}
                                onChange={(e) => setCustomCoursePasscode(e.target.value.slice(0, 10))}
                                placeholder="e.g. 1611"
                                className={styles.passcodeInput}
                                autoFocus
                              />
                              <button
                                type="button"
                                className={styles.btnPrimary}
                                onClick={() => void handleSaveCoursePasscode()}
                                disabled={busy.has(`set-pass:${effectiveCourseId}`)}
                                style={{ padding: "0 14px", height: "42px", borderRadius: "8px", fontSize: "12px" }}
                              >
                                {busy.has(`set-pass:${effectiveCourseId}`) ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={() => {
                                  setEditingCoursePasscode(false);
                                  setCustomCoursePasscode("");
                                }}
                                style={{ padding: "0 12px", height: "42px", borderRadius: "8px", fontSize: "12px" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className={styles.passcodeDisplayRow}>
                              <span className={styles.passcodeNumber}>
                                {selectedCourse.passcode || selectedCourse.metadata?.passcode || "1611"}
                              </span>
                              <span className={styles.passcodeStatusBadge}>ACTIVE</span>
                            </div>
                          )}
                        </div>

                        {!editingCoursePasscode && (
                          <div className={styles.folderPasscodeActions}>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              onClick={() => {
                                const code = selectedCourse.passcode || selectedCourse.metadata?.passcode || "1611";
                                void navigator.clipboard.writeText(code);
                                setNotice(`Passcode ${code} copied to clipboard.`);
                              }}
                            >
                              📋 Copy Code
                            </button>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              onClick={() => {
                                setCustomCoursePasscode(selectedCourse.passcode || selectedCourse.metadata?.passcode || "1611");
                                setEditingCoursePasscode(true);
                              }}
                            >
                              ✎ Edit Passcode
                            </button>
                            <button
                              type="button"
                              className={styles.btnPrimary}
                              onClick={() => void handleGenerateCoursePasscode()}
                              disabled={busy.has(`gen-pass:${effectiveCourseId}`)}
                            >
                              {busy.has(`gen-pass:${effectiveCourseId}`) ? "Generating…" : "🎲 Generate New Code"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. MERGED SECTIONS MANAGEMENT (Gộp phần thêm/xóa section vào) */}
                    <div className={styles.mergedSectionsBlock}>
                      <div className={styles.mergedSectionsHeader}>
                        <div className={styles.mergedSectionsTitle}>
                          <div className={styles.badgeIndex}>02</div>
                          <div>
                            <h3>Course Sections &amp; Structure ({courseSections.length})</h3>
                            <p>
                              Add, delete, and view learning sections directly inside this course folder.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section List */}
                      <div className={styles.sectionItemsContainer}>
                        {courseSections.length === 0 ? (
                          <div className={styles.noEmailMessage}>
                            No sections created in this course folder yet.
                          </div>
                        ) : (
                          courseSections.map((section) => {
                            const isDefault = ["section1", "section2"].includes(section.section_key);
                            return (
                              <div key={section.id} className={styles.sectionItemRow}>
                                <span className={styles.sectionItemPosition}>
                                  {section.position.toString().padStart(2, "0")}
                                </span>
                                <span className={styles.sectionItemTitle}>{section.title}</span>
                                {!isDefault ? (
                                  <button
                                    type="button"
                                    className={styles.removeBtn}
                                    onClick={() => void handleDeleteSection(section)}
                                    disabled={busy.has(`sec:${section.id}`)}
                                    title={`Delete section “${section.title}”`}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <span className={styles.defaultTag}>DEFAULT</span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add Section Form */}
                      <form onSubmit={handleAddSection} className={styles.addSectionForm}>
                        <input
                          type="text"
                          value={newSectionTitle}
                          onChange={(e) => setNewSectionTitle(e.target.value)}
                          placeholder="New section title (e.g. Module 3: Advanced Function Calling)…"
                          className={styles.addSectionInput}
                          required
                        />
                        <button
                          type="submit"
                          className={styles.addSectionButton}
                          disabled={busy.has(`add-sec:${effectiveCourseId}`) || !newSectionTitle.trim()}
                        >
                          {busy.has(`add-sec:${effectiveCourseId}`) ? "Adding…" : "+ Add Section"}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className={styles.noEmailMessage}>No course selected.</div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
