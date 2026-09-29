import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const HARDCODED_PASSWORD = "Lovekjng123@@";

function formatSectionLabel(section: string): string {
  const match = section.match(/^section\s*(\d+)$/i);
  return match ? `Section ${match[1]}` : section;
}

export async function POST(request: Request) {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ tài khoản admin mới có quyền reset dữ liệu." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
      section?: string;
    };
    const password = body.password?.trim() || "";
    const requestedSection = body.section?.trim().toLowerCase() || "all";

    if (password !== HARDCODED_PASSWORD) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu xác thực không đúng. Không thể reset." },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();

    if (requestedSection !== "all") {
      const { data: configuredSection, error: sectionError } = await supabase
        .from("section_state")
        .select("section")
        .eq("section", requestedSection)
        .maybeSingle();

      if (sectionError) throw sectionError;
      if (!configuredSection) {
        return NextResponse.json(
          { success: false, message: "Section được chọn không tồn tại trong hệ thống." },
          { status: 400 },
        );
      }
    }

    const learnerDelete = supabase.from("learner_profiles").delete();
    const ideasDelete = supabase.from("ideas").delete();
    const showcaseDelete = supabase.from("showcase_items").delete();
    const quizDelete = supabase.from("quiz_results").delete();
    const feedbackDelete = supabase.from("feedback").delete();
    const presenceDelete = supabase.from("presence_sessions").delete();
    const sectionStateUpdate = supabase.from("section_state").update({
      quiz_open: false,
      quiz_opened_at: null,
      session_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const resetAll = requestedSection === "all";
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      resetAll
        ? learnerDelete.neq("email", "")
        : learnerDelete.eq("section", requestedSection),
      resetAll ? ideasDelete.neq("id", "") : ideasDelete.eq("section", requestedSection),
      resetAll
        ? showcaseDelete.neq("id", "")
        : showcaseDelete.eq("section", requestedSection),
      resetAll ? quizDelete.neq("id", "") : quizDelete.eq("section", requestedSection),
      resetAll
        ? feedbackDelete.neq("id", "")
        : feedbackDelete.eq("section", requestedSection),
      resetAll
        ? presenceDelete.neq("client_id", "")
        : presenceDelete.eq("section", requestedSection),
      resetAll
        ? sectionStateUpdate.neq("section", "")
        : sectionStateUpdate.eq("section", requestedSection),
    ]);

    const errors = [r1.error, r2.error, r3.error, r4.error, r5.error, r6.error, r7.error].filter(Boolean);
    if (errors.length > 0) {
      console.error("Reset data errors:", errors);
      throw new Error(errors[0]?.message || "Lỗi khi xóa dữ liệu trên Supabase.");
    }

    const scopeLabel = resetAll ? "tất cả Section" : formatSectionLabel(requestedSection);
    return NextResponse.json({
      success: true,
      message: `Đã xóa dữ liệu của ${scopeLabel} trên Supabase thành công.`,
    });
  } catch (error) {
    console.error("Reset data API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Không thể xóa dữ liệu.",
      },
      { status: 500 },
    );
  }
}
