import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGeminiClient, getOrCreateActiveKnowledgeBase } from "@/lib/ai/gemini";

export async function GET() {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập. Chỉ Admin được sử dụng AI Knowledge." },
        { status: 403 }
      );
    }

    const kb = await getOrCreateActiveKnowledgeBase();
    const supabase = getSupabaseAdmin();

    const { data: documents, error } = await supabase
      .from("ai_documents")
      .select("*")
      .eq("knowledge_base_id", kb.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching ai_documents:", error);
      return NextResponse.json(
        { success: false, message: "Không thể lấy danh sách tài liệu." },
        { status: 500 }
      );
    }

    const normalizedDocs = (documents ?? []).map((doc: Record<string, unknown>) => {
      let folder = typeof doc.folder === "string" ? doc.folder : "";
      if (!folder && typeof doc.gemini_file_name === "string" && doc.gemini_file_name.startsWith("folder:")) {
        folder = doc.gemini_file_name.slice(7);
      }
      return {
        ...doc,
        folder: folder.trim() || "Chung",
        subfolder: typeof doc.subfolder === "string" ? doc.subfolder.trim() : "",
      };
    });

    return NextResponse.json(
      {
        success: true,
        knowledgeBase: kb,
        documents: normalizedDocs,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error in GET /api/ai/documents:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi lấy danh sách tài liệu.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền đổi tên thư mục tài liệu." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const folder = typeof body.folder === "string" ? body.folder.trim() : "";
    const subfolder = typeof body.subfolder === "string" ? body.subfolder.trim() : "";
    const newName = typeof body.newName === "string" ? body.newName.trim() : "";

    if (!folder || folder.toLowerCase() === "all") {
      return NextResponse.json(
        { success: false, message: "Phải chọn một thư mục cụ thể để đổi tên." },
        { status: 400 }
      );
    }
    if (!newName || newName.length > 100 || /[\u0000-\u001f]/.test(newName)) {
      return NextResponse.json(
        { success: false, message: "Tên thư mục phải có từ 1 đến 100 ký tự hợp lệ." },
        { status: 400 }
      );
    }

    const kb = await getOrCreateActiveKnowledgeBase();
    const supabase = getSupabaseAdmin();
    const { data: updatedCount, error } = await supabase.rpc("rename_ai_document_scope", {
      filter_knowledge_base_id: kb.id,
      old_folder: folder,
      old_subfolder: subfolder,
      new_name: newName,
    });

    if (error) {
      console.error("Error renaming AI document scope:", error);
      const errorText = error.message || "";
      const isConflict = error.code === "23505" || errorText.toLowerCase().includes("đã tồn tại");
      const missingMigration =
        error.code === "PGRST202" || errorText.includes("rename_ai_document_scope");
      return NextResponse.json(
        {
          success: false,
          message: missingMigration
            ? "Database chưa hỗ trợ đổi tên folder. Hãy chạy migration 202609280005_ai_scope_rename.sql."
            : isConflict
              ? errorText
              : "Không thể đổi tên thư mục tài liệu.",
        },
        { status: isConflict ? 409 : 500 }
      );
    }

    const count = typeof updatedCount === "number" ? updatedCount : Number(updatedCount || 0);
    if (count === 0 && newName !== (subfolder || folder)) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài liệu trong thư mục cần đổi tên." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: count,
      folder: subfolder ? folder : newName,
      subfolder: subfolder ? newName : "",
      message: subfolder
        ? `Đã đổi tên folder nhỏ thành "${newName}".`
        : `Đã đổi tên thư mục thành "${newName}".`,
    });
  } catch (error) {
    console.error("Error in PATCH /api/ai/documents:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi đổi tên thư mục.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền xóa tài liệu theo thư mục." },
        { status: 403 }
      );
    }

    const folder = new URL(request.url).searchParams.get("folder")?.trim() || "";
    const subfolder = new URL(request.url).searchParams.get("subfolder")?.trim() || "";
    if (!folder || folder.toLowerCase() === "all") {
      return NextResponse.json(
        { success: false, message: "Phải chọn một thư mục cụ thể để xóa tài liệu." },
        { status: 400 }
      );
    }

    const kb = await getOrCreateActiveKnowledgeBase();
    const supabase = getSupabaseAdmin();
    let documentsQuery = supabase
      .from("ai_documents")
      .select("id, gemini_document_name, gemini_file_name, folder")
      .eq("knowledge_base_id", kb.id)
      .eq("folder", folder);
    if (subfolder) documentsQuery = documentsQuery.eq("subfolder", subfolder);
    let { data: documents, error: fetchError } = await documentsQuery;

    if (fetchError && !subfolder) {
      const fallbackResult = await supabase
        .from("ai_documents")
        .select("id, gemini_document_name, gemini_file_name")
        .eq("knowledge_base_id", kb.id)
        .eq("gemini_file_name", `folder:${folder}`);
      documents = (fallbackResult.data || []).map((document) => ({
        ...document,
        folder,
      }));
      fetchError = fallbackResult.error;
    }

    if (fetchError) {
      console.error("Error fetching documents for bulk deletion:", fetchError);
      return NextResponse.json(
        { success: false, message: "Không thể lấy danh sách tài liệu cần xóa." },
        { status: 500 }
      );
    }

    const rows = documents ?? [];
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: `Phạm vi "${subfolder ? `${folder} / ${subfolder}` : folder}" hiện không có tài liệu nào.`,
      });
    }

    const geminiDocumentNames = rows
      .map((document) => document.gemini_document_name)
      .filter((name): name is string => typeof name === "string" && name.length > 0);

    let geminiWarningCount = 0;
    if (geminiDocumentNames.length > 0) {
      const ai = getGeminiClient();
      const results = await Promise.allSettled(
        geminiDocumentNames.map((name) =>
          ai.fileSearchStores.documents.delete({ name, config: { force: true } })
        )
      );
      geminiWarningCount = results.filter((result) => result.status === "rejected").length;
      if (geminiWarningCount > 0) {
        console.warn(
          `Could not delete ${geminiWarningCount}/${geminiDocumentNames.length} documents from Gemini; database cleanup will continue.`
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("ai_documents")
      .delete()
      .in("id", rows.map((document) => document.id));

    if (deleteError) {
      console.error("Error bulk deleting ai_documents:", deleteError);
      return NextResponse.json(
        { success: false, message: `Không thể xóa tài liệu trong thư mục "${folder}" khỏi database.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: rows.length,
      geminiWarningCount,
      message:
        geminiWarningCount > 0
          ? `Đã xóa ${rows.length} tài liệu trong "${subfolder ? `${folder} / ${subfolder}` : folder}". ${geminiWarningCount} tài liệu trên Gemini đã không còn tồn tại hoặc không thể xóa lại.`
          : `Đã xóa ${rows.length} tài liệu trong "${subfolder ? `${folder} / ${subfolder}` : folder}".`,
    });
  } catch (error) {
    console.error("Error in DELETE /api/ai/documents:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi xóa tài liệu theo thư mục.",
      },
      { status: 500 }
    );
  }
}
