import "server-only";
import { currentTeacher, teacherByEmail } from "./teachers";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentAccessSession } from "@/lib/auth/session";
import { parseCourseMetadata, getUserUnlockedCourses, getCoursesAndSectionsData } from "@/lib/auth/courseAccessStorage";
import { FIXED_ADMIN_EMAIL, type AppUserAccess, type CourseAccess, type SectionAccess } from "@/lib/auth/types";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  language_label: "vi" | "en" | "vi_en";
};

async function loadSections(courseIds?: string[]) {
  const admin = getSupabaseAdmin();
  let query = admin.from("course_sections")
    .select("id, course_id, section_key, title, position, content_type, source_filename, slide_count")
    .eq("status", "active")
    .order("position");
  if (courseIds) query = query.in("course_id", courseIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((section): SectionAccess => ({
    id: String(section.id),
    courseId: String(section.course_id),
    sectionKey: String(section.section_key),
    title: String(section.title),
    position: Number(section.position),
    contentType: section.content_type === "pdf" || section.content_type === "tsx" || section.content_type === "pptx" ? section.content_type : "builtin",
    sourceFilename: section.source_filename ? String(section.source_filename) : null,
    slideCount: Number.isFinite(Number(section.slide_count)) && Number(section.slide_count) > 0 ? Number(section.slide_count) : null,
  }));
}

async function loadCourses(courseIds?: string[]) {
  const admin = getSupabaseAdmin();
  let query = admin.from("courses")
    .select("id, slug, title, description, language_label")
    .eq("status", "active")
    .order("title");
  if (courseIds) query = query.in("id", courseIds);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as CourseRow[]).map((course): CourseAccess => {
    const meta = parseCourseMetadata(course.description, course.title);
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: meta.summary,
      languageLabel: course.language_label,
      isUnlocked: Boolean(meta.unlocked),
      folderGroupId: meta.folderGroupId || "fg-ai-agentic",
      folderGroupName: meta.folderGroupName || "Chương Trình AI & Agentic",
      folderOrder: meta.folderOrder ?? 0,
      systemIcons: meta.systemIcons || [],
      sectionTemplates: meta.sectionTemplates || {},
      templateKey: meta.templateKey,
      hidden: Boolean(meta.hidden),
    };
  }).sort((a, b) => (a.folderOrder || Number.MAX_SAFE_INTEGER) - (b.folderOrder || Number.MAX_SAFE_INTEGER));
}

export async function currentUserAccess(): Promise<AppUserAccess | null> {
  const session = await currentAccessSession();
  if (!session) return null;

  if (session.role === "teacher") {
    const teacher = await currentTeacher();
    if (!teacher) return null;
    const [courses, sections] = teacher.must_change_password ? [[], []] : await Promise.all([loadCourses(), loadSections()]);
    return {
      authUserId: teacher.id, email: teacher.email, displayName: teacher.display_name, avatarUrl: null,
      isAdmin: false, isTeacher: true, mustChangePassword: teacher.must_change_password, isActive: !teacher.must_change_password,
      ...(teacher.must_change_password ? { courses: [], sections: [] } : await visibleLibrary(courses.map(course => ({ ...course, isUnlocked: true })), sections)),
    };
  }
  if (session.role === "admin") {
    const [courses, sections] = await Promise.all([loadCourses(), loadSections()]);
    return {
      authUserId: "admin",
      email: FIXED_ADMIN_EMAIL,
      displayName: "Son Lam (Admin)",
      avatarUrl: null,
      isAdmin: true,
      isActive: true,
      courses: courses.map((c) => ({ ...c, isUnlocked: true })),
      sections,
    };
  }

  // Learner with authorized email - can view all courses in folder library
  if (session.role === "learner" && "email" in session && session.email) {
    if (await teacherByEmail(session.email)) return null;
    const [allCourses, allSections, rememberedUnlocked] = await Promise.all([
      loadCourses(),
      loadSections(),
      getUserUnlockedCourses(session.email),
    ]);
    if (allCourses.length === 0) return null;

    const sessionUnlockedCourses = new Set([
      ...(session.unlockedCourses ?? []),
      ...rememberedUnlocked,
    ]);
    if (session.courseId) {
      sessionUnlockedCourses.add(String(session.courseId));
    }

    const coursesWithUnlockedStatus: CourseAccess[] = allCourses.map((c) => ({
      ...c,
      isUnlocked: Boolean(c.isUnlocked || sessionUnlockedCourses.has(c.id)),
    }));

    return {
      authUserId: session.email,
      email: session.email,
      displayName: session.email.split("@")[0],
      avatarUrl: null,
      isAdmin: false,
      isActive: true,
      ...await visibleLibrary(coursesWithUnlockedStatus, allSections),
    };
  }

  // Backward compatibility fallback for legacy passcode sessions
  if (session.role === "learner" && "passcodeId" in session && session.passcodeId) {
    const admin = getSupabaseAdmin();
    const { data: passcode, error } = await admin.from("course_passcodes")
      .select("id, course_id, label, status, expires_at")
      .eq("id", session.passcodeId)
      .maybeSingle();
    if (error) throw error;
    if (!passcode || passcode.status !== "active") return null;
    if (passcode.expires_at && new Date(passcode.expires_at).getTime() <= Date.now()) return null;

    const courseIds = [String(passcode.course_id)];
    const [courses, sections] = await Promise.all([loadCourses(courseIds), loadSections(courseIds)]);
    if (courses.length === 0) return null;
    return {
      authUserId: String(passcode.id),
      email: `access-${String(passcode.id).slice(0, 8)}@passcode.eiu`,
      displayName: String(passcode.label || "EIU Learner"),
      avatarUrl: null,
      isAdmin: false,
      isActive: true,
      ...await visibleLibrary(courses, sections),
    };
  }

  return null;
}

export async function requireAdminAccess() {
  const access = await currentUserAccess();
  return access?.isActive && access.isAdmin ? access : null;
}

export async function requireCourseManager() {
  const access = await currentUserAccess();
  return access?.isActive && (access.isAdmin || access.isTeacher) ? access : null;
}
export async function canManageSection(sectionId: string) {
  const actor = await requireCourseManager();
  if (!actor) return false;
  if (actor.isAdmin) return true;
  if (!actor.sections.some(section => section.id === sectionId)) return false;
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("course_sections").select("created_by,course_id").eq("id", sectionId).maybeSingle();
  if (error) throw error;
  if (!data || data.created_by !== actor.authUserId) return false;
  const { data: course, error: courseError } = await db.from("courses").select("created_by").eq("id", data.course_id).maybeSingle();
  if (courseError) throw courseError;
  return course?.created_by === actor.authUserId;
}

async function visibleLibrary(courses: CourseAccess[], sections: SectionAccess[]) {
  const catalog = await getCoursesAndSectionsData();
  const hiddenFolders = new Set(catalog.folderGroups.filter(group => group.hidden).map(group => group.id));
  const visible = courses.filter(course => !course.hidden && !hiddenFolders.has(course.folderGroupId || "fg-ai-agentic"));
  const ids = new Set(visible.map(course => course.id));
  return { courses: visible, sections: sections.filter(section => ids.has(section.courseId)) };
}
