import { redirect } from "next/navigation";
import LessonPortal from "@/components/LessonPortal";
import NoCourseAccess from "@/components/NoCourseAccess";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG, isLearningSection } from "@/lib/auth/types";

export const metadata = { title: "EIU · Learning Space" };

export default async function LearningPage({ searchParams }: { searchParams: Promise<{ courseId?: string; sectionId?: string }> }) {
  const [access, query] = await Promise.all([currentUserAccess(), searchParams]);
  if (!access) redirect("/");
  if (!access.isActive) return <NoCourseAccess />;
  const appliedCourse = access.courses.find((course) => course.slug === APPLIED_AGENTIC_AI_SLUG);
  const allowedSections = access.isAdmin
    ? (["section1", "section2"] as const)
    : access.sections
        .filter((section) => section.courseId === appliedCourse?.id && isLearningSection(section.sectionKey))
        .map((section) => section.sectionKey as "section1" | "section2");
  const courseFolders = access.courses.filter(course => !course.hidden).map((course) => ({
    ...course,
    sections: access.sections.filter((section) => section.courseId === course.id && !section.hidden).sort((a, b) => a.position - b.position).map(section => ({ ...section, templateKey: course.templateKey !== undefined ? course.templateKey : course.sectionTemplates?.[section.sectionKey] })),
  })).filter((course) => access.isAdmin || course.sections.length > 0);
  if (courseFolders.length === 0) return <NoCourseAccess />;
  const requestedCourse = courseFolders.find(course => course.id === query.courseId && (access.isAdmin || course.isUnlocked));
  const requestedSection = requestedCourse?.sections.find(section => section.id === query.sectionId);
  const initialSection = requestedCourse
    ? requestedCourse.slug === APPLIED_AGENTIC_AI_SLUG && isLearningSection(requestedSection?.sectionKey) && allowedSections.includes(requestedSection.sectionKey) ? requestedSection.sectionKey : null
    : null;
  return <LessonPortal canFacilitate={access.canFacilitate} isAdmin={access.isAdmin} courseFolders={courseFolders}
    initialCourseId={requestedCourse?.id} initialSectionId={requestedSection?.id} initialSection={initialSection} initialProfile={{ name: access.displayName, email: access.email, section: initialSection ?? allowedSections[0] ?? "section1" }} />;
}
