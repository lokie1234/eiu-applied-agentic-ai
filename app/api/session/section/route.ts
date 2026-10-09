import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import {
  ACTIVE_SECTION_COOKIE,
  APPLIED_AGENTIC_AI_SLUG,
  isLearningSection,
} from "@/lib/auth/types";

export async function POST(request: Request) {
  const access = await currentUserAccess(request.signal);
  if (!access?.isActive) {
    return NextResponse.json({ success: false, message: "Access is not available for this session." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const section = body.section;
  const appliedCourseIds = access.courses
    .filter((course) => course.slug === APPLIED_AGENTIC_AI_SLUG)
    .map((course) => course.id);
  const canOpen = access.isAdmin || access.sections.some(
    (item) => item.sectionKey === section && appliedCourseIds.includes(item.courseId),
  );
  if (!canOpen || !isLearningSection(section)) {
    return NextResponse.json({ success: false, message: "Invalid section." }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, section });
  response.cookies.set(ACTIVE_SECTION_COOKIE, section, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
