import "server-only";
import { createHash } from "node:crypto";
import { currentAccessSession } from "./session";
import { getCoursesAndSectionsData } from "./courseAccessStorage";
import { resolvePasscode, resolveFreeAccess } from "./passcodes";
import { FIXED_ADMIN_EMAIL, type AppUserAccess } from "./types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LearnerIdentity } from "@/lib/learningIdentity";

export async function currentUserAccess(signal?: AbortSignal, resolvedSession?: Awaited<ReturnType<typeof currentAccessSession>>): Promise<AppUserAccess | null> {
  const session = resolvedSession === undefined ? await currentAccessSession(signal) : resolvedSession;
  if (!session) return null;
  const identityQuery = session.role === "passcode" && session.identityLogId
    ? getSupabaseAdmin(signal).from("access_audit_logs").select("details").eq("id", session.identityLogId).eq("action", "PASSCODE_LOGIN").single()
    : Promise.resolve(null);
  const [catalog, storedIdentity] = await Promise.all([getCoursesAndSectionsData(signal), identityQuery]);
  const resolved = session.role === "admin" ? catalog : session.role === "guest" ? resolveFreeAccess(catalog) : resolvePasscode(catalog, session.credentialHash);
  if (!resolved) return null;
  let identity: LearnerIdentity | undefined;
  if (session.role === "passcode" && session.identityLogId) {
    const { data, error } = storedIdentity!;
    if (error || !data || data.details?.sessionId !== session.sessionId) return null;
    identity = data.details as LearnerIdentity;
  }
  const sections = resolved.sections.filter(section => section.status === "active").map(section => ({
    id: section.id, courseId: section.course_id, sectionKey: section.section_key,
    title: section.title, position: section.position, contentType: section.content_type,
    sourceFilename: section.source_filename, slideCount: section.slide_count,
    contentRevision: section.content_path ? createHash("sha256").update(section.content_path).digest("hex").slice(0, 16) : null,
    hidden: Boolean(section.hidden),
    canFacilitate: session.role === "admin" || ("canFacilitate" in section && section.canFacilitate === true),
  }));
  return {
    authUserId: session.role === "admin" ? "admin" : session.sessionId,
    learnerIdentity: identity,
    email: session.role === "admin" ? FIXED_ADMIN_EMAIL : identity?.email || `${session.sessionId}@passcode.eiu`,
    displayName: session.role === "admin" ? "Son Lam (Admin)" : identity?.name || (sections.some(section => section.canFacilitate) ? "Facilitator" : `Learner ${session.sessionId.slice(0, 6)}`),
    avatarUrl: null, isAdmin: session.role === "admin", isActive: true,
    canFacilitate: session.role === "admin" || sections.some(section => section.canFacilitate),
    courses: resolved.courses.filter(course => course.status === "active").map(course => ({
      id: course.id, slug: course.slug, title: course.title, description: course.metadata.summary,
      languageLabel: course.language_label, isUnlocked: true,
      folderGroupId: course.folderGroupId, folderGroupName: course.folderGroupName, folderOrder: course.folderOrder,
      systemIcons: course.systemIcons, sectionTemplates: course.metadata.sectionTemplates,
      templateKey: course.metadata.templateKey, hidden: Boolean(course.metadata.hidden || catalog.folderGroups.some(folder => folder.id === course.folderGroupId && folder.hidden)),
    })),
    sections,
  };
}

export async function requireAdminAccess(signal?: AbortSignal) {
  // The signed administrator session includes a live session-version check.
  // Admin-only routes do not need to fetch and parse the entire course catalog.
  const session = await currentAccessSession(signal);
  return session?.role === "admin" ? { email: FIXED_ADMIN_EMAIL, isAdmin: true as const, isActive: true as const } : null;
}

export const requireCourseManager = requireAdminAccess;
export async function canManageSection(sectionId: string) {
  const access = await currentUserAccess();
  return Boolean(access?.isAdmin && access.isActive && access.sections.some(section => section.id === sectionId));
}
