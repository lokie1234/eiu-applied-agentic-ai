import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ACCESS_SESSION_COOKIE,
  createAccessSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  isEmailAuthorized,
} from "@/lib/auth/courseAccessStorage";
import {
  FIXED_ADMIN_EMAIL,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/types";

export const runtime = "nodejs";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = digest(a);
  const hashB = digest(b);
  return hashA.length === hashB.length && timingSafeEqual(hashA, hashB);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body.email ?? "").trim();
    const adminPassword = String(body.adminPassword ?? body.code ?? "").trim();

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);
    const configuredAdminCode = process.env.ADMIN_ACCESS_PASSWORD?.trim();
    const isAdminPassword = Boolean(configuredAdminCode) && safeCompare(adminPassword, configuredAdminCode!);

    // Case 1: son.lam@eiu.edu.vn admin login
    if (email === FIXED_ADMIN_EMAIL) {
      if (!adminPassword) {
        return NextResponse.json(
          { success: false, requireAdminPassword: true, message: "Please enter your administrator password." },
          { status: 401 }
        );
      }

      if (isAdminPassword) {
        const response = NextResponse.json({ success: true, destination: "/admin/access" });
        response.cookies.set(
          ACCESS_SESSION_COOKIE,
          createAccessSession({ role: "admin", email: FIXED_ADMIN_EMAIL }),
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
    const response = NextResponse.json({
      success: true,
      destination: "/learn",
    });

    response.cookies.set(
      ACCESS_SESSION_COOKIE,
      createAccessSession({
        role: "learner",
        email,
        unlockedCourses: [],
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
