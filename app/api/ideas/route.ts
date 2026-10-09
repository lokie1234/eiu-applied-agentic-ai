import { NextResponse } from "next/server";
import { currentRole, canFacilitateSection } from "@/lib/currentRole";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSectionSessionStartedAt } from "@/lib/sectionSession";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type IdeaRow = { id: string; idea: string; submitted_at: string };

function toItem(row: IdeaRow) {
  return { id: row.id, idea: row.idea, submittedAt: row.submitted_at };
}

export async function GET() {
  try {
    if (!(await canFacilitateSection("section1"))) {
      return NextResponse.json(
        { success: false, message: "Chỉ admin mới có quyền xem danh sách ý tưởng." },
        { status: 403 },
      );
    }

    const sessionStartedAt = await getSectionSessionStartedAt("section1");
    const { data, error } = await getSupabaseAdmin()
      .from("ideas")
      .select("id, idea, submitted_at")
      .eq("section", "section1")
      .gte("submitted_at", sessionStartedAt)
      .order("submitted_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    return NextResponse.json(
      { success: true, items: (data as IdeaRow[]).map(toItem) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Idea list error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể tải danh sách ý tưởng." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if ((await currentRole()) !== "section1") {
      return NextResponse.json(
        { success: false, message: "Chỉ phiên học viên Section 1 mới được gửi ý tưởng." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const idea = String(body.idea ?? "").trim();
    if (!idea || idea.length > 500) {
      return NextResponse.json(
        { success: false, message: "Ý tưởng phải có nội dung và không vượt quá 500 ký tự." },
        { status: 400 },
      );
    }

    const profile = await currentLearnerProfile();
    if (!profile) {
      return NextResponse.json(
        { success: false, message: "Vui lòng hoàn tất thông tin học viên trước khi gửi ý tưởng." },
        { status: 403 },
      );
    }

    const { error } = await getSupabaseAdmin().from("ideas").insert({
      section: "section1",
      name: profile.name,
      email: profile.email,
      idea,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Idea submit error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể gửi ý tưởng." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    if (!(await canFacilitateSection("section1"))) {
      return NextResponse.json(
        { success: false, message: "Chỉ admin mới có quyền xóa ý tưởng." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thao tác xóa trên slide chỉ ẩn dữ liệu cục bộ. Dữ liệu gốc chỉ được xóa bằng chức năng Reset dữ liệu.",
    });
  } catch (error) {
    console.error("Idea delete error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể xóa ý tưởng." },
      { status: 500 },
    );
  }
}
