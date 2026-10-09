import type { AccessCodes } from "./passcodes";
import { parseIdentityPolicy, type LearningIdentityPolicy } from "@/lib/learningIdentity";
import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FIXED_ADMIN_EMAIL, isValidEmail, normalizeEmail, APPLIED_AGENTIC_AI_SLUG, type CourseSystemIcon } from "@/lib/auth/types";
export type { CourseSystemIcon };

export type SlideTemplate = { id: string; name: string; background: string };

export const DEFAULT_SLIDE_TEMPLATES: SlideTemplate[] = [{ id: "eiu-business-v1", name: "EIU Business", background: "/templates/eiu-business-v1/background.png" }];

export type CourseFolderGroup = {
  hidden?: boolean;
  createdBy?: string;
  accessCodes?: AccessCodes;
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
  learningIdentityPolicy?: LearningIdentityPolicy;
  globalAccessCodes?: AccessCodes;
  hiddenSectionIds?: string[];
  hidden?: boolean;
  templateKey?: string;
  slideTemplates?: SlideTemplate[];
  summary: string;
  allowedEmails: string[];
  passcode: string;
  facilitatorPasscode?: string;
  sectionAccessCodes?: Record<string, AccessCodes>;
  sectionPasscodes?: Record<string, string>; // retained for backward compatibility
  sectionTemplates?: Record<string, string>;
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
  hidden?: boolean;
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

function parseAccessCodes(value: unknown): AccessCodes {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return Object.fromEntries(["learner", "facilitator"].flatMap(mode => typeof row[mode] === "string" ? [[mode, row[mode].trim()]] : []));
}

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
      if (typeof parsed.passcode !== "string") {
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
        globalAccessCodes: parseAccessCodes(parsed.globalAccessCodes),
        learningIdentityPolicy: parseIdentityPolicy(parsed.learningIdentityPolicy),
        allowedEmails: Array.from(new Set(emails)),
        passcode,
        sectionPasscodes,
        facilitatorPasscode: typeof parsed.facilitatorPasscode === "string" ? parsed.facilitatorPasscode.trim() : "",
        sectionAccessCodes: parsed.sectionAccessCodes && typeof parsed.sectionAccessCodes === "object" ? Object.fromEntries(Object.entries(parsed.sectionAccessCodes).map(([id, codes]) => [id, parseAccessCodes(codes)])) : {},
        hidden: parsed.hidden === true,
        hiddenSectionIds: Array.isArray(parsed.hiddenSectionIds) ? [...new Set<string>(parsed.hiddenSectionIds.filter((id: unknown): id is string => typeof id === "string"))] : [],
        templateKey: typeof parsed.templateKey === "string" ? parsed.templateKey : undefined,
        slideTemplates: Array.isArray(parsed.slideTemplates) ? parsed.slideTemplates : undefined,
        sectionTemplates: Object.fromEntries(Object.entries(parsed.sectionTemplates ?? {}).filter(([, value]) => typeof value === "string").map(([key, value]) => [key, String(value)])),
        unlocked,
        unlockedEmails: Array.from(new Set(unlockedEmails)),
        folderGroupId,
        folderGroupName,
        folderOrder,
        folderGroups: folderGroups.length > 0 ? folderGroups.map(group => ({ ...group, accessCodes: parseAccessCodes(group.accessCodes) })) : undefined,
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
    globalAccessCodes: metadata.globalAccessCodes || {},
    learningIdentityPolicy: parseIdentityPolicy(metadata.learningIdentityPolicy),
    hidden: Boolean(metadata.hidden),
    hiddenSectionIds: metadata.hiddenSectionIds || [],
    ...(metadata.templateKey !== undefined ? { templateKey: metadata.templateKey } : {}),
    ...(metadata.slideTemplates !== undefined ? { slideTemplates: metadata.slideTemplates } : {}),
    summary: metadata.summary || "",
    allowedEmails: emails,
    passcode: metadata.passcode,
    facilitatorPasscode: metadata.facilitatorPasscode || "",
    sectionAccessCodes: metadata.sectionAccessCodes || {},
    sectionPasscodes: metadata.sectionPasscodes || {},
    sectionTemplates: metadata.sectionTemplates || {},
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
export async function getCoursesAndSectionsData(signal?: AbortSignal) {
  const supabase = getSupabaseAdmin(signal);
  const [coursesResult, sectionsResult] = await Promise.all([
    supabase.from("courses").select("id, slug, title, description, status, language_label").neq("status", "archived").order("title"),
    supabase.from("course_sections").select("id, course_id, section_key, title, position, status, content_type, content_path, source_filename, slide_count").neq("status", "archived").order("position"),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (sectionsResult.error) throw sectionsResult.error;

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
    const code = metadata.passcode;

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
      description: metadata.summary,
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
  const coursesById = new Map(courses.map(course => [course.id, course]));

  const sections: SectionWithPasscode[] = (sectionsResult.data ?? []).map((section) => {
    const parentCourse = coursesById.get(section.course_id);
    const code = parentCourse?.passcode || "";

    return {
      id: String(section.id),
      hidden: Boolean(parentCourse?.metadata.hiddenSectionIds?.includes(String(section.id))),
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

  return { courses, sections, folderGroups, globalAccessCodes: coreMeta?.globalAccessCodes || {}, learningIdentityPolicy: parseIdentityPolicy(coreMeta?.learningIdentityPolicy) };
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


/** Apply or remove the built-in layout for sections. */
export async function setSectionTemplate(courseId: string, sectionKeys: string[], enabled: boolean) {
  return updateCourseMetadata(courseId, (current) => {
    const sectionTemplates = { ...current.sectionTemplates };
    for (const key of sectionKeys) {
      if (enabled) sectionTemplates[key] = "eiu-business-v1";
      else delete sectionTemplates[key];
    }
    return { ...current, sectionTemplates };
  });
}


/**
 * Persists master folder groups across courses (primarily in the core course).
 */
export async function saveFolderGroups(groups: CourseFolderGroup[]) {
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
export async function createFolderGroup(name: string, description?: string, createdBy?: string): Promise<CourseFolderGroup> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name cannot be empty");

  const { folderGroups } = await getCoursesAndSectionsData();
  const id = `fg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const newGroup: CourseFolderGroup = {
    id,
    name: trimmed,
    description: description?.trim() || undefined,
    order: folderGroups.length + 1,
    ...(createdBy ? { createdBy } : {}),
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
            const paths = (sectionFiles ?? []).map((item) => item.content_path).filter((path): path is string => Boolean(path) && !path?.startsWith("drive:"));
            if (paths.length > 0) await supabase.storage.from("course-section-content").remove(paths);
          } catch {}
          await supabase.from("course_sections").delete().eq("course_id", c.id);
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


export async function getSlideTemplates(): Promise<SlideTemplate[]> {
  const { data, error } = await getSupabaseAdmin().from("courses").select("description").eq("slug", APPLIED_AGENTIC_AI_SLUG).maybeSingle();
  if (error) throw error;
  return parseCourseMetadata(data?.description).slideTemplates ?? DEFAULT_SLIDE_TEMPLATES;
}

export async function saveSlideTemplates(templates: SlideTemplate[]) {
  const { data, error } = await getSupabaseAdmin().from("courses").select("id").eq("slug", APPLIED_AGENTIC_AI_SLUG).single();
  if (error) throw error;
  await updateCourseMetadata(data.id, current => ({ ...current, slideTemplates: templates }));
}

export async function setFolderGroupHidden(id: string, hidden: boolean) {
  const { folderGroups } = await getCoursesAndSectionsData();
  if (!folderGroups.some(group => group.id === id)) throw new Error("Folder not found.");
  await saveFolderGroups(folderGroups.map(group => group.id === id ? { ...group, hidden } : group));
}
