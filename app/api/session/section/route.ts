import { NextResponse } from "next/server";
import { currentUserAccess, requireAdminAccess } from "@/lib/auth/currentUser";
import {
  ACTIVE_SECTION_COOKIE,
  APPLIED_AGENTIC_AI_SLUG,
  isLearningSection,
} from "@/lib/auth/types";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminAccess(request.signal);
    const access = admin ?? await currentUserAccess(request.signal);
    if (!access?.isActive) {
      return NextResponse.json({ success: false, message: "Access is not available for this session." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const section = body.section;
    const appliedCourseIds = "courses" in access ? access.courses
      .filter((course) => course.slug === APPLIED_AGENTIC_AI_SLUG)
      .map((course) => course.id) : [];
    const canOpen = access.isAdmin || ("sections" in access && access.sections.some(
      (item) => item.sectionKey === section && appliedCourseIds.includes(item.courseId),
    ));
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
  } catch {
    if (request.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled." }, { status: 499, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ success: false, message: "Unable to open section. Please try again." }, { status: 500 });
  }
}
