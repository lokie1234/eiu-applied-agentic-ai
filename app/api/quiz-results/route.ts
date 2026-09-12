import { NextResponse } from "next/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const score = Number(body.score);
    const total = Number(body.total);
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 10) : [];
    const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();

    if (body.website) return NextResponse.json({ success: true });
    if (!name || name.length > 80 || !EMAIL_PATTERN.test(email) || email.length > 160) {
      return NextResponse.json({ success: false, message: "Họ tên hoặc email không hợp lệ." }, { status: 400 });
    }
    if (!Number.isInteger(score) || !Number.isInteger(total) || total !== 10 || score < 0 || score > total || answers.length !== total) {
      return NextResponse.json({ success: false, message: "Kết quả quiz không hợp lệ." }, { status: 400 });
    }
    if (!webhookUrl) {
      return NextResponse.json({ success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." }, { status: 503 });
    }

    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "quiz.submit",
        secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "",
        name,
        email,
        score,
        total,
        answers,
        completedAt: String(body.completedAt ?? new Date().toISOString()),
      }),
      cache: "no-store",
    });
    const text = await upstream.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(text); } catch { payload = {}; }
    if (!upstream.ok || payload.success === false) throw new Error(String(payload.message ?? "Google Apps Script không phản hồi thành công."));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Quiz result API error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể gửi kết quả." }, { status: 500 });
  }
}
