import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  ACCESS_SESSION_COOKIE,
  createAccessSession,
  passcodeDigest,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

function fingerprint(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();
    const supabase = getSupabaseAdmin();
    const requestFingerprint = fingerprint(request);

    const configuredAdminCode = process.env.ADMIN_ACCESS_PASSWORD?.trim();
    const isAdminCode = Boolean(configuredAdminCode)
      && code.length > 0
      && timingSafeEqual(digest(code), digest(configuredAdminCode!));
    const isCourseCode = /^\d{4}$/.test(code);

    if (isAdminCode || !isCourseCode) {
      const { count, error: adminCountError } = await supabase.from("access_audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("action", "ADMIN_PASSWORD_FAILED")
        .contains("details", { fingerprint: requestFingerprint })
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
      if (adminCountError) throw adminCountError;
      if ((count ?? 0) >= 5) {
        return NextResponse.json({ success: false, message: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
      }
      if (!isAdminCode) {
        await supabase.from("access_audit_logs").insert({ actor_email: "admin@eiu.edu.vn", action: "ADMIN_PASSWORD_FAILED", details: { fingerprint: requestFingerprint } });
        return NextResponse.json({ success: false, message: "The access code is incorrect or has been revoked." }, { status: 401 });
      }

      await supabase.from("access_audit_logs").insert({ actor_email: "admin@eiu.edu.vn", action: "ADMIN_PASSWORD_SUCCESS", details: { fingerprint: requestFingerprint } });
      const response = NextResponse.json({ success: true, destination: "/admin/access" });
      response.cookies.set(
        ACCESS_SESSION_COOKIE,
        createAccessSession({ role: "admin" }),
        sessionCookieOptions(),
      );
      return response;
    }

    const { count, error: countError } = await supabase.from("access_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PASSCODE_LOGIN_FAILED")
      .contains("details", { fingerprint: requestFingerprint })
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= 12) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });
    }
    const { data, error } = await supabase.from("course_passcodes")
      .select("id, course_id, status, expires_at")
      .eq("code_hash", passcodeDigest(code))
      .maybeSingle();
    if (error) throw error;
    const expired = data?.expires_at && new Date(data.expires_at).getTime() <= Date.now();
    if (!data || data.status !== "active" || expired) {
      await supabase.from("access_audit_logs").insert({ action: "PASSCODE_LOGIN_FAILED", details: { fingerprint: requestFingerprint } });
      return NextResponse.json(
        { success: false, message: "The passcode is incorrect or has been revoked." },
        { status: 401 },
      );
    }
    await supabase.from("access_audit_logs").insert({ action: "PASSCODE_LOGIN_SUCCESS", course_id: data.course_id, details: { fingerprint: requestFingerprint, passcodeId: data.id } });
    await supabase.from("course_passcodes")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    const response = NextResponse.json({ success: true, destination: "/learn" });
    response.cookies.set(
      ACCESS_SESSION_COOKIE,
      createAccessSession({ role: "learner", passcodeId: String(data.id) }),
      sessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("Passcode access error:", error);
    return NextResponse.json({ success: false, message: "Unable to verify access right now." }, { status: 500 });
  }
}
