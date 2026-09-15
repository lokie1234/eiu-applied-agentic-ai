import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const score = Number(body.score);
    const total = Number(body.total);
    const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
    const section = String(body.section ?? "section1") === "section2" ? "section2" : "section1";

    if (body.website) return NextResponse.json({ success: true });
    if (!name || name.length > 80) {
      return NextResponse.json({ success: false, message: "Họ tên không hợp lệ." }, { status: 400 });
    }
    if (!Number.isInteger(score) || !Number.isInteger(total) || total !== 10 || score < 0 || score > total) {
      return NextResponse.json({ success: false, message: "Kết quả bài kiểm tra không hợp lệ." }, { status: 400 });
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
        section,
        name,
        score,
        total,
        completedAt: String(body.completedAt ?? new Date().toISOString()),
      }),
      cache: "no-store",
      redirect: "follow",
    });
    const text = await upstream.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Apps Script đang trả về trang HTML. Hãy triển khai dạng Web app và chọn quyền truy cập Anyone.");
    }
    if (!upstream.ok || payload.success !== true) throw new Error(String(payload.message ?? "Apps Script không phản hồi thành công."));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Quiz result API error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể gửi kết quả." }, { status: 500 });
  }
}
