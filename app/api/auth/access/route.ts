import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCoursesAndSectionsData } from "@/lib/auth/courseAccessStorage";
import { hashPasscode, resolvePasscode, resolveFreeAccess } from "@/lib/auth/passcodes";
import { ACCESS_SESSION_COOKIE, createAccessSession, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.freeAccess === true) {
      if (!resolveFreeAccess(await getCoursesAndSectionsData())) return NextResponse.json({ success: false, message: "No free courses are available right now." }, { status: 403 });
      const response = NextResponse.json({ success: true, destination: "/learn" });
      response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "guest", sessionId: randomUUID() }), sessionCookieOptions());
      return response;
    }
    const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
    if (!/^[A-Za-z0-9-]{4,32}$/.test(passcode)) return NextResponse.json({ success: false, message: "Please enter a valid passcode." }, { status: 400 });
    const db = getSupabaseAdmin();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const fingerprint = createHash("sha256").update(ip).digest("hex");
    const { count, error } = await db.from("access_audit_logs").select("id", { count: "exact", head: true })
      .eq("action", "PASSCODE_LOGIN_FAILED").contains("details", { fingerprint })
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
    if (error) throw error;
    if ((count ?? 0) >= 10) return NextResponse.json({ success: false, message: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
    const credentialHash = hashPasscode(passcode);
    const access = resolvePasscode(await getCoursesAndSectionsData(), credentialHash);
    if (!access) {
      const { error: auditError } = await db.from("access_audit_logs").insert({ action: "PASSCODE_LOGIN_FAILED", details: { fingerprint } });
      if (auditError) throw auditError;
      return NextResponse.json({ success: false, message: "Incorrect or inactive passcode. Please contact your instructor." }, { status: 401 });
    }
    const response = NextResponse.json({ success: true, destination: "/learn" });
    response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "passcode", credentialHash, sessionId: randomUUID() }), sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "Unable to sign in right now. Please try again later." }, { status: 500 });
  }
}
