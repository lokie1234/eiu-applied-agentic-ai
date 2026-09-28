import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  type AISource,
  cleanAiResponseText,
  generateContentWithRetryAndFallback,
  getGeminiClient,
  getGeminiModel,
  getKnowledgeBaseRules,
  getOrCreateActiveKnowledgeBase,
  isConversationalOrGreeting,
  isRetryableError,
  streamWithModelFallback,
} from "@/lib/ai/gemini";
import {
  chunksToContext,
  chunksToSources,
  createResponseCacheKey,
  getCachedAiAnswer,
  getSemanticCachedAiAnswer,
  normalizeQuery,
  retrieveDocumentChunks,
  setCachedAiAnswer,
  setSemanticCachedAiAnswer,
} from "@/lib/ai/retrieval";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

function escapeMetadataValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function POST(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin mới có quyền truy cập AI Chat." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];
    const isStream = Boolean(body.stream);
    const isFastMode = body.fastMode !== false;
    const selectedFolder =
      typeof body.folder === "string" ? body.folder.trim().slice(0, 100) : "";
    const selectedSubfolder =
      typeof body.subfolder === "string" ? body.subfolder.trim().slice(0, 100) : "";

    if (!message) {
      return NextResponse.json(
        { success: false, message: "Nội dung câu hỏi không được để trống." },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { success: false, message: "Câu hỏi vượt quá giới hạn 4000 ký tự." },
        { status: 400 }
      );
    }

    if (!selectedFolder || selectedFolder.toLowerCase() === "all") {
      return NextResponse.json(
        { success: false, message: "Vui lòng chọn một thư mục tài liệu trước khi đặt câu hỏi." },
        { status: 400 }
      );
    }

    const isGreeting = isConversationalOrGreeting(message);

    if (isGreeting && history.length === 0) {
      const greetingAnswer =
        "Xin chào! Tôi là Trợ lý AI EIU. Tôi sẵn sàng hỗ trợ bạn tra cứu thông tin trong các tài liệu nội bộ đã được thiết lập.";
      if (isStream) {
        return new Response(
          `data: ${JSON.stringify({ type: "replace", answer: greetingAnswer, sources: [] })}\n\n`,
          {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          }
        );
      }
      return NextResponse.json({ success: true, answer: greetingAnswer, sources: [] });
    }

    const ai = getGeminiClient();
    const kb = await getOrCreateActiveKnowledgeBase(ai);
    const rules = await getKnowledgeBaseRules(kb.id);
    const supabase = getSupabaseAdmin();

    // Check ready documents
    const readyDocsQuery = supabase
      .from("ai_documents")
      .select("filename, mime_type, created_at, gemini_file_name, file_search_folder, file_search_subfolder")
      .eq("knowledge_base_id", kb.id)
      .eq("status", "READY")
      .eq("folder", selectedFolder)
      .eq("subfolder", selectedSubfolder);
    let { data: readyDocs, error: docsError } = await readyDocsQuery;

    if (docsError && !selectedSubfolder) {
      const fallbackResult = await supabase
        .from("ai_documents")
        .select("filename, mime_type, created_at, gemini_file_name")
        .eq("knowledge_base_id", kb.id)
        .eq("status", "READY")
        .eq("gemini_file_name", `folder:${selectedFolder}`);
      readyDocs = (fallbackResult.data || []).map((document) => ({
        ...document,
        file_search_folder: null,
        file_search_subfolder: null,
      }));
      docsError = fallbackResult.error;
    }

    if (docsError) {
      console.error("Error fetching folder documents:", docsError.message);
    }

    readyDocs = (readyDocs || []).filter((document) =>
      /\.(pdf|txt|md|doc|docx)$/i.test(String(document.filename || ""))
    );

    const hasDocs = Boolean(readyDocs && readyDocs.length > 0);

    // If no documents and it's not a greeting, immediately return fallback
    if (!hasDocs && !isGreeting) {
      return NextResponse.json({
        success: true,
        answer: cleanAiResponseText(rules.fallback_message),
        sources: [],
      });
    }

    const queryNorm = normalizeQuery(message);

    const knowledgeVersion = `${selectedFolder}:${selectedSubfolder}:${readyDocs?.length || 0}:${(readyDocs || [])
      .map((document) => String(document.created_at || ""))
      .sort()
      .at(-1) || "empty"}`;

    const cacheKey = createResponseCacheKey({
      knowledgeBaseId: kb.id,
      knowledgeVersion,
      rulesVersion: rules.updated_at,
      message: queryNorm.normalizedQuery,
      folder: selectedFolder,
      subfolder: selectedSubfolder,
    });

    const mayUseResponseCache = history.length === 0;
    let hitCacheAnswer = mayUseResponseCache ? await getCachedAiAnswer(cacheKey) : null;

    if (!hitCacheAnswer && mayUseResponseCache && isFastMode) {
      hitCacheAnswer = await getSemanticCachedAiAnswer({
        ai,
        knowledgeBaseId: kb.id,
        folder: selectedFolder,
        subfolder: selectedSubfolder,
        query: queryNorm.normalizedQuery,
        similarityThreshold: 0.93,
      });
    }

    if (hitCacheAnswer) {
      const cleanedCached = cleanAiResponseText(hitCacheAnswer.answer);
      if (isStream) {
        return new Response(
          `data: ${JSON.stringify({
            type: "replace",
            answer: cleanedCached,
            sources: [],
            cached: true,
          })}\n\n`,
          {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          }
        );
      }
      return NextResponse.json({
        success: true,
        answer: cleanedCached,
        sources: [],
        cached: true,
      });
    }

    // Hybrid retrieval
    const vectorChunks = isFastMode
      ? await retrieveDocumentChunks({
          ai,
          knowledgeBaseId: kb.id,
          query: message,
          folder: selectedFolder,
          subfolder: selectedSubfolder,
          limit: 6,
        })
      : null;

    const hasConfidentVectorContext = Boolean(
      vectorChunks && vectorChunks.length > 0
    );
    const vectorSources = hasConfidentVectorContext ? chunksToSources(vectorChunks || []) : [];

    const fileSearchScopes = Array.from(
      new Map(
        (readyDocs || []).map((document) => {
          const legacyFolder = String(document.gemini_file_name || "").startsWith("folder:")
            ? String(document.gemini_file_name).slice(7)
            : selectedFolder;
          const folder = String(document.file_search_folder || legacyFolder);
          const subfolder = String(document.file_search_subfolder ?? selectedSubfolder);
          return [`${folder}\u0000${subfolder}`, { folder, subfolder }] as const;
        })
      ).values()
    );

    let inContextKnowledge = "";
    if (hasConfidentVectorContext && vectorChunks) {
      inContextKnowledge =
        "\n\n=== KNOWLEDGE CONTEXT ĐÃ TRUY XUẤT (TỐI ƯU KEYWORD + NỘI DUNG) ===\n" +
        chunksToContext(vectorChunks) +
        "\n\nQUY TẮC ĐỊNH DẠNG & TRÌNH BÀY (BẮT BUỘC):\n" +
        "1. Trả lời trực tiếp, rõ ràng, gãy gọn dựa trên tài liệu được cung cấp.\n" +
        "2. TUYỆT ĐỐI KHÔNG sử dụng ký tự sao (*) hoặc (**) trong câu trả lời (không in đậm bằng **, không dùng * ở đầu dòng).\n" +
        "3. Khi liệt kê danh sách hoặc gạch đầu dòng, chỉ sử dụng dấu gạch ngang (-) hoặc số thứ tự (1., 2., 3.).\n" +
        "4. KHÔNG đưa phần trích dẫn nguồn, căn cứ, tên file tài liệu hay mục 'NGUỒN:' vào nội dung câu trả lời gửi ra khung chat.\n" +
        "5. Giữ nguyên các keyword nghiệp vụ như: BHXH, BHYT, BHTN, TNCN, HĐLĐ, T20, 620, KPI, API và các mã tương tự.\n" +
        "6. Nếu context không đủ thông tin, trả lời rõ: \"" + rules.fallback_message + "\".\n";
    }

    const selectedScope = selectedSubfolder
      ? `${selectedFolder} / ${selectedSubfolder}`
      : selectedFolder;
    const folderInstruction = `\n\n=== PHẠM VI TRA CỨU: "${selectedScope}" ===\nChỉ tìm và trả lại nội dung hiện diện trong phạm vi "${selectedScope}". Không suy luận mở rộng, không diễn giải vượt quá câu chữ hoặc dữ kiện trong tài liệu, không lấy thông tin từ folder khác và không sử dụng kiến thức có sẵn của model. Nếu tài liệu không nêu trực tiếp câu trả lời, dùng đúng fallback message.`;
    const formatInstruction =
      "\n\n=== QUY TẮC ĐỊNH DẠNG KHUNG CHAT ===\n" +
      "- Tuyệt đối không dùng dấu sao (*) hoặc (**) trong câu trả lời. Dùng dấu gạch ngang (-) hoặc số (1., 2.) cho danh sách.\n" +
      "- Không ghi phần trích dẫn nguồn, căn cứ hay tên file tài liệu trong câu trả lời.";

    const effectiveSystemPrompt = `${rules.system_prompt}${folderInstruction}${formatInstruction}${
      inContextKnowledge
        ? `\n\n=== THỨ TỰ ƯU TIÊN ===\nCác quy tắc do Admin cấu hình ở trên luôn có mức ưu tiên cao nhất. Tài liệu bên dưới là dữ liệu thực tế:${inContextKnowledge}`
        : ""
    }`;

    // Skip remote File Search when the local vector index has a confident hit.
    // Otherwise keep it as the accuracy-preserving fallback.
    const toolsConfig = hasDocs && !hasConfidentVectorContext
      ? [
          {
            fileSearch: {
              fileSearchStoreNames: [kb.gemini_store_name],
              topK: 6,
              metadataFilter: fileSearchScopes
                .map(
                  (scope) =>
                    `(folder = "${escapeMetadataValue(scope.folder)}" AND subfolder = "${escapeMetadataValue(scope.subfolder)}")`
                )
                .join(" OR "),
            },
          },
        ]
      : undefined;

    const modelName = getGeminiModel();

    // Prepare contents array for Gemini
    const contents = [
      ...history
        .filter((h) => typeof h.text === "string" && h.text.trim().length > 0)
        .slice(-6)
        .map((h) => ({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text.trim() }],
        })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    // 1. STREAMING MODE (Server-Sent Events)
    if (isStream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const sources: AISource[] = [];
            const seen = new Set<string>();
            let finalUsedModel = modelName;
            let fullText = "";

            for await (const { chunk, usedModel } of streamWithModelFallback(ai, modelName, {
              contents,
              config: {
                systemInstruction: effectiveSystemPrompt,
                temperature: 0,
                maxOutputTokens: 900,
                tools: toolsConfig,
              },
            })) {
              finalUsedModel = usedModel;
              const chunkText = chunk.text || "";
              if (chunkText) {
                fullText += chunkText;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunkText })}\n\n`)
                );
              }

              const candidate = chunk.candidates?.[0];
              const groundingMetadata = candidate?.groundingMetadata;
              const groundingChunks = groundingMetadata?.groundingChunks || [];

              for (const gChunk of groundingChunks) {
                const docTitle =
                  gChunk.retrievedContext?.title ||
                  gChunk.web?.title ||
                  gChunk.retrievedContext?.uri ||
                  "";
                if (!docTitle) continue;
                const pageNumber = gChunk.retrievedContext?.pageNumber;
                const dedupeKey = `${docTitle}_${pageNumber ?? ""}`;
                if (!seen.has(dedupeKey)) {
                  seen.add(dedupeKey);
                  sources.push({
                    document: docTitle,
                    ...(pageNumber !== undefined && pageNumber !== null ? { page: pageNumber } : {}),
                  });
                }
              }
            }

            // Extract in-memory sources if File Search grounding was empty
            let finalSources = sources;
            if (finalSources.length === 0 && vectorSources.length > 0) {
              finalSources = vectorSources;
            }

            // SERVER-SIDE GUARD FOR STREAMING:
            if (rules.require_citation && finalSources.length === 0 && !isGreeting) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "replace",
                    answer: cleanAiResponseText(rules.fallback_message),
                    sources: [],
                  })}\n\n`
                )
              );
            } else {
              const cleanedText = cleanAiResponseText(fullText);

              if (mayUseResponseCache) {
                await Promise.allSettled([
                  setCachedAiAnswer(cacheKey, cleanedText, finalSources, kb.id),
                  setSemanticCachedAiAnswer({
                    ai,
                    cacheKey,
                    knowledgeBaseId: kb.id,
                    folder: selectedFolder,
                    subfolder: selectedSubfolder,
                    queryText: message,
                    normalizedQuery: queryNorm.normalizedQuery,
                    answer: cleanedText,
                    sources: finalSources,
                  }),
                ]);
              }

              // Emit replace event with sanitized text if asterisks were stripped
              if (cleanedText !== fullText) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "replace",
                      answer: cleanedText,
                      sources: [],
                    })}\n\n`
                  )
                );
              }

              // Done event without sending sources to chat
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "done",
                    sources: [],
                    usedModel: finalUsedModel,
                  })}\n\n`
                )
              );
            }
            controller.close();
          } catch (streamErr) {
            console.error("Error in streaming chat:", streamErr);
            const isOverload = isRetryableError(streamErr);
            const friendlyMsg = isOverload
              ? "Hệ thống máy chủ AI của Google đang bị quá tải tạm thời (Spike in demand). Vui lòng thử lại sau vài giây."
              : streamErr instanceof Error
              ? streamErr.message
              : "Đã xảy ra lỗi khi tạo phản hồi AI.";

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: friendlyMsg })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // 2. NON-STREAMING MODE (Standard JSON response)
    const { response } = await generateContentWithRetryAndFallback(
      ai,
      modelName,
      {
        contents,
        config: {
          systemInstruction: effectiveSystemPrompt,
          temperature: 0,
          maxOutputTokens: 900,
          tools: toolsConfig,
        },
      }
    );

    const candidate = response.candidates?.[0];
    const rawAnswer = response.text?.trim() || "";
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    const sources: AISource[] = [];
    const seen = new Set<string>();

    for (const chunk of groundingChunks) {
      const docTitle =
        chunk.retrievedContext?.title ||
        chunk.web?.title ||
        chunk.retrievedContext?.uri ||
        "";

      if (!docTitle) continue;

      const pageNumber = chunk.retrievedContext?.pageNumber;
      const dedupeKey = `${docTitle}_${pageNumber ?? ""}`;

      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        sources.push({
          document: docTitle,
          ...(pageNumber !== undefined && pageNumber !== null ? { page: pageNumber } : {}),
        });
      }
    }

    let finalSources = sources;
    if (finalSources.length === 0 && vectorSources.length > 0) {
      finalSources = vectorSources;
    }

    if (rules.require_citation && finalSources.length === 0 && !isGreeting) {
      return NextResponse.json({
        success: true,
        answer: cleanAiResponseText(rules.fallback_message),
        sources: [],
      });
    }

    const cleanedAnswer = cleanAiResponseText(rawAnswer);

    if (mayUseResponseCache && cleanedAnswer) {
      await Promise.allSettled([
        setCachedAiAnswer(cacheKey, cleanedAnswer, finalSources, kb.id),
        setSemanticCachedAiAnswer({
          ai,
          cacheKey,
          knowledgeBaseId: kb.id,
          folder: selectedFolder,
          subfolder: selectedSubfolder,
          queryText: message,
          normalizedQuery: queryNorm.normalizedQuery,
          answer: cleanedAnswer,
          sources: finalSources,
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      answer: cleanedAnswer || cleanAiResponseText(rules.fallback_message),
      sources: [],
    });
  } catch (error) {
    console.error("Error in POST /api/ai/chat:", error);
    const isOverload = isRetryableError(error);
    const friendlyMessage = isOverload
      ? "Hệ thống máy chủ AI của Google đang bị quá tải tạm thời (Spike in demand). Vui lòng thử lại sau vài giây."
      : error instanceof Error
      ? error.message
      : "Đã xảy ra lỗi khi tạo phản hồi AI.";

    return NextResponse.json(
      {
        success: false,
        message: friendlyMessage,
      },
      { status: isOverload ? 503 : 500 }
    );
  }
}

