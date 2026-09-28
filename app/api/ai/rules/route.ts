import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  DEFAULT_FALLBACK_MESSAGE,
  DEFAULT_SYSTEM_PROMPT,
  getKnowledgeBaseRules,
  getOrCreateActiveKnowledgeBase,
} from "@/lib/ai/gemini";

export async function GET() {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền xem cấu hình quy tắc AI." },
        { status: 403 }
      );
    }

    const kb = await getOrCreateActiveKnowledgeBase();
    const rules = await getKnowledgeBaseRules(kb.id);

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error) {
    console.error("Error in GET /api/ai/rules:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi lấy quy tắc AI.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền cập nhật quy tắc AI." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const systemPrompt =
      typeof body.system_prompt === "string" && body.system_prompt.trim()
        ? body.system_prompt.trim()
        : DEFAULT_SYSTEM_PROMPT;

    const fallbackMessage =
      typeof body.fallback_message === "string" && body.fallback_message.trim()
        ? body.fallback_message.trim()
        : DEFAULT_FALLBACK_MESSAGE;

    const requireCitation =
      typeof body.require_citation === "boolean" ? body.require_citation : true;

    const kb = await getOrCreateActiveKnowledgeBase();
    const supabase = getSupabaseAdmin();

    const payload = {
      knowledge_base_id: kb.id,
      system_prompt: systemPrompt,
      fallback_message: fallbackMessage,
      require_citation: requireCitation,
      updated_at: new Date().toISOString(),
    };

    // Update by row id instead of relying on an optional database unique
    // constraint. This also works on installations created by older migrations.
    const { data: existing, error: findError } = await supabase
      .from("ai_rules")
      .select("id")
      .eq("knowledge_base_id", kb.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Error finding existing ai_rules row:", findError);
      return NextResponse.json(
        { success: false, message: "Không thể kiểm tra cấu hình AI hiện tại." },
        { status: 500 }
      );
    }

    const saveQuery = existing
      ? supabase.from("ai_rules").update(payload).eq("id", existing.id)
      : supabase.from("ai_rules").insert(payload);

    const { data: updated, error } = await saveQuery.select().single();

    if (error) {
      console.error("Error updating ai_rules:", error);
      return NextResponse.json(
        { success: false, message: "Không thể lưu quy tắc AI vào cơ sở dữ liệu." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rules: updated,
      message: "Đã lưu quy tắc AI thành công.",
    });
  } catch (error) {
    console.error("Error in POST /api/ai/rules:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi lưu quy tắc AI.",
      },
      { status: 500 }
    );
  }
}
