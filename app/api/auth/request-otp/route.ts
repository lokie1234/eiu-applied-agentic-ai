import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isEiuEmail } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!isEiuEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Vui lòng dùng email có đúng đuôi @eiu.edu.vn." },
        { status: 400 },
      );
    }

    const gasEndpoint = process.env.GAS_OTP_ENDPOINT?.trim();
    const sharedSecret = process.env.GAS_OTP_SHARED_SECRET?.trim();
    if (!gasEndpoint || !sharedSecret) {
      return NextResponse.json(
        { success: false, message: "Dịch vụ gửi OTP chưa được cấu hình." },
        { status: 500 },
      );
    }

    const ipHash = crypto
      .createHmac("sha256", sharedSecret)
      .update(clientIp(request))
      .digest("hex");
    const supabase = getSupabaseAdmin();
    const { data: reservation, error: reservationError } = await supabase
      .rpc("reserve_otp_request", { p_email: email, p_ip_hash: ipHash });
    if (reservationError) throw reservationError;
    if (reservation !== "ok") {
      const message = reservation === "cooldown"
        ? "Vui lòng chờ 60 giây trước khi gửi lại mã."
        : "Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau.";
      return NextResponse.json({ success: false, message }, { status: 429 });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error) throw error;
    const otp = data.properties.email_otp;
    if (!otp) throw new Error("Supabase không tạo được OTP.");

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const canonical = `${email}\n${otp}\n${timestamp}\n${nonce}`;
    const signature = crypto.createHmac("sha256", sharedSecret).update(canonical).digest("hex");
    const gasResponse = await fetch(gasEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ email, otp, timestamp, nonce, signature }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const gasPayload = await gasResponse.json().catch(() => ({})) as {
      success?: boolean;
      message?: string;
    };
    if (!gasResponse.ok || !gasPayload.success) {
      throw new Error(gasPayload.message || "Google Apps Script không gửi được email.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Request OTP error:", error);
    return NextResponse.json(
      { success: false, message: "Không thể gửi mã OTP. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
