import "server-only";
import { currentAccessSession } from "./session";
import { getCoursesAndSectionsData } from "./courseAccessStorage";
import { resolvePasscode, resolveFreeAccess } from "./passcodes";
import { FIXED_ADMIN_EMAIL, type AppUserAccess } from "./types";

export async function currentUserAccess(): Promise<AppUserAccess | null> {
  const session = await currentAccessSession();
  if (!session) return null;
  const catalog = await getCoursesAndSectionsData();
  const resolved = session.role === "admin" ? catalog : session.role === "guest" ? resolveFreeAccess(catalog) : resolvePasscode(catalog, session.credentialHash);
  if (!resolved) return null;
  const sections = resolved.sections.filter(section => section.status === "active").map(section => ({
    id: section.id, courseId: section.course_id, sectionKey: section.section_key,
    title: section.title, position: section.position, contentType: section.content_type,
    sourceFilename: section.source_filename, slideCount: section.slide_count,
    hidden: Boolean(section.hidden),
    canFacilitate: session.role === "admin" || ("canFacilitate" in section && section.canFacilitate === true),
  }));
  return {
    authUserId: session.role === "admin" ? "admin" : session.sessionId,
    email: session.role === "admin" ? FIXED_ADMIN_EMAIL : `${session.sessionId}@passcode.eiu`,
    displayName: session.role === "admin" ? "Son Lam (Admin)" : sections.some(section => section.canFacilitate) ? "Facilitator" : `Learner ${session.sessionId.slice(0, 6)}`,
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

export async function requireAdminAccess() {
  const access = await currentUserAccess();
  return access?.isActive && access.isAdmin ? access : null;
}

export const requireCourseManager = requireAdminAccess;
export async function canManageSection(sectionId: string) {
  const admin = await requireAdminAccess();
  return Boolean(admin?.sections.some(section => section.id === sectionId));
}
