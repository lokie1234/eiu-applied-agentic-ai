import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentAccessSession } from "@/lib/auth/session";
import type { AppUserAccess, CourseAccess, SectionAccess } from "@/lib/auth/types";

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
    .select("id, course_id, section_key, title, position")
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
  return ((data ?? []) as CourseRow[]).map((course): CourseAccess => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    languageLabel: course.language_label,
  }));
}

export async function currentUserAccess(): Promise<AppUserAccess | null> {
  const session = await currentAccessSession();
  if (!session) return null;

  if (session.role === "admin") {
    const [courses, sections] = await Promise.all([loadCourses(), loadSections()]);
    return {
      authUserId: "admin",
      email: "admin@eiu.edu.vn",
      displayName: "EIU Administrator",
      avatarUrl: null,
      isAdmin: true,
      isActive: true,
      courses,
      sections,
    };
  }

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
    courses,
    sections,
  };
}

export async function requireAdminAccess() {
  const access = await currentUserAccess();
  return access?.isActive && access.isAdmin ? access : null;
}
