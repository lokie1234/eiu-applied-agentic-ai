import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type SectionId = "section1" | "section2";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const section: SectionId = body.section === "section2" ? "section2" : "section1";
    const role = await currentRole();
    if (role !== "admin" && role !== section) {
      return NextResponse.json({ success: false, message: "Không có quyền gửi phản hồi cho Section này." }, { status: 403 });
    }

    const feedback = String(body.feedback ?? "").trim();

    if (body.website) return NextResponse.json({ success: true });
    if (!feedback || feedback.length > 2000) {
      return NextResponse.json({ success: false, message: "Nội dung phản hồi không hợp lệ." }, { status: 400 });
    }
    const profile = await currentLearnerProfile();
    if (!profile || profile.section !== section) {
      return NextResponse.json(
        { success: false, message: "Vui lòng hoàn tất thông tin học viên trước khi gửi phản hồi." },
        { status: 403 },
      );
    }

    const requestedAt = new Date(String(body.submittedAt ?? ""));
    const submittedAt = Number.isNaN(requestedAt.getTime()) ? new Date().toISOString() : requestedAt.toISOString();
    const { error } = await getSupabaseAdmin().from("feedback").insert({
      section,
      name: profile.name,
      email: profile.email,
      feedback,
      submitted_at: submittedAt,
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Quiz feedback API error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể gửi phản hồi." },
      { status: 500 },
    );
  }
}
