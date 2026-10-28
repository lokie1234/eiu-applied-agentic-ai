import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAdminCredential, verifyAdminPassword } from "@/lib/auth/adminPassword";
import { ACCESS_SESSION_COOKIE, createAccessSession, sessionCookieOptions } from "@/lib/auth/session";
import { FIXED_ADMIN_EMAIL } from "@/lib/auth/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const passcode = typeof body.password === "string" ? body.password.trim() : "";
    if (!/^[0-9]{6}$/.test(passcode)) return NextResponse.json({ success: false, message: "Invalid admin code." }, { status: 400 });
    const db = getSupabaseAdmin(request.signal);
    const fingerprint = createHash("sha256").update(request.headers.get("cookie") || "unknown").digest("hex");
    if (verifyAdminPassword(passcode)) {
      const credential = await getAdminCredential(request.signal);
      try {
        await db.from("access_audit_logs").insert({
          actor_email: FIXED_ADMIN_EMAIL,
          action: "ADMIN_PASSWORD_LOGIN",
          details: { fingerprint },
        });
      } catch (logError) {
        console.error("Admin login audit log error:", logError);
      }
      const response = NextResponse.json({ success: true, destination: "/admin/access" });
      response.cookies.set(
        ACCESS_SESSION_COOKIE,
        createAccessSession({
          role: "admin",
          authMethod: "password",
          email: FIXED_ADMIN_EMAIL,
          sessionVersion: credential?.session_version ?? 0,
        }),
        sessionCookieOptions()
      );
      return response;
    }

    return NextResponse.json({ success: false, message: "Incorrect admin code." }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, message: "Unable to sign in right now. Please try again later." }, { status: 503 });
  }
}
