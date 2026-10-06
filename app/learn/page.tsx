import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LessonPortal from "@/components/LessonPortal";
import NoCourseAccess from "@/components/NoCourseAccess";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { ACTIVE_SECTION_COOKIE, APPLIED_AGENTIC_AI_SLUG, isLearningSection } from "@/lib/auth/types";

export const metadata = { title: "EIU · Learning Space" };

export default async function LearningPage() {
  const [cookieStore, access] = await Promise.all([cookies(), currentUserAccess()]);
  if (!access) redirect("/");
  if (access.mustChangePassword) redirect("/change-password");
  if (!access.isActive) return <NoCourseAccess />;
  const appliedCourse = access.courses.find((course) => course.slug === APPLIED_AGENTIC_AI_SLUG);
  const allowedSections = access.isAdmin
    ? (["section1", "section2"] as const)
    : access.sections
        .filter((section) => section.courseId === appliedCourse?.id && isLearningSection(section.sectionKey))
        .map((section) => section.sectionKey as "section1" | "section2");
  const courseFolders = access.courses.map((course) => ({
    ...course,
    sections: access.sections.filter((section) => section.courseId === course.id).sort((a, b) => a.position - b.position),
  })).filter((course) => access.isAdmin || access.isTeacher || course.sections.length > 0);
  if (courseFolders.length === 0) return <NoCourseAccess />;
  const savedSection = cookieStore.get(ACTIVE_SECTION_COOKIE)?.value;
  const initialSection = isLearningSection(savedSection) && allowedSections.includes(savedSection) ? savedSection : null;
  return <LessonPortal isTeacher={access.isTeacher} isAdmin={access.isAdmin} courseFolders={courseFolders}
    initialSection={initialSection} initialProfile={{ name: access.displayName, email: access.email, section: initialSection ?? allowedSections[0] ?? "section1" }} />;
}
