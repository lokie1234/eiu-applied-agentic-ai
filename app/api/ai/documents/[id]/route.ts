import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/ai/gemini";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền xóa tài liệu Knowledge Base." },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Thiếu ID tài liệu cần xóa." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: document, error: fetchError } = await supabase
      .from("ai_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !document) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài liệu trong hệ thống." },
        { status: 404 }
      );
    }

    // Attempt to delete from Gemini File Search Store if document resource name exists
    if (document.gemini_document_name) {
      try {
        const ai = getGeminiClient();
        await ai.fileSearchStores.documents.delete({
          name: document.gemini_document_name,
          config: { force: true },
        });
      } catch (geminiError) {
        console.warn(
          "Warning: Could not delete document from Gemini store (may already be deleted):",
          geminiError
        );
      }
    }

    // Delete record from Supabase
    const { error: deleteError } = await supabase
      .from("ai_documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting document record from Supabase:", deleteError);
      return NextResponse.json(
        { success: false, message: "Không thể xóa tài liệu khỏi database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đã xóa tài liệu khỏi Knowledge Base thành công.",
    });
  } catch (error) {
    console.error("Error in DELETE /api/ai/documents/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi xóa tài liệu.",
      },
      { status: 500 }
    );
  }
}
