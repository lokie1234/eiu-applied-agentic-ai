import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const HARDCODED_PASSWORD = "Lovekjng123@@";

export async function POST(request: Request) {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ tài khoản admin mới có quyền reset dữ liệu." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { password?: string };
    const password = body.password?.trim() || "";

    if (password !== HARDCODED_PASSWORD) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu xác thực không đúng. Không thể reset." },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Delete all records from all interactive tables
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from("learner_profiles").delete().neq("email", ""),
      supabase.from("ideas").delete().neq("id", ""),
      supabase.from("showcase_items").delete().neq("id", ""),
      supabase.from("quiz_results").delete().neq("id", ""),
      supabase.from("feedback").delete().neq("id", ""),
      supabase.from("presence_sessions").delete().neq("client_id", ""),
    ]);

    const errors = [r1.error, r2.error, r3.error, r4.error, r5.error, r6.error].filter(Boolean);
    if (errors.length > 0) {
      console.error("Reset data errors:", errors);
      throw new Error(errors[0]?.message || "Lỗi khi xóa dữ liệu trên Supabase.");
    }

    return NextResponse.json({
      success: true,
      message: "Đã xóa toàn bộ dữ liệu học viên và tương tác trên Supabase thành công.",
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
