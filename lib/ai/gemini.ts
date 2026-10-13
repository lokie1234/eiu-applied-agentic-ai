import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  type AiKnowledgeBase,
  type AiRules,
  DEFAULT_FALLBACK_MESSAGE,
  DEFAULT_SYSTEM_PROMPT,
} from "./types";

export type { AISource } from "./types";
export { DEFAULT_FALLBACK_MESSAGE, DEFAULT_SYSTEM_PROMPT, cleanAiResponseText } from "./types";

let genAiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào .env.local hoặc Vercel Environment Variables.",
    );
  }

  if (!genAiClient) {
    genAiClient = new GoogleGenAI({ apiKey });
  }
  return genAiClient;
}

export function getGeminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim();
  // gemini-3.6-flash has the highest stability and free tier quota capacity
  if (!model || model === "gemini-2.5-flash" || model === "gemini-3.8-flash") {
    return "gemini-3.6-flash";
  }
  return model;
}

function isAuthError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object"
      ? JSON.stringify(error)
      : String(error);
  return (
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid") ||
    message.includes("PERMISSION_DENIED")
  );
}

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object"
      ? JSON.stringify(error)
      : String(error);

  const lower = message.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("429") ||
    lower.includes("unavailable") ||
    lower.includes("high demand") ||
    lower.includes("spikes in demand") ||
    lower.includes("try again later") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout")
  );
}

export type GenerateContentParams = Omit<
  Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  "model"
>;

type GenerateContentOutput = Awaited<
  ReturnType<GoogleGenAI["models"]["generateContent"]>
>;

export interface GenerateContentResult {
  response: GenerateContentOutput;
  usedModel: string;
}

/**
 * Executes generateContent with automatic retry on transient errors (503/429/spikes in demand)
 * and seamless fallback across validated flash models.
 */
export async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const candidates = Array.from(
    new Set([
      primaryModel,
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ])
  );

  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return { response, usedModel: model };
    } catch (err) {
      lastError = err;
      console.warn(
        `[Gemini API] Model "${model}" failed, failing over to next candidate:`,
        err instanceof Error ? err.message : err
      );

      if (isAuthError(err)) {
        throw err;
      }

      // If not retryable/failoverable, stop
      if (!isRetryableError(err)) {
        break;
      }
    }
  }

  throw lastError;
}

export interface StreamChunkResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunk: any;
  usedModel: string;
}

/**
 * Executes generateContentStream with seamless model fallback.
 * Automatically catches quota/spikes/demand errors during both initialization
 * and stream iteration, seamlessly failing over to alternative models.
 */
export async function* streamWithModelFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  params: GenerateContentParams
): AsyncGenerator<StreamChunkResult, void, unknown> {
  const candidates = Array.from(
    new Set([
      primaryModel,
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ])
  );

  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const stream = await ai.models.generateContentStream({
        ...params,
        model,
      });

      for await (const chunk of stream) {
        yield { chunk, usedModel: model };
      }
      return;
    } catch (err) {
      lastError = err;
      console.warn(
        `[Gemini API Stream] Model "${model}" failed, failing over to next candidate:`,
        err instanceof Error ? err.message : err
      );

      if (isAuthError(err)) {
        throw err;
      }

      if (!isRetryableError(err)) {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Detects common courteous greetings or casual pleasantries
 * so they are not rejected by strict citation checks.
 */
export function isConversationalOrGreeting(text: string): boolean {
  if (!text) return false;
  const clean = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const exactPatterns = [
    /^(hi|hello|hey|helo|alo|alô)$/i,
    /^(chao|xin chao|chao ban|chao ad|chao bot|chao anh|chao chi|chao em)$/i,
    /^(good morning|good afternoon|good evening|good night)$/i,
    /^(cam on|cam on ban|cam on nhieu|thank|thanks|thank you|thank you so much)$/i,
    /^(ban la ai|ban ten gi|ban co the lam gi|ban giup duoc gi|ban la gi|who are you|what can you do)$/i,
    /^(tam biet|bye|goodbye|see you|hen gap lai)$/i,
    /^(tro giup|help|huong dan|huong dan su dung)$/i,
  ];

  if (exactPatterns.some((pattern) => pattern.test(clean))) {
    return true;
  }

  if (clean.length <= 40) {
    if (
      clean.startsWith("chao ") ||
      clean.startsWith("xin chao") ||
      clean.startsWith("hi ") ||
      clean.startsWith("hello ") ||
      clean.startsWith("cam on ") ||
      clean.includes("ban la ai") ||
      clean.includes("ban co the giup")
    ) {
      return true;
    }
  }

  return false;
}

export async function getOrCreateActiveKnowledgeBase(
  client?: GoogleGenAI,
): Promise<AiKnowledgeBase> {
  const supabase = getSupabaseAdmin();

  // Check if active KB already exists in DB
  const { data: existing, error: fetchError } = await supabase
    .from("ai_knowledge_bases")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching ai_knowledge_bases:", fetchError);
    throw new Error("Không thể truy xuất cơ sở dữ liệu Knowledge Base.");
  }

  const ai = client || getGeminiClient();

  if (existing) {
    const envStore = process.env.GEMINI_FILE_SEARCH_STORE?.trim();
    if (envStore && existing.gemini_store_name !== envStore) {
      const { data: updated } = await supabase
        .from("ai_knowledge_bases")
        .update({ gemini_store_name: envStore, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      return updated as AiKnowledgeBase;
    }
    return existing as AiKnowledgeBase;
  }

  // Create new Gemini File Search Store or use ENV
  let geminiStoreName = process.env.GEMINI_FILE_SEARCH_STORE?.trim();
  if (!geminiStoreName) {
    try {
      const store = await ai.fileSearchStores.create({
        config: { displayName: "eiu-knowledge-base" },
      });
      if (!store.name) {
        throw new Error("Gemini API không trả về tên store sau khi khởi tạo.");
      }
      geminiStoreName = store.name;
    } catch (createErr) {
      console.error("Failed to create Gemini File Search Store:", createErr);
      throw new Error(
        createErr instanceof Error
          ? createErr.message
          : "Không thể tạo Gemini File Search Store.",
      );
    }
  }

  // Insert into DB
  const { data: createdKb, error: insertKbError } = await supabase
    .from("ai_knowledge_bases")
    .insert({
      name: "default",
      gemini_store_name: geminiStoreName,
      active: true,
    })
    .select()
    .single();

  if (insertKbError || !createdKb) {
    console.error("Error creating ai_knowledge_bases row:", insertKbError);
    throw new Error("Không thể lưu thông tin Knowledge Base vào Supabase.");
  }

  // Seed default rules
  await supabase.from("ai_rules").insert({
    knowledge_base_id: createdKb.id,
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    fallback_message: DEFAULT_FALLBACK_MESSAGE,
    require_citation: true,
  });

  return createdKb as AiKnowledgeBase;
}

export async function getKnowledgeBaseRules(
  knowledgeBaseId: string,
): Promise<AiRules> {
  const supabase = getSupabaseAdmin();
  const { data: rules, error } = await supabase
    .from("ai_rules")
    .select("*")
    .eq("knowledge_base_id", knowledgeBaseId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching ai_rules:", error);
  }

  if (rules) {
    return rules as AiRules;
  }

  // Insert default rules if not found
  const { data: newRules } = await supabase
    .from("ai_rules")
    .insert({
      knowledge_base_id: knowledgeBaseId,
      system_prompt: DEFAULT_SYSTEM_PROMPT,
      fallback_message: DEFAULT_FALLBACK_MESSAGE,
      require_citation: true,
    })
    .select()
    .single();

  return (
    (newRules as AiRules) || {
      id: "default",
      knowledge_base_id: knowledgeBaseId,
      system_prompt: DEFAULT_SYSTEM_PROMPT,
      fallback_message: DEFAULT_FALLBACK_MESSAGE,
      require_citation: true,
      updated_at: new Date().toISOString(),
    }
  );
}
