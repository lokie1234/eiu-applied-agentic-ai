import "server-only";
import { cookies } from "next/headers";
import { currentUserAccess } from "@/lib/auth/currentUser";
import {
  ACTIVE_SECTION_COOKIE,
  APPLIED_AGENTIC_AI_SLUG,
  isLearningSection,
} from "@/lib/auth/types";

export async function currentRole() {
  const [cookieStore, access] = await Promise.all([cookies(), currentUserAccess()]);
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
