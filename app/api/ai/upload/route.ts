import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGeminiClient, getOrCreateActiveKnowledgeBase } from "@/lib/ai/gemini";
import type { AiKnowledgeBase } from "@/lib/ai/types";
import { indexDocumentChunks, type ExtractedPage } from "@/lib/ai/retrieval";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".md", ".doc", ".docx"]);
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

async function extractPdfPages(buffer: Buffer): Promise<ExtractedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const pages: ExtractedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push({ page: pageNumber, text });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages;
}

function resolveMimeType(fileName: string, mimeTypeFromClient: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt") return "text/plain";
  if (ext === ".md") return "text/markdown";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return mimeTypeFromClient || "application/octet-stream";
}

interface ProcessFileResult {
  filename: string;
  success: boolean;
  status: "READY" | "PROCESSING" | "ERROR";
  documentId?: string;
  error?: string;
  geminiDocumentName?: string | null;
}

async function processSingleFile(
  file: File,
  kb: AiKnowledgeBase,
  ai: ReturnType<typeof getGeminiClient>,
  folderName: string = "Chung",
  subfolderName: string = ""
): Promise<ProcessFileResult> {
  let tempFilePath: string | null = null;
  const supabase = getSupabaseAdmin();
  const ext = path.extname(file.name).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      filename: file.name,
      success: false,
      status: "ERROR",
      error: `Định dạng "${ext}" không được hỗ trợ. Chỉ chấp nhận .pdf, .txt, .md, .doc và .docx.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      filename: file.name,
      success: false,
      status: "ERROR",
      error: "Dung lượng vượt quá giới hạn 25MB.",
    };
  }

  const mimeType = resolveMimeType(file.name, file.type);

  // 1. Tạo bản ghi ban đầu ở trạng thái PROCESSING với folder
  const insertPayload: Record<string, unknown> = {
    knowledge_base_id: kb.id,
    filename: file.name,
    mime_type: mimeType,
    size: file.size,
    status: "PROCESSING",
    gemini_file_name: `folder:${folderName}`,
    file_search_folder: folderName,
    file_search_subfolder: subfolderName,
  };

  // A retry of a previously failed upload should replace its stale ERROR row
  // instead of leaving duplicate filenames in the document list.
  await supabase
    .from("ai_documents")
    .delete()
    .eq("knowledge_base_id", kb.id)
    .eq("filename", file.name)
    .eq("status", "ERROR");

  let { data: docRecord, error: dbError } = await supabase
    .from("ai_documents")
    .insert({ ...insertPayload, folder: folderName, subfolder: subfolderName })
    .select()
    .single();

  if (dbError && dbError.message?.toLowerCase().includes("file_search_")) {
    return {
      filename: file.name,
      success: false,
      status: "ERROR",
      error: "Database chưa hỗ trợ đổi tên folder an toàn. Hãy chạy migration 202609280005_ai_scope_rename.sql.",
    };
  }

  if (dbError && dbError.message?.toLowerCase().includes("subfolder")) {
    return {
      filename: file.name,
      success: false,
      status: "ERROR",
      error: "Database chưa có hỗ trợ folder nhỏ. Hãy chạy migration 202609280003_ai_subfolders.sql.",
    };
  }

  if (dbError && dbError.message?.toLowerCase().includes("folder")) {
    const fallbackRes = await supabase
      .from("ai_documents")
      .insert(insertPayload)
      .select()
      .single();
    docRecord = fallbackRes.data;
    dbError = fallbackRes.error;
  }

  if (dbError || !docRecord) {
    return {
      filename: file.name,
      success: false,
      status: "ERROR",
      error: "Không thể lưu metadata vào cơ sở dữ liệu.",
    };
  }

  try {
    // 2. Ghi file tạm ra ổ đĩa cho uploader của Gemini SDK
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeBaseName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");

    const uploadFileMimeType = mimeType;
    const bufferToUpload: Buffer = buffer;
    let extractedText: string | null = null;
    let extractedPages: ExtractedPage[] = [];

    if (ext === ".txt" || ext === ".md") {
      extractedText = buffer.toString("utf-8");
      extractedPages = [{ page: null, text: extractedText }];
      tempFilePath = path.join(
        os.tmpdir(),
        `eiu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeBaseName}`
      );
    } else {
      if (ext === ".pdf") {
        try {
          extractedPages = await extractPdfPages(buffer);
          extractedText = extractedPages
            .map((page) => `\n## Trang ${page.page}\n${page.text}`)
            .join("\n")
            .trim();
        } catch (pdfError) {
          console.warn(
            `Could not extract PDF text for ${file.name}; Gemini File Search will still index it:`,
            pdfError instanceof Error ? pdfError.message : pdfError
          );
        }
      }
      tempFilePath = path.join(
        os.tmpdir(),
        `eiu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeBaseName}`
      );
    }

    await fs.promises.writeFile(tempFilePath, bufferToUpload);

    // 3. Đưa file vào Gemini File Search Store
    const customMetadata = [
      { key: "folder", stringValue: folderName },
      { key: "filename", stringValue: file.name },
      { key: "subfolder", stringValue: subfolderName },
    ];
    const baseUploadConfig = {
      displayName: file.name,
      mimeType: uploadFileMimeType,
      customMetadata,
    };

    let operation: Awaited<
      ReturnType<typeof ai.fileSearchStores.uploadToFileSearchStore>
    > | Awaited<ReturnType<typeof ai.fileSearchStores.importFile>>;
    const isWordDocument = ext === ".doc" || ext === ".docx";

    if (isWordDocument) {
      // Gemini's direct File Search upload currently rejects valid Word MIME
      // types. Uploading through Files API and importing is the supported workaround.
      let uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: { displayName: file.name, mimeType: uploadFileMimeType },
      });
      const fileProcessingStartedAt = Date.now();
      while (
        uploadedFile.state === "PROCESSING" &&
        Date.now() - fileProcessingStartedAt < 45000
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!uploadedFile.name) break;
        uploadedFile = await ai.files.get({ name: uploadedFile.name });
      }
      if (!uploadedFile.name || uploadedFile.state === "FAILED") {
        throw new Error(
          uploadedFile.error?.message || "Gemini không thể xử lý file Word này."
        );
      }
      if (uploadedFile.state === "PROCESSING") {
        throw new Error("Gemini xử lý file Word quá thời gian cho phép. Vui lòng thử lại.");
      }

      try {
        operation = await ai.fileSearchStores.importFile({
          fileSearchStoreName: kb.gemini_store_name,
          fileName: uploadedFile.name,
          config: {
            customMetadata,
            chunkingConfig: {
              whiteSpaceConfig: {
                maxTokensPerChunk: 480,
                maxOverlapTokens: 80,
              },
            },
          },
        });
      } catch (importError) {
        const importErrorText =
          importError instanceof Error ? importError.message : JSON.stringify(importError);
        if (!importErrorText.toLowerCase().includes("chunking")) throw importError;
        operation = await ai.fileSearchStores.importFile({
          fileSearchStoreName: kb.gemini_store_name,
          fileName: uploadedFile.name,
          config: { customMetadata },
        });
      }
    } else {
      try {
        operation = await ai.fileSearchStores.uploadToFileSearchStore({
          fileSearchStoreName: kb.gemini_store_name,
          file: tempFilePath,
          config: {
            ...baseUploadConfig,
            chunkingConfig: {
              whiteSpaceConfig: {
                // Gemini currently accepts at most 512 tokens per chunk.
                maxTokensPerChunk: 480,
                maxOverlapTokens: 80,
              },
            },
          },
        });
      } catch (uploadError) {
        const uploadErrorText =
          uploadError instanceof Error ? uploadError.message : JSON.stringify(uploadError);
        if (!uploadErrorText.toLowerCase().includes("chunking")) throw uploadError;

        console.warn(
          `Custom chunking was rejected for ${file.name}; retrying with Gemini defaults.`
        );
        operation = await ai.fileSearchStores.uploadToFileSearchStore({
          fileSearchStoreName: kb.gemini_store_name,
          file: tempFilePath,
          config: baseUploadConfig,
        });
      }
    }

    // 4. Polling trạng thái hoàn thành (tối đa 45 giây/file)
    const startTime = Date.now();
    const maxWaitMs = 45000;
    while (!operation.done && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      operation = await ai.operations.get({ operation });
    }

    if (operation.done) {
      if (operation.error) {
        const errorMsg =
          typeof operation.error === "object" && operation.error !== null
            ? JSON.stringify(operation.error)
            : String(operation.error);

        await supabase
          .from("ai_documents")
          .update({
            status: "ERROR",
            error_message: errorMsg,
          })
          .eq("id", docRecord.id);

        return {
          filename: file.name,
          success: false,
          status: "ERROR",
          documentId: docRecord.id,
          error: `Gemini indexing error: ${errorMsg}`,
        };
      }

      const geminiDocName = operation.response?.documentName ?? null;
      const updateData: Record<string, unknown> = {
        status: "READY",
        gemini_document_name: geminiDocName,
        error_message: null,
      };

      if (extractedText) {
        updateData.content_text = extractedText;
      }

      const { error: updateErr } = await supabase
        .from("ai_documents")
        .update(updateData)
        .eq("id", docRecord.id);

      if (updateErr && updateErr.message?.toLowerCase().includes("content_text")) {
        delete updateData.content_text;
        await supabase.from("ai_documents").update(updateData).eq("id", docRecord.id);
      }

      if (extractedText && extractedPages.length === 0) {
        extractedPages = [{ page: null, text: extractedText }];
      }
      if (extractedPages.length > 0) {
        await indexDocumentChunks({
          ai,
          knowledgeBaseId: kb.id,
          documentId: docRecord.id,
          filename: file.name,
          folder: folderName,
          subfolder: subfolderName,
          pages: extractedPages,
        });
      }

      return {
        filename: file.name,
        success: true,
        status: "READY",
        documentId: docRecord.id,
        geminiDocumentName: geminiDocName,
      };
    }

    // Vẫn đang xử lý sau thời gian chờ -> Giữ status PROCESSING để polling phía sau
    return {
      filename: file.name,
      success: true,
      status: "PROCESSING",
      documentId: docRecord.id,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Lỗi không xác định khi upload.";
    await supabase
      .from("ai_documents")
      .update({
        status: "ERROR",
        error_message: errorMsg,
      })
      .eq("id", docRecord.id);

    return {
      filename: file.name,
      success: false,
      status: "ERROR",
      documentId: docRecord.id,
      error: errorMsg,
    };
  } finally {
    if (tempFilePath) {
      fs.promises.unlink(tempFilePath).catch(() => undefined);
    }
  }
}

export async function POST(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền tải lên tài liệu Knowledge Base." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const rawFolder = formData.get("folder");
    const folderName = typeof rawFolder === "string" && rawFolder.trim() ? rawFolder.trim() : "Chung";
    const rawSubfolder = formData.get("subfolder");
    const subfolderName =
      typeof rawSubfolder === "string" ? rawSubfolder.trim().slice(0, 100) : "";

    // Hỗ trợ cả trường "files" (nhiều file) lẫn "file" (1 file)
    const rawFiles: unknown[] = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ];

    const files = rawFiles.filter(
      (item): item is File => item instanceof File && item.size > 0
    );

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, message: "Vui lòng chọn ít nhất một tập tin hợp lệ (.pdf, .txt, .md, .doc, .docx)." },
        { status: 400 }
      );
    }

    const ai = getGeminiClient();
    const kb = await getOrCreateActiveKnowledgeBase(ai);

    // Xử lý song song các file được gửi lên kèm folder
    const results = await Promise.all(
      files.map((file) => processSingleFile(file, kb, ai, folderName, subfolderName))
    );

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Lấy lại danh sách tài liệu mới nhất
    const supabase = getSupabaseAdmin();
    const { data: updatedDocs } = await supabase
      .from("ai_documents")
      .select("*")
      .eq("knowledge_base_id", kb.id)
      .order("created_at", { ascending: false });

    const normalizedDocs = (updatedDocs ?? []).map((doc: Record<string, unknown>) => {
      let f = typeof doc.folder === "string" ? doc.folder : "";
      if (!f && typeof doc.gemini_file_name === "string" && doc.gemini_file_name.startsWith("folder:")) {
        f = doc.gemini_file_name.slice(7);
      }
      return {
        ...doc,
        folder: f.trim() || "Chung",
        subfolder: typeof doc.subfolder === "string" ? doc.subfolder.trim() : "",
      };
    });

    if (failed.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Đã tải lên và xử lý thành công toàn bộ ${succeeded.length} tài liệu vào ${
          subfolderName ? `folder "${folderName} / ${subfolderName}"` : `thư mục "${folderName}"`
        }.`,
        count: files.length,
        succeededCount: succeeded.length,
        failedCount: 0,
        results,
        documents: normalizedDocs,
        document: succeeded[0], // backward compatibility
        status: succeeded[0]?.status ?? "READY",
      });
    }

    if (succeeded.length === 0) {
      const errorSummaries = failed.map((f) => `${f.filename}: ${f.error}`).join("; ");
      return NextResponse.json(
        {
          success: false,
          message: `Tất cả file đều tải lên thất bại. Chi tiết: ${errorSummaries}`,
          count: files.length,
          succeededCount: 0,
          failedCount: failed.length,
          results,
        },
        { status: 400 }
      );
    }

    // Một số file thành công, một số file lỗi
    const errorSummaries = failed.map((f) => `${f.filename}: ${f.error}`).join("; ");
    return NextResponse.json({
      success: true,
      message: `Đã xử lý thành công ${succeeded.length}/${files.length} file. Các file lỗi: ${errorSummaries}`,
      count: files.length,
      succeededCount: succeeded.length,
      failedCount: failed.length,
      results,
      documents: updatedDocs ?? [],
      document: succeeded[0],
      status: succeeded[0]?.status ?? "READY",
    });
  } catch (error) {
    console.error("Batch upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi upload tài liệu.",
      },
      { status: 500 }
    );
  }
}
