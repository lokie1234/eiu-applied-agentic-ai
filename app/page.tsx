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

  const hasCourse = access.isAdmin
    || access.courses.some((course) => course.slug === APPLIED_AGENTIC_AI_SLUG);
  if (!hasCourse) return <NoCourseAccess email={access.email} />;

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
  if (allowedSections.length === 0) return <NoCourseAccess email={access.email} />;

  const savedSection = cookieStore.get(ACTIVE_SECTION_COOKIE)?.value;
  const initialSection = isLearningSection(savedSection) && allowedSections.includes(savedSection)
    ? savedSection
    : null;
  const profile = {
    name: access.displayName,
    email: access.email,
    section: initialSection ?? allowedSections[0],
  };

  return (
    <LessonPortal
      isAdmin={access.isAdmin}
      allowedSections={[...allowedSections]}
      initialSection={initialSection}
      initialProfile={profile}
    />
  );
}
