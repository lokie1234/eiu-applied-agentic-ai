import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const feedback = String(body.feedback ?? "").trim();
    const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
    const section = String(body.section ?? "section1") === "section2" ? "section2" : "section1";

    if (body.website) return NextResponse.json({ success: true });
    if (!feedback || feedback.length > 2000) {
      return NextResponse.json({ success: false, message: "Nội dung phản hồi không hợp lệ." }, { status: 400 });
    }
    if (email.length > 100 || !/^[a-z0-9._%+-]+@eiu\.edu\.vn$/i.test(email)) {
      return NextResponse.json({ success: false, message: "Email EIU không hợp lệ." }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json({ success: false, message: "Họ tên không hợp lệ." }, { status: 400 });
    }

    console.log(`[Quiz Feedback] Received from ${email} (${name}) for ${section}: ${feedback.slice(0, 60)}...`);

    if (!webhookUrl) {
      return NextResponse.json({ success: true, note: "Logged locally" });
    }

    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "feedback.submit",
        secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "",
        section,
        name,
        email,
        feedback,
        submittedAt: String(body.submittedAt ?? new Date().toISOString()),
      }),
      cache: "no-store",
      redirect: "follow",
    });

    const text = await upstream.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Apps Script đang trả về trang HTML. Hãy cập nhật Code.gs và triển khai dạng Web app với quyền Anyone.");
    }

    if (!upstream.ok || payload.success !== true) {
      throw new Error(String(payload.message ?? "Apps Script không phản hồi thành công. Hãy cập nhật Code.gs bản mới nhất."));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Quiz feedback API error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể gửi phản hồi." },
      { status: 500 },
    );
  }
}

