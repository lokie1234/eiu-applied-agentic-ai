import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ADMIN_EMAIL = "son.lam@eiu.edu.vn";
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(hash(left), hash(right));
}

function requestFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

async function recordAttempt(
  action: "ADMIN_QUICK_LOGIN_FAILED" | "ADMIN_QUICK_LOGIN_SUCCESS",
  fingerprint: string,
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("access_audit_logs").insert({
    actor_email: ADMIN_EMAIL,
    action,
    target_email: ADMIN_EMAIL,
    details: { fingerprint },
  });
  if (error) console.error("Quick login audit error:", error);
}

export async function POST(request: Request) {
  try {
    const configuredCode = process.env.ADMIN_QUICK_LOGIN_CODE?.trim();
    if (!configuredCode) {
      return NextResponse.json(
        { success: false, message: "Đăng nhập nhanh chưa được cấu hình." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();
    const fingerprint = requestFingerprint(request);
    const supabase = getSupabaseAdmin();
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();

    const { count, error: countError } = await supabase
      .from("access_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "ADMIN_QUICK_LOGIN_FAILED")
      .eq("target_email", ADMIN_EMAIL)
      .contains("details", { fingerprint })
      .gte("created_at", windowStart);
    if (countError) throw countError;

    if ((count ?? 0) >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { success: false, message: "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    if (email !== ADMIN_EMAIL || !code || !safeEqual(code, configuredCode)) {
      await recordAttempt("ADMIN_QUICK_LOGIN_FAILED", fingerprint);
      return NextResponse.json(
        { success: false, message: "Mã đăng nhập không đúng." },
        { status: 401 },
      );
    }

    const { data: adminUser, error: adminUserError } = await supabase
      .from("app_users")
      .select("email, auth_user_id, is_admin, status")
      .eq("email", ADMIN_EMAIL)
      .maybeSingle();
    if (adminUserError) throw adminUserError;
    if (!adminUser?.is_admin || adminUser.status !== "active") {
      return NextResponse.json(
        { success: false, message: "Tài khoản admin không hoạt động." },
        { status: 403 },
      );
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: ADMIN_EMAIL,
    });
    if (linkError || !linkData.properties?.hashed_token) {
      throw linkError || new Error("Không thể tạo phiên đăng nhập admin.");
    }
    if (adminUser.auth_user_id && linkData.user.id !== adminUser.auth_user_id) {
      throw new Error("Supabase Auth identity không khớp với tài khoản admin.");
    }

    const auth = await createSupabaseServerAuthClient();
    const { error: verifyError } = await auth.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });
    if (verifyError) throw verifyError;

    await recordAttempt("ADMIN_QUICK_LOGIN_SUCCESS", fingerprint);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin quick login error:", error);
    return NextResponse.json(
      { success: false, message: "Không thể đăng nhập nhanh lúc này." },
      { status: 500 },
    );
  }
}
