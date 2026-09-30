import "server-only";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  isEiuEmail,
  type AppUserAccess,
  type CourseAccess,
  type SectionAccess,
} from "@/lib/auth/types";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

export async function currentUserAccess(): Promise<AppUserAccess | null> {
  const auth = await createSupabaseServerAuthClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user || !isEiuEmail(user.email)) return null;

  const email = user.email.toLowerCase();
  const admin = getSupabaseAdmin();
  const { data: appUser, error: appUserError } = await admin
    .from("app_users")
    .select("email, auth_user_id, display_name, is_admin, status")
    .eq("email", email)
    .maybeSingle();

  if (appUserError) throw appUserError;

  const metadataName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();
  const avatarUrl = typeof user.user_metadata?.avatar_url === "string"
    ? user.user_metadata.avatar_url
    : null;

  if (!appUser) {
    return {
      authUserId: user.id,
      email,
      displayName: metadataName || email.split("@")[0],
      avatarUrl,
      isAdmin: false,
      isActive: false,
      courses: [],
      sections: [],
    };
  }

  if (appUser.auth_user_id && appUser.auth_user_id !== user.id) return null;

  if (!appUser.auth_user_id || (!appUser.display_name && metadataName)) {
    const { error: updateError } = await admin
      .from("app_users")
      .update({
        auth_user_id: user.id,
        display_name: appUser.display_name || metadataName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);
    if (updateError) throw updateError;
  }

  const { data: grants, error: grantError } = await admin
    .from("user_section_access")
    .select("section_id")
    .eq("user_email", email);
  if (grantError) throw grantError;

  const sectionIds = (grants ?? []).map((grant) => String(grant.section_id));
  let sections: SectionAccess[] = [];
  if (appUser.is_admin) {
    const { data, error: sectionError } = await admin
      .from("course_sections")
      .select("id, course_id, section_key, title, position")
      .eq("status", "active")
      .order("position");
    if (sectionError) throw sectionError;
    sections = (data ?? []).map((section) => ({
      id: String(section.id),
      courseId: String(section.course_id),
      sectionKey: String(section.section_key),
      title: String(section.title),
      position: Number(section.position),
    }));
  } else if (sectionIds.length > 0) {
    const { data, error: sectionError } = await admin
      .from("course_sections")
      .select("id, course_id, section_key, title, position")
      .in("id", sectionIds)
      .eq("status", "active")
      .order("position");
    if (sectionError) throw sectionError;
    sections = (data ?? []).map((section) => ({
      id: String(section.id),
      courseId: String(section.course_id),
      sectionKey: String(section.section_key),
      title: String(section.title),
      position: Number(section.position),
    }));
  }

  const courseIds = [...new Set(sections.map((section) => section.courseId))];
  let courses: CourseAccess[] = [];
  if (appUser.is_admin) {
    const { data, error: courseError } = await admin
      .from("courses")
      .select("id, slug, title, description")
      .eq("status", "active")
      .order("title");
    if (courseError) throw courseError;
    courses = ((data ?? []) as CourseRow[]).map((course) => ({ ...course }));
  } else if (courseIds.length > 0) {
    const { data, error: courseError } = await admin
      .from("courses")
      .select("id, slug, title, description")
      .in("id", courseIds)
      .eq("status", "active")
      .order("title");
    if (courseError) throw courseError;
    courses = ((data ?? []) as CourseRow[]).map((course) => ({ ...course }));
  }

  return {
    authUserId: user.id,
    email,
    displayName: appUser.display_name || metadataName || email.split("@")[0],
    avatarUrl,
    isAdmin: Boolean(appUser.is_admin),
    isActive: appUser.status === "active",
    courses,
    sections,
  };
}

export async function requireAdminAccess() {
  const access = await currentUserAccess();
  return access?.isActive && access.isAdmin ? access : null;
}
