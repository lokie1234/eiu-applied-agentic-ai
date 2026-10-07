import { teacherByEmail, matchesPassword } from "@/lib/auth/teachers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAdminCredential, verifyAdminPassword } from "@/lib/auth/adminPassword";
import { NextResponse } from "next/server";
import {
  ACCESS_SESSION_COOKIE,
  createAccessSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  isEmailAuthorized,
  getUserUnlockedCourses,
} from "@/lib/auth/courseAccessStorage";
import {
  FIXED_ADMIN_EMAIL,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email ?? "").trim();
    const adminPassword = String(body.adminPassword ?? body.code ?? "");

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);
    if (adminPassword.length > 1024) return NextResponse.json({ message: "Password is too long." }, { status: 400 });
    const teacher = email === FIXED_ADMIN_EMAIL ? null : await teacherByEmail(email);
    if (teacher) {
      // Email discovery is not a failed password attempt, even during a lockout.
      if (!adminPassword) {
        return NextResponse.json(
          { success: false, requireTeacherPassword: true, message: "Please enter your teacher password." },
          { status: 401 }
        );
      }
      const db = getSupabaseAdmin();
      const { count, error } = await db.from("access_audit_logs").select("id", { count: "exact", head: true }).eq("action", "TEACHER_LOGIN_FAILED").eq("target_email", email).gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
      if (error) throw error;
      if ((count ?? 0) >= 5) return NextResponse.json({ message: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
      if (teacher.status !== "active" || !await matchesPassword(adminPassword, teacher.password_hash)) {
        const { error: auditError } = await db.from("access_audit_logs").insert({ action: "TEACHER_LOGIN_FAILED", target_email: email });
        if (auditError) throw auditError;
        return NextResponse.json({ message: "Incorrect email or password, or account suspended." }, { status: 401 });
      }
      const response = NextResponse.json({ success: true, destination: teacher.must_change_password ? "/change-password" : "/teacher" });
      response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "teacher", email, accountId: teacher.id, sessionVersion: teacher.session_version }), sessionCookieOptions());
      return response;
    }

    // Case 1: son.lam@eiu.edu.vn admin login
    if (email === FIXED_ADMIN_EMAIL) {
      if (!adminPassword) {
        return NextResponse.json(
          { success: false, requireAdminPassword: true, message: "Please enter your administrator password." },
          { status: 401 }
        );
      }

      const credential = await getAdminCredential();
      if (await verifyAdminPassword(adminPassword, credential)) {
        const response = NextResponse.json({ success: true, destination: "/admin/access" });
        response.cookies.set(
          ACCESS_SESSION_COOKIE,
          createAccessSession({ role: "admin", email: FIXED_ADMIN_EMAIL, sessionVersion: credential?.session_version ?? 0 }),
          sessionCookieOptions()
        );
        return response;
      }

      return NextResponse.json(
        { success: false, message: "Incorrect administrator password." },
        { status: 401 }
      );
    }

    // Case 2: Learner Login with authorized email
    // Check if email has been granted access in admin
    const isAllowed = await isEmailAuthorized(email);
    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Email "${email}" has not been granted access. Please contact your instructor or administrator.`,
        },
        { status: 403 }
      );
    }

    // Email is authorized! Grant session to access course library in /learn
    // Retrieve any courses this learner has already unlocked previously
    const previouslyUnlocked = await getUserUnlockedCourses(email);

    const response = NextResponse.json({
      success: true,
      destination: "/learn",
    });

    response.cookies.set(
      ACCESS_SESSION_COOKIE,
      createAccessSession({
        role: "learner",
        email,
        unlockedCourses: previouslyUnlocked,
      }),
      sessionCookieOptions()
    );

    return response;
  } catch (error) {
    console.error("Access verification error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to verify access at this moment. Please try again later." },
      { status: 500 }
    );
  }
}
