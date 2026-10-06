import { getAdminCredential, verifyAdminPassword } from "@/lib/auth/adminPassword";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ACCESS_SESSION_COOKIE,
  createAccessSession,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { FIXED_ADMIN_EMAIL } from "@/lib/auth/types";

export const runtime = "nodejs";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

function fingerprint(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = String(body.password ?? "");
    const requestFingerprint = fingerprint(request);
    const supabase = getSupabaseAdmin();
    const { count, error: countError } = await supabase.from("access_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "ADMIN_PASSWORD_FAILED")
      .contains("details", { fingerprint: requestFingerprint })
      .gte("created_at", new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
    }
    const credential = await getAdminCredential();
    if (!credential && !process.env.ADMIN_ACCESS_PASSWORD?.trim()) {
      return NextResponse.json(
        { success: false, message: "Administrator access is not configured." },
        { status: 503 },
      );
    }
    const valid = await verifyAdminPassword(password, credential);
    if (!valid) {
      await supabase.from("access_audit_logs").insert({ actor_email: "admin@eiu.edu.vn", action: "ADMIN_PASSWORD_FAILED", details: { fingerprint: requestFingerprint } });
      return NextResponse.json({ success: false, message: "Incorrect administrator code." }, { status: 401 });
    }
    await supabase.from("access_audit_logs").insert({ actor_email: "admin@eiu.edu.vn", action: "ADMIN_PASSWORD_SUCCESS", details: { fingerprint: requestFingerprint } });
    const response = NextResponse.json({ success: true });
    response.cookies.set(
      ACCESS_SESSION_COOKIE,
      createAccessSession({ role: "admin", email: FIXED_ADMIN_EMAIL, sessionVersion: credential?.session_version ?? 0 }),
      sessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("Admin access error:", error);
    return NextResponse.json({ success: false, message: "Unable to open administrator access right now." }, { status: 500 });
  }
}
