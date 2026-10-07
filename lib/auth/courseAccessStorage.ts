import "server-only";

import { createHash, randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FIXED_ADMIN_EMAIL, isValidEmail, normalizeEmail, APPLIED_AGENTIC_AI_SLUG, type CourseSystemIcon } from "@/lib/auth/types";
export type { CourseSystemIcon };

export type CourseFolderGroup = {
  id: string;
  name: string;
  description?: string;
  order: number;
};

const DEFAULT_FOLDER_GROUPS: CourseFolderGroup[] = [
  {
    id: "fg-ai-agentic",
    name: "Chương Trình AI & Agentic",
    description: "Các khóa học chuyên sâu về AI & Agentic Automation",
    order: 1,
  },
];

export type CourseMetadata = {
  summary: string;
  allowedEmails: string[];
  passcode: string; // 1 passcode for the whole course folder
  sectionPasscodes?: Record<string, string>; // retained for backward compatibility
  unlocked?: boolean; // When true, course can be accessed without a passcode
  unlockedEmails?: string[]; // Fallback list of emails that unlocked this course
  folderGroupId?: string; // ID of the parent folder (Folder lớn)
  folderGroupName?: string; // Display name of parent folder
  folderOrder?: number; // Position inside the parent folder
  folderGroups?: CourseFolderGroup[]; // Master list of parent folders (stored in core course or any course)
  systemIcons?: CourseSystemIcon[];
};

export type CourseWithDetails = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  language_label: "vi" | "en" | "vi_en";
  status: "draft" | "active" | "archived";
  passcode: string; // Course folder passcode
  unlocked: boolean; // When true, course can be accessed without a passcode
  folderGroupId: string;
  folderGroupName: string;
  folderOrder: number;
  systemIcons?: CourseSystemIcon[];
  metadata: CourseMetadata;
};

type SectionWithPasscode = {
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

export function parseCourseMetadata(raw: string | null | undefined, defaultSummary = ""): CourseMetadata {
  if (!raw) {
    return {
      summary: defaultSummary,
      allowedEmails: [FIXED_ADMIN_EMAIL],
      passcode: "1611",
      sectionPasscodes: {},
      unlocked: false,
      unlockedEmails: [],
      folderGroupId: "fg-ai-agentic",
      folderGroupName: "Chương Trình AI & Agentic",
      folderOrder: 1,
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const summary = typeof (parsed as { summary?: unknown }).summary === "string"
        ? String((parsed as { summary: string }).summary)
        : defaultSummary;
      const rawArr = Array.isArray((parsed as { allowedEmails?: unknown }).allowedEmails)
        ? (parsed as { allowedEmails: unknown[] }).allowedEmails
        : [];
      const emails: string[] = rawArr
        .map((e: unknown) => normalizeEmail(e))
        .filter(isValidEmail);
      if (!emails.includes(FIXED_ADMIN_EMAIL)) {
        emails.unshift(FIXED_ADMIN_EMAIL);
      }
      const rawCodes = (parsed as { sectionPasscodes?: unknown }).sectionPasscodes;
      const sectionPasscodes: Record<string, string> = rawCodes && typeof rawCodes === "object"
        ? Object.fromEntries(
            Object.entries(rawCodes as Record<string, unknown>)
              .map(([k, v]) => [String(k), String(v)])
          )
        : {};

      let passcode = typeof (parsed as { passcode?: unknown }).passcode === "string"
        ? String((parsed as { passcode: string }).passcode).trim()
        : "";
      if (!passcode) {
        passcode = sectionPasscodes.section1 || Object.values(sectionPasscodes)[0] || "1611";
      }

      const unlocked = Boolean((parsed as { unlocked?: unknown }).unlocked);
      const rawUnlocked = (parsed as { unlockedEmails?: unknown }).unlockedEmails;
      const unlockedEmails: string[] = Array.isArray(rawUnlocked)
        ? (rawUnlocked as unknown[])
            .map((e: unknown) => normalizeEmail(e))
            .filter(isValidEmail)
        : [];

      const folderGroupId = typeof (parsed as { folderGroupId?: unknown }).folderGroupId === "string"
        ? String((parsed as { folderGroupId: string }).folderGroupId).trim()
        : undefined;
      const folderGroupName = typeof (parsed as { folderGroupName?: unknown }).folderGroupName === "string"
        ? String((parsed as { folderGroupName: string }).folderGroupName).trim()
        : undefined;
      const folderOrder = typeof (parsed as { folderOrder?: unknown }).folderOrder === "number"
        ? Number((parsed as { folderOrder: number }).folderOrder)
        : undefined;

      const rawGroups = (parsed as { folderGroups?: unknown }).folderGroups;
      const folderGroups: CourseFolderGroup[] = Array.isArray(rawGroups)
        ? (rawGroups as CourseFolderGroup[]).filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
        : [];

      const rawIcons = (parsed as { systemIcons?: unknown }).systemIcons;
      const systemIcons: CourseSystemIcon[] = Array.isArray(rawIcons)
        ? (rawIcons as unknown[])
            .filter((item): item is { id: string; name: string; url: string } =>
              Boolean(item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string")
            )
            .map((item) => ({
              id: String(item.id || Math.random().toString(36).slice(2)),
              name: String(item.name || "").trim(),
              url: String(item.url),
            }))
        : [];

      return {
        summary,
        allowedEmails: Array.from(new Set(emails)),
        passcode,
        sectionPasscodes,
        unlocked,
        unlockedEmails: Array.from(new Set(unlockedEmails)),
        folderGroupId,
        folderGroupName,
        folderOrder,
        folderGroups: folderGroups.length > 0 ? folderGroups : undefined,
        systemIcons,
      };
    }
  } catch {
    // raw was plain text string
  }
  return {
    summary: raw?.trim() || defaultSummary,
    allowedEmails: [FIXED_ADMIN_EMAIL],
    passcode: "1611",
    sectionPasscodes: {},
    unlocked: false,
    unlockedEmails: [],
    folderGroupId: "fg-ai-agentic",
    folderGroupName: "Chương Trình AI & Agentic",
    folderOrder: 1,
    systemIcons: [],
  };
}

export function serializeCourseMetadata(metadata: CourseMetadata): string {
  const emails = [...new Set(metadata.allowedEmails.map(normalizeEmail).filter(isValidEmail))];
  if (!emails.includes(FIXED_ADMIN_EMAIL)) {
    emails.unshift(FIXED_ADMIN_EMAIL);
  }
  return JSON.stringify({
    summary: metadata.summary || "",
    allowedEmails: emails,
    passcode: metadata.passcode || "1611",
    sectionPasscodes: metadata.sectionPasscodes || {},
    unlocked: Boolean(metadata.unlocked),
    ...(metadata.unlockedEmails && metadata.unlockedEmails.length > 0 ? { unlockedEmails: metadata.unlockedEmails } : {}),
    folderGroupId: metadata.folderGroupId || "",
    folderGroupName: metadata.folderGroupName || "",
    folderOrder: typeof metadata.folderOrder === "number" ? metadata.folderOrder : 0,
    ...(metadata.folderGroups && metadata.folderGroups.length > 0 ? { folderGroups: metadata.folderGroups } : {}),
    ...(metadata.systemIcons && metadata.systemIcons.length > 0 ? { systemIcons: metadata.systemIcons } : {}),
  });
}

/**
 * Load all courses with parsed metadata, parent folders, and their section passcodes.
 */
export async function getCoursesAndSectionsData() {
  const supabase = getSupabaseAdmin();
  const [coursesResult, sectionsResult, passcodesResult] = await Promise.all([
    supabase.from("courses").select("id, slug, title, description, status, language_label").neq("status", "archived").order("title"),
    supabase.from("course_sections").select("id, course_id, section_key, title, position, status, content_type, content_path, source_filename, slide_count").neq("status", "archived").order("position"),
    supabase.from("course_passcodes").select("id, course_id, code_hint, status").eq("status", "active"),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (sectionsResult.error) throw sectionsResult.error;

  const legacyPasscodeMap = new Map<string, string>();
  for (const item of passcodesResult.data ?? []) {
    if (item.course_id && item.code_hint) {
      legacyPasscodeMap.set(String(item.course_id), String(item.code_hint));
    }
  }

  // 1. Authoritative master folder groups (defined primarily in the core course)
  const coreCourse = (coursesResult.data ?? []).find((c) => c.slug === APPLIED_AGENTIC_AI_SLUG);
  const coreMeta = coreCourse ? parseCourseMetadata(coreCourse.description, coreCourse.title) : null;
  const masterGroups = coreMeta?.folderGroups && coreMeta.folderGroups.length > 0
    ? coreMeta.folderGroups
    : DEFAULT_FOLDER_GROUPS;

  const folderGroupMap = new Map<string, CourseFolderGroup>();
  for (const g of masterGroups) {
    if (g && g.id && g.name) {
      folderGroupMap.set(g.id, { ...g });
    }
  }

  const folderGroups = Array.from(folderGroupMap.values()).sort((a, b) => a.order - b.order);

  const courses: CourseWithDetails[] = (coursesResult.data ?? []).map((course) => {
    const metadata = parseCourseMetadata(course.description, course.description || "");
    let code = metadata.passcode;
    if (!code && legacyPasscodeMap.has(String(course.id))) {
      code = legacyPasscodeMap.get(String(course.id))!;
    }
    if (!code) {
      code = course.slug === "applied-agentic-ai" ? "1611" : "2026";
    }
    metadata.passcode = code;

    // Ensure folderGroupId is mapped to valid group or default
    let fId = metadata.folderGroupId || "";
    let fName = metadata.folderGroupName || "";
    if (!fId || !folderGroupMap.has(fId)) {
      const defaultGroup = folderGroups[0] ?? DEFAULT_FOLDER_GROUPS[0];
      fId = defaultGroup.id;
      fName = defaultGroup.name;
      metadata.folderGroupId = fId;
      metadata.folderGroupName = fName;
    } else {
      fName = folderGroupMap.get(fId)!.name;
      metadata.folderGroupName = fName;
    }

    return {
      id: String(course.id),
      slug: String(course.slug),
      title: String(course.title),
      description: metadata.summary || null,
      language_label: course.language_label ?? "vi_en",
      status: course.status,
      passcode: code,
      unlocked: Boolean(metadata.unlocked),
      folderGroupId: fId,
      folderGroupName: fName,
      folderOrder: metadata.folderOrder ?? 0,
      systemIcons: metadata.systemIcons || [],
      metadata,
    };
  });

  courses.sort((a, b) => (a.folderOrder || Number.MAX_SAFE_INTEGER) - (b.folderOrder || Number.MAX_SAFE_INTEGER));

  const sections: SectionWithPasscode[] = (sectionsResult.data ?? []).map((section) => {
    const parentCourse = courses.find((c) => c.id === section.course_id);
    let code = parentCourse?.passcode || parentCourse?.metadata.passcode
      || parentCourse?.metadata.sectionPasscodes?.[section.section_key]
      || parentCourse?.metadata.sectionPasscodes?.[section.id];

    if (!code && section.section_key === "section1" && parentCourse && legacyPasscodeMap.has(parentCourse.id)) {
      code = legacyPasscodeMap.get(parentCourse.id);
    }
    if (!code) {
      code = parentCourse?.passcode || "1611";
    }

    return {
      id: String(section.id),
      course_id: String(section.course_id),
      section_key: String(section.section_key),
      title: String(section.title),
      position: Number(section.position),
      status: section.status,
      passcode: code,
      content_type: section.content_type === "pdf" || section.content_type === "tsx" || section.content_type === "pptx" ? section.content_type : "builtin",
      content_path: section.content_path ? String(section.content_path) : null,
      source_filename: section.source_filename ? String(section.source_filename) : null,
      slide_count: Number.isFinite(Number(section.slide_count)) && Number(section.slide_count) > 0 ? Number(section.slide_count) : null,
    };
  });

  return { courses, sections, folderGroups };
}

/**
 * Updates a course's metadata JSON in courses.description.
 */
async function updateCourseMetadata(courseId: string, updater: (current: CourseMetadata) => CourseMetadata) {
  const supabase = getSupabaseAdmin();
  const { data: course, error: readError } = await supabase
    .from("courses")
    .select("id, description")
    .eq("id", courseId)
    .single();

  if (readError) throw readError;
  const current = parseCourseMetadata(course.description);
  const updated = updater(current);
  const serialized = serializeCourseMetadata(updated);

  const { error: updateError } = await supabase
    .from("courses")
    .update({ description: serialized, updated_at: new Date().toISOString() })
    .eq("id", courseId);

  if (updateError) throw updateError;
  return updated;
}

/**
 * Updates a course's system icons list.
 */
export async function updateCourseSystemIcons(courseId: string, systemIcons: CourseSystemIcon[]) {
  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    systemIcons: Array.isArray(systemIcons) ? systemIcons : [],
  }));
}

/**
 * Updates a course's summary / description text.
 */
export async function updateCourseSummary(courseId: string, summary: string) {
  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    summary: summary.trim(),
  }));
}

/**
 * Bulk add or replace allowed emails for a course folder.
 */
export async function setCourseEmailsBulk(
  courseId: string,
  rawEmails: string[] | string,
  mode: "append" | "replace" = "append"
) {
  const inputList = Array.isArray(rawEmails)
    ? rawEmails
    : String(rawEmails).split(/[\r\n,;\s]+/);

  const cleanList = inputList
    .map(normalizeEmail)
    .filter(isValidEmail);

  return updateCourseMetadata(courseId, (current) => {
    let nextEmails: string[];
    if (mode === "replace") {
      nextEmails = cleanList;
    } else {
      nextEmails = [...current.allowedEmails, ...cleanList];
    }
    if (!nextEmails.includes(FIXED_ADMIN_EMAIL)) {
      nextEmails.unshift(FIXED_ADMIN_EMAIL);
    }
    return {
      ...current,
      allowedEmails: [...new Set(nextEmails)],
    };
  });
}

/**
 * Remove a single email from a course folder.
 */
export async function removeCourseEmail(courseId: string, email: string) {
  const target = normalizeEmail(email);
  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    allowedEmails: current.allowedEmails.filter((e) => e !== target && e !== target.toLowerCase()),
  }));
}

/**
 * Clear all learner emails from a course folder (keeps fixed admin).
 */
export async function clearCourseEmails(courseId: string) {
  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    allowedEmails: [FIXED_ADMIN_EMAIL],
  }));
}

/**
 * Set the single passcode for a course folder.
 */
export async function setCoursePasscode(courseId: string, code: string) {
  const trimmed = code.trim();
  const supabase = getSupabaseAdmin();

  // Try syncing to course_passcodes table if present
  try {
    const hash = createHash("sha256").update(trimmed).digest("hex");
    await supabase.from("course_passcodes").upsert(
      {
        course_id: courseId,
        code_hash: hash,
        code_hint: trimmed,
        label: "Folder Passcode",
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id" }
    );
  } catch {
    // Continue even if schema has different constraints
  }

  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    passcode: trimmed,
    sectionPasscodes: {
      ...current.sectionPasscodes,
      section1: trimmed,
    },
  }));
}

/**
 * Generate a new random 4-digit passcode for a course folder.
 */
export async function generateNewCoursePasscode(courseId: string): Promise<string> {
  const code = randomInt(1000, 9999).toString();
  await setCoursePasscode(courseId, code);
  return code;
}

/**
 * Backward compatibility: set section passcode (now updates folder passcode as well).
 */
export async function setSectionPasscode(courseId: string, sectionKey: string, code: string) {
  return setCoursePasscode(courseId, code);
}

/**
 * Get all authorized emails across the entire platform.
 */
export async function getAllAuthorizedEmails(preloadedCourses?: CourseWithDetails[]): Promise<string[]> {
  const courses = preloadedCourses ?? (await getCoursesAndSectionsData()).courses;
  const set = new Set<string>();
  set.add(FIXED_ADMIN_EMAIL);
  for (const c of courses) {
    for (const email of c.metadata.allowedEmails) {
      if (isValidEmail(email)) set.add(normalizeEmail(email));
    }
  }
  return Array.from(set);
}

/**
 * Checks if an email is on the authorized list.
 */
export async function isEmailAuthorized(email: string): Promise<boolean> {
  const norm = normalizeEmail(email);
  if (norm === FIXED_ADMIN_EMAIL) return true;
  const allEmails = await getAllAuthorizedEmails();
  return allEmails.includes(norm);
}

/**
 * Bulk add or replace authorized emails across the system.
 */
export async function setAuthorizedEmailsBulk(
  rawEmails: string[] | string,
  mode: "append" | "replace" = "append"
): Promise<string[]> {
  const inputList = Array.isArray(rawEmails)
    ? rawEmails
    : String(rawEmails).split(/[\r\n,;\s]+/);

  const cleanList = inputList.map(normalizeEmail).filter(isValidEmail);
  const current = await getAllAuthorizedEmails();

  let nextEmails: string[];
  if (mode === "replace") {
    nextEmails = cleanList;
  } else {
    nextEmails = [...current, ...cleanList];
  }
  if (!nextEmails.includes(FIXED_ADMIN_EMAIL)) {
    nextEmails.unshift(FIXED_ADMIN_EMAIL);
  }
  const deduplicated = Array.from(new Set(nextEmails));

  // Sync to all active courses in parallel
  const supabase = getSupabaseAdmin();
  const { data: courses } = await supabase.from("courses").select("id, description").neq("status", "archived");

  if (courses && courses.length > 0) {
    await Promise.all(
      courses.map((c) => {
        const meta = parseCourseMetadata(c.description);
        meta.allowedEmails = deduplicated;
        return supabase.from("courses").update({
          description: serializeCourseMetadata(meta),
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);
      })
    );

    // Also sync to course_folder_allowed_emails table in a single batch upsert
    try {
      const rows: Array<{ course_id: string; email: string; granted_by: string }> = [];
      for (const c of courses) {
        for (const email of deduplicated) {
          rows.push({ course_id: c.id, email, granted_by: "admin" });
        }
      }
      if (rows.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          await supabase.from("course_folder_allowed_emails").upsert(
            chunk,
            { onConflict: "course_id,email" }
          );
        }
      }
    } catch {
      // Non-fatal if course_folder_allowed_emails table is not configured
    }
  }

  return deduplicated;
}

/**
 * Remove one or more emails from the authorized email list.
 */
export async function removeAuthorizedEmails(emailsToRemove: string[]): Promise<string[]> {
  const targets = new Set(emailsToRemove.map(normalizeEmail));
  const current = await getAllAuthorizedEmails();
  const updated = current.filter((e) => !targets.has(e) || e === FIXED_ADMIN_EMAIL);

  const supabase = getSupabaseAdmin();
  const { data: courses } = await supabase.from("courses").select("id, description").neq("status", "archived");

  if (courses && courses.length > 0) {
    await Promise.all(
      courses.map((c) => {
        const meta = parseCourseMetadata(c.description);
        meta.allowedEmails = updated;
        return supabase.from("courses").update({
          description: serializeCourseMetadata(meta),
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);
      })
    );

    try {
      const emailsToDelete = Array.from(targets).filter((e) => e !== FIXED_ADMIN_EMAIL);
      if (emailsToDelete.length > 0) {
        await supabase.from("course_folder_allowed_emails").delete().in("email", emailsToDelete);
      }
    } catch {
      // Non-fatal if course_folder_allowed_emails table is not configured
    }
  }

  return updated;
}

/**
 * Clear all learner emails (keeps fixed admin).
 */
export async function clearAllAuthorizedEmails(): Promise<string[]> {
  return removeAuthorizedEmails((await getAllAuthorizedEmails()).filter((e) => e !== FIXED_ADMIN_EMAIL));
}

/**
 * Set unlocked status for a single course.
 */
export async function setCourseUnlocked(courseId: string, unlocked: boolean) {
  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    unlocked: Boolean(unlocked),
  }));
}

/**
 * Set unlocked status for ALL active courses (Unlock all courses function).
 */
export async function setAllCoursesUnlocked(unlocked: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, description")
    .neq("status", "archived");

  if (error) throw error;

  if (courses && courses.length > 0) {
    await Promise.all(
      courses.map((c) => {
        const meta = parseCourseMetadata(c.description);
        meta.unlocked = Boolean(unlocked);
        return supabase.from("courses").update({
          description: serializeCourseMetadata(meta),
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);
      })
    );
  }
}

/**
 * Verifies if an entered passcode is correct for a specific course.
 * Automatically returns true if the course is unlocked.
 */
export async function verifyCoursePasscode(courseId: string, code: string): Promise<boolean> {
  const { courses } = await getCoursesAndSectionsData();
  const course = courses.find((c) => c.id === courseId);
  if (!course) return false;
  if (course.unlocked || course.metadata.unlocked) return true;

  const trimmed = code.trim();
  if (!trimmed) return false;

  if (course.passcode === trimmed || course.metadata.passcode === trimmed) return true;

  if (course.metadata.sectionPasscodes) {
    for (const p of Object.values(course.metadata.sectionPasscodes)) {
      if (p === trimmed) return true;
    }
  }

  return false;
}

/**
 * Persists master folder groups across courses (primarily in the core course).
 */
async function saveFolderGroups(groups: CourseFolderGroup[]) {
  const supabase = getSupabaseAdmin();
  const { data: coreCourse, error: readError } = await supabase
    .from("courses")
    .select("id, description")
    .eq("slug", "applied-agentic-ai")
    .maybeSingle();

  if (readError) throw readError;
  if (!coreCourse) throw new Error("The course library is not configured for saving folders.");
  const meta = parseCourseMetadata(coreCourse.description);
  meta.folderGroups = groups;
  const { error } = await supabase.from("courses").update({
    description: serializeCourseMetadata(meta),
    updated_at: new Date().toISOString(),
  }).eq("id", coreCourse.id);
  if (error) throw error;
}

/**
 * Create a new Parent Folder (Folder Lớn).
 */
export async function createFolderGroup(name: string, description?: string): Promise<CourseFolderGroup> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name cannot be empty");

  const { folderGroups } = await getCoursesAndSectionsData();
  const id = `fg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const newGroup: CourseFolderGroup = {
    id,
    name: trimmed,
    description: description?.trim() || undefined,
    order: folderGroups.length + 1,
  };

  const updatedGroups = [...folderGroups, newGroup];
  await saveFolderGroups(updatedGroups);
  return newGroup;
}

/**
 * Update an existing Folder Lớn (name / description / order).
 */
export async function updateFolderGroup(id: string, name: string, description?: string): Promise<CourseFolderGroup[]> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name cannot be empty");

  const { folderGroups } = await getCoursesAndSectionsData();
  const updatedGroups = folderGroups.map((g) => {
    if (g.id === id) {
      return { ...g, name: trimmed, description: description !== undefined ? description.trim() : g.description };
    }
    return g;
  });

  await saveFolderGroups(updatedGroups);

  // Also update courses that reference this folder group
  const supabase = getSupabaseAdmin();
  const { data: courses } = await supabase.from("courses").select("id, description").neq("status", "archived");
  if (courses && courses.length > 0) {
    await Promise.all(
      courses.map((c) => {
        const meta = parseCourseMetadata(c.description);
        if (meta.folderGroupId === id) {
          meta.folderGroupName = trimmed;
          return supabase.from("courses").update({
            description: serializeCourseMetadata(meta),
            updated_at: new Date().toISOString(),
          }).eq("id", c.id);
        }
        return Promise.resolve();
      })
    );
  }

  return updatedGroups;
}

/**
 * Delete a Folder Lớn.
 * Permanently deletes all non-core child courses and their sections inside this folder.
 * If the core course was inside, it is safely moved to the default surviving folder.
 */
export async function deleteFolderGroup(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { folderGroups } = await getCoursesAndSectionsData();
  const remainingGroups = folderGroups.filter((g) => g.id !== id);
  if (remainingGroups.length === 0) {
    remainingGroups.push(...DEFAULT_FOLDER_GROUPS);
  }
  await saveFolderGroups(remainingGroups);

  const defaultGroup = remainingGroups[0] ?? DEFAULT_FOLDER_GROUPS[0];
  const { data: courses } = await supabase.from("courses").select("id, slug, description").neq("status", "archived");
  if (courses && courses.length > 0) {
    for (const c of courses) {
      const meta = parseCourseMetadata(c.description);
      if (meta.folderGroupId === id) {
        if (c.slug === APPLIED_AGENTIC_AI_SLUG) {
          // The core course cannot be deleted; reassign it to default group
          meta.folderGroupId = defaultGroup.id;
          meta.folderGroupName = defaultGroup.name;
          await supabase.from("courses").update({
            description: serializeCourseMetadata(meta),
            updated_at: new Date().toISOString(),
          }).eq("id", c.id);
        } else {
          // Permanently delete child course and all its dependencies
          try {
            const { data: sectionFiles } = await supabase
              .from("course_sections")
              .select("content_path")
              .eq("course_id", c.id);
            const paths = (sectionFiles ?? []).map((item) => item.content_path).filter((path): path is string => Boolean(path));
            if (paths.length > 0) await supabase.storage.from("course-section-content").remove(paths);
          } catch {}
          await supabase.from("course_sections").delete().eq("course_id", c.id);
          try {
            await supabase.from("course_passcodes").delete().eq("course_id", c.id);
          } catch {}
          try {
            await supabase.from("user_unlocked_courses").delete().eq("course_id", c.id);
          } catch {}
          try {
            await supabase.from("course_folder_allowed_emails").delete().eq("course_id", c.id);
          } catch {}
          await supabase.from("courses").delete().eq("id", c.id);
        }
      }
    }
  }
}

/**
 * Move / assign a course into a specific Folder Lớn.
 */
export async function setCourseFolderGroup(courseId: string, folderGroupId: string, folderGroupName?: string) {
  const { folderGroups } = await getCoursesAndSectionsData();
  const targetGroup = folderGroups.find((g) => g.id === folderGroupId);
  const finalName = folderGroupName?.trim() || targetGroup?.name || "Chương Trình AI & Agentic";

  return updateCourseMetadata(courseId, (current) => ({
    ...current,
    folderGroupId,
    folderGroupName: finalName,
  }));
}

/**
 * Lock or unlock ALL courses inside a specific Folder Lớn.
 */
export async function setFolderGroupUnlocked(folderGroupId: string, unlocked: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, description")
    .neq("status", "archived");

  if (error) throw error;

  if (courses && courses.length > 0) {
    await Promise.all(
      courses.map((c) => {
        const meta = parseCourseMetadata(c.description);
        if (meta.folderGroupId === folderGroupId) {
          meta.unlocked = Boolean(unlocked);
          return supabase.from("courses").update({
            description: serializeCourseMetadata(meta),
            updated_at: new Date().toISOString(),
          }).eq("id", c.id);
        }
        return Promise.resolve();
      })
    );
  }
}

/**
 * Retrieves all course IDs that a specific user email has unlocked.
 * Checks both public.user_unlocked_courses table and course metadata fallback.
 */
export async function getUserUnlockedCourses(email: string): Promise<string[]> {
  const norm = normalizeEmail(email);
  if (!norm || !isValidEmail(norm)) return [];
  if (norm === FIXED_ADMIN_EMAIL) {
    const { courses } = await getCoursesAndSectionsData();
    return courses.map((c) => c.id);
  }

  const unlockedSet = new Set<string>();

  // 1. Query Supabase table public.user_unlocked_courses
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("user_unlocked_courses")
      .select("course_id")
      .eq("email", norm);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.course_id) unlockedSet.add(String(row.course_id));
      }
    }
  } catch {
    // Graceful fallback if table does not exist yet
  }

  // 2. Query course metadata fallback and globally unlocked courses
  try {
    const { courses } = await getCoursesAndSectionsData();
    for (const c of courses) {
      if (c.unlocked || c.metadata.unlocked) {
        unlockedSet.add(c.id);
      } else if (c.metadata.unlockedEmails && c.metadata.unlockedEmails.includes(norm)) {
        unlockedSet.add(c.id);
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return Array.from(unlockedSet);
}

/**
 * Records that a user email has unlocked a course (via passcode or free access).
 * Persists in public.user_unlocked_courses and updates course metadata fallback.
 */
export async function recordUserUnlockedCourse(
  email: string,
  courseId: string,
  unlockedVia: "passcode" | "free_access" | "admin_grant" = "passcode"
): Promise<void> {
  const norm = normalizeEmail(email);
  if (!norm || !isValidEmail(norm) || !courseId) return;

  // 1. Persist in public.user_unlocked_courses table
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("user_unlocked_courses").upsert(
      {
        email: norm,
        course_id: courseId,
        unlocked_via: unlockedVia,
        unlocked_at: new Date().toISOString(),
      },
      { onConflict: "email,course_id" }
    );
  } catch {
    // Table might not exist yet; fallback below ensures zero downtime
  }

  // 2. Persist in course metadata fallback
  try {
    const supabase = getSupabaseAdmin();
    const { data: courseRow } = await supabase
      .from("courses")
      .select("id, description")
      .eq("id", courseId)
      .maybeSingle();

    if (courseRow) {
      const meta = parseCourseMetadata(courseRow.description);
      const currentList = new Set(meta.unlockedEmails || []);
      if (!currentList.has(norm)) {
        currentList.add(norm);
        meta.unlockedEmails = Array.from(currentList);
        await supabase
          .from("courses")
          .update({
            description: serializeCourseMetadata(meta),
            updated_at: new Date().toISOString(),
          })
          .eq("id", courseId);
      }
    }
  } catch (err) {
    console.warn("Notice: course metadata unlockedEmails update skipped:", err);
  }
}
