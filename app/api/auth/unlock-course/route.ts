import { NextResponse } from "next/server";
import {
  ACCESS_SESSION_COOKIE,
  createAccessSession,
  currentAccessSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  verifyCoursePasscode,
  recordUserUnlockedCourse,
} from "@/lib/auth/courseAccessStorage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await currentAccessSession();
    if (!session || (session.role !== "learner" && session.role !== "admin")) {
      return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const courseId = String(body.courseId ?? "").trim();
    const passcode = String(body.passcode ?? "").trim();
    const isFreeAccess = Boolean(body.isFreeAccess);

    if (!courseId) {
      return NextResponse.json({ success: false, message: "Course ID is required." }, { status: 400 });
    }

    // Admins don't need a passcode
    if (session.role === "admin") {
      return NextResponse.json({ success: true, courseId });
    }

    // Verify passcode for learner (automatically returns true if course is unlocked)
    const isValid = await verifyCoursePasscode(courseId, passcode);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Incorrect passcode for this course." },
        { status: 401 }
      );
    }

    // Passcode valid or free course! Permanently remember for this learner's account:
    const learnerEmail = "email" in session && session.email ? session.email : null;
    if (learnerEmail) {
      await recordUserUnlockedCourse(
        learnerEmail,
        courseId,
        isFreeAccess ? "free_access" : "passcode"
      );
    }

    // Update session cookie with unlocked course
    const currentlyUnlocked = session.unlockedCourses ?? [];
    const updatedUnlocked = Array.from(new Set([...currentlyUnlocked, courseId]));

    const response = NextResponse.json({ success: true, courseId });
    response.cookies.set(
      ACCESS_SESSION_COOKIE,
      createAccessSession({
        ...session,
        unlockedCourses: updatedUnlocked,
      }),
      sessionCookieOptions()
    );

    return response;
  } catch (error) {
    console.error("Unlock course error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to unlock course at this moment." },
      { status: 500 }
    );
  }
}

