import "server-only";

import { createHash, randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FIXED_ADMIN_EMAIL, isValidEmail, normalizeEmail } from "@/lib/auth/types";

export type CourseMetadata = {
  summary: string;
  allowedEmails: string[];
  passcode: string; // 1 passcode for the whole course folder
  sectionPasscodes?: Record<string, string>; // retained for backward compatibility
  unlocked?: boolean; // When true, course can be accessed without a passcode
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
  metadata: CourseMetadata;
};

export type SectionWithPasscode = {
  id: string;
  course_id: string;
  section_key: string;
  title: string;
  position: number;
  status: "draft" | "active" | "archived";
  passcode: string;
};

export function parseCourseMetadata(raw: string | null | undefined, defaultSummary = ""): CourseMetadata {
  if (!raw) {
    return { summary: defaultSummary, allowedEmails: [FIXED_ADMIN_EMAIL], passcode: "1611", sectionPasscodes: {}, unlocked: false };
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

      return { summary, allowedEmails: Array.from(new Set(emails)), passcode, sectionPasscodes, unlocked };
    }
  } catch {
    // raw was plain text string
  }
  return { summary: raw.trim(), allowedEmails: [FIXED_ADMIN_EMAIL], passcode: "1611", sectionPasscodes: {}, unlocked: false };
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
  });
}

/**
 * Load all courses with parsed metadata and their section passcodes.
 */
export async function getCoursesAndSectionsData() {
  const supabase = getSupabaseAdmin();
  const [coursesResult, sectionsResult, passcodesResult] = await Promise.all([
    supabase.from("courses").select("id, slug, title, description, status, language_label").neq("status", "archived").order("title"),
    supabase.from("course_sections").select("id, course_id, section_key, title, position, status").neq("status", "archived").order("position"),
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

    return {
      id: String(course.id),
      slug: String(course.slug),
      title: String(course.title),
      description: metadata.summary || null,
      language_label: course.language_label ?? "vi_en",
      status: course.status,
      passcode: code,
      unlocked: Boolean(metadata.unlocked),
      metadata,
    };
  });

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
    };
  });

  return { courses, sections };
}

/**
 * Updates a course's metadata JSON in courses.description.
 */
export async function updateCourseMetadata(courseId: string, updater: (current: CourseMetadata) => CourseMetadata) {
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
 * Backward compatibility: generate section passcode.
 */
export async function generateNewSectionPasscode(courseId: string, _sectionKey?: string): Promise<string> {
  return generateNewCoursePasscode(courseId);
}

export type MatchedCourseAccess = {
  course: CourseWithDetails;
  sections: SectionWithPasscode[];
  section: SectionWithPasscode;
};

/**
 * Matches an entered passcode to a course folder.
 */
export async function matchCourseByPasscode(code: string): Promise<MatchedCourseAccess | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { courses, sections } = await getCoursesAndSectionsData();

  // 1. Direct course folder passcode match
  for (const course of courses) {
    if (course.passcode === trimmed || course.metadata.passcode === trimmed) {
      const courseSections = sections.filter((s) => s.course_id === course.id);
      return {
        course,
        sections: courseSections,
        section: courseSections[0] ?? {
          id: `sec-${course.id}`,
          course_id: course.id,
          section_key: "section1",
          title: course.title,
          position: 1,
          status: "active",
          passcode: trimmed,
        },
      };
    }
  }

  // 2. Check legacy sectionPasscodes
  for (const course of courses) {
    if (course.metadata.sectionPasscodes) {
      for (const pass of Object.values(course.metadata.sectionPasscodes)) {
        if (pass === trimmed) {
          const courseSections = sections.filter((s) => s.course_id === course.id);
          return {
            course,
            sections: courseSections,
            section: courseSections[0] ?? {
              id: `sec-${course.id}`,
              course_id: course.id,
              section_key: "section1",
              title: course.title,
              position: 1,
              status: "active",
              passcode: trimmed,
            },
          };
        }
      }
    }
  }

  // 3. Fallback check sections
  for (const sec of sections) {
    if (sec.passcode === trimmed) {
      const course = courses.find((c) => c.id === sec.course_id);
      if (course) {
        const courseSections = sections.filter((s) => s.course_id === course.id);
        return {
          course,
          sections: courseSections,
          section: sec,
        };
      }
    }
  }

  return null;
}

/**
 * Given a code entered on login, find which section and course it matches.
 */
export async function matchSectionByPasscode(code: string) {
  return matchCourseByPasscode(code);
}


/**
 * Checks whether an email has access to a course folder.
 */
export function isEmailAllowedForCourse(email: string, course: CourseWithDetails): boolean {
  const norm = normalizeEmail(email);
  if (norm === FIXED_ADMIN_EMAIL) return true;
  return course.metadata.allowedEmails.some((allowed) => allowed.toLowerCase() === norm);
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
