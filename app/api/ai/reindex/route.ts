import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGeminiClient, getOrCreateActiveKnowledgeBase } from "@/lib/ai/gemini";
import {
  indexDocumentChunks,
  invalidateCacheForKnowledgeBase,
  type ExtractedPage,
} from "@/lib/ai/retrieval";

export async function POST(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền re-index Knowledge Base." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
    const folder = typeof body.folder === "string" ? body.folder.trim() : "";
    const subfolder = typeof body.subfolder === "string" ? body.subfolder.trim() : "";

    const ai = getGeminiClient();
    const kb = await getOrCreateActiveKnowledgeBase(ai);
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("ai_documents")
      .select("*")
      .eq("knowledge_base_id", kb.id)
      .eq("status", "READY");

    if (documentId) {
      query = query.eq("id", documentId);
    } else {
      if (folder && folder.toLowerCase() !== "all") {
        query = query.eq("folder", folder);
      }
      if (subfolder) {
        query = query.eq("subfolder", subfolder);
      }
    }

    const { data: docs, error } = await query;
    if (error || !docs) {
      return NextResponse.json(
        { success: false, message: "Không thể lấy danh sách tài liệu cần re-index." },
        { status: 500 }
      );
    }

    if (docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Không có tài liệu nào cần re-index trong phạm vi đã chọn.",
        reindexedCount: 0,
      });
    }

    // Invalidate caches for this scope
    await invalidateCacheForKnowledgeBase(kb.id);

    let reindexedCount = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      try {
        const contentText = typeof doc.content_text === "string" ? doc.content_text : "";
        if (!contentText) {
          continue;
        }

        // Delete old chunks for this document
        await supabase.from("ai_document_chunks").delete().eq("document_id", doc.id);

        const pages: ExtractedPage[] = [{ page: null, text: contentText }];
        const docVersion = (typeof doc.version === "number" ? doc.version : 1) + 1;

        await indexDocumentChunks({
          ai,
          knowledgeBaseId: kb.id,
          documentId: doc.id,
          filename: doc.filename,
          folder: doc.folder || "Chung",
          subfolder: doc.subfolder || "",
          pages,
          documentVersion: docVersion,
          metadata: {
            size: doc.size,
            mimeType: doc.mime_type,
            reindexedAt: new Date().toISOString(),
          },
        });

        // Update version in ai_documents
        await supabase
          .from("ai_documents")
          .update({ version: docVersion })
          .eq("id", doc.id);

        reindexedCount++;
      } catch (docErr) {
        errors.push(`${doc.filename}: ${docErr instanceof Error ? docErr.message : String(docErr)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã re-index thành công ${reindexedCount}/${docs.length} tài liệu vào Supabase pgvector.`,
      reindexedCount,
      totalCount: docs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Re-index error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi server khi re-index.",
      },
      { status: 500 }
    );
  }
}

