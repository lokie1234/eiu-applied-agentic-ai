import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LessonPortal from "@/components/LessonPortal";
import NoCourseAccess from "@/components/NoCourseAccess";
import { currentUserAccess } from "@/lib/auth/currentUser";
import {
  ACTIVE_SECTION_COOKIE,
  APPLIED_AGENTIC_AI_SLUG,
  isLearningSection,
} from "@/lib/auth/types";

export default async function HomePage() {
  const [cookieStore, access] = await Promise.all([cookies(), currentUserAccess()]);
  if (!access) redirect("/login");
  if (!access.isActive) return <NoCourseAccess email={access.email} />;

  const appliedCourse = access.courses.find(
    (course) => course.slug === APPLIED_AGENTIC_AI_SLUG,
  );
  const allowedSections = access.isAdmin
    ? (["section1", "section2"] as const)
    : access.sections
        .filter(
          (section) => section.courseId === appliedCourse?.id && isLearningSection(section.sectionKey),
        )
        .map((section) => section.sectionKey as "section1" | "section2");
  const courseFolders = access.courses
    .map((course) => ({
      ...course,
      sections: access.sections
        .filter((section) => section.courseId === course.id)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((course) => access.isAdmin || course.sections.length > 0);
  if (courseFolders.length === 0) return <NoCourseAccess email={access.email} />;

  const savedSection = cookieStore.get(ACTIVE_SECTION_COOKIE)?.value;
  const initialSection = isLearningSection(savedSection) && allowedSections.includes(savedSection)
    ? savedSection
    : null;
  const profile = {
    name: access.displayName,
    email: access.email,
    section: initialSection ?? allowedSections[0] ?? "section1",
  };

  return (
    <LessonPortal
      isAdmin={access.isAdmin}
      allowedSections={[...allowedSections]}
      courseFolders={courseFolders}
      initialSection={initialSection}
      initialProfile={profile}
    />
  );
}
