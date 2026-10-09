import "server-only";
import { cookies } from "next/headers";
import { currentUserAccess } from "@/lib/auth/currentUser";
import {
  ACTIVE_SECTION_COOKIE,
  APPLIED_AGENTIC_AI_SLUG,
  isLearningSection,
  type AppUserAccess,
} from "@/lib/auth/types";

export async function currentRole(resolvedAccess?: AppUserAccess | null, signal?: AbortSignal) {
  const [cookieStore, access] = await Promise.all([cookies(), resolvedAccess === undefined ? currentUserAccess(signal) : resolvedAccess]);
  if (!access?.isActive) return null;
  if (access.isAdmin) return "admin" as const;
  const appliedCourseIds = access.courses
    .filter((course) => course.slug === APPLIED_AGENTIC_AI_SLUG)
    .map((course) => course.id);
  const section = cookieStore.get(ACTIVE_SECTION_COOKIE)?.value;
  return isLearningSection(section)
    && access.sections.some((item) => item.sectionKey === section && appliedCourseIds.includes(item.courseId))
    ? section
    : null;
}

export async function teachingSections(resolvedAccess?: AppUserAccess | null, signal?: AbortSignal) {
  const access = resolvedAccess === undefined ? await currentUserAccess(signal) : resolvedAccess;
  if (!access?.isActive) return [];
  if (access.isAdmin) return ["section1", "section2"] as const;
  const courseIds = new Set(access.courses.filter(course => course.slug === APPLIED_AGENTIC_AI_SLUG).map(course => course.id));
  return access.sections.filter(section => section.canFacilitate && courseIds.has(section.courseId) && isLearningSection(section.sectionKey)).map(section => section.sectionKey);
}

export async function canFacilitateSection(section: string, resolvedAccess?: AppUserAccess | null, signal?: AbortSignal) {
  return (await teachingSections(resolvedAccess, signal)).some(allowed => allowed === section);
}
