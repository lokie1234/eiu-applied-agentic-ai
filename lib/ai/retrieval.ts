import "server-only";
import crypto from "node:crypto";
import type { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AISource, NormalizedQuery, RetrievedChunk } from "./types";

export type { NormalizedQuery, RetrievedChunk };

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_MAX_CHARS = 3_200;
const CHUNK_OVERLAP_CHARS = 420;
const MAX_CHUNKS_PER_DOCUMENT = 120;
const EMBEDDING_BATCH_SIZE = 16;

let vectorStorageAvailable: boolean | null = null;
let responseCacheStorageAvailable: boolean | null = null;
let semanticCacheStorageAvailable: boolean | null = null;

export interface CachedAiAnswer {
  answer: string;
  sources: AISource[];
  expiresAt: number;
}

const memoryAnswerCache = new Map<string, CachedAiAnswer>();
const RESPONSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 200;

export interface ExtractedPage {
  page: number | null;
  text: string;
}

/**
 * Normalizes user question and extracts business keywords and exact phrases.
 * Preserves critical acronyms (BHXH, BHTN, TNCN, HĐLĐ, T20, 620, KPI, API),
 * dates, numbers, and form codes without stripping them.
 */
export function normalizeQuery(rawQuery: string): NormalizedQuery {
  const original = (rawQuery || "").trim();
  const collapsed = original.normalize("NFC").replace(/\s+/g, " ");

  const conversationalPrefixes = [
    /^(tôi\s+muốn\s+(hỏi|biết|tìm\s+hiểu|tra\s+cứu))\s+(về\s+|thông\s+tin\s+về\s+)?/i,
    /^(cho\s+(tôi|mình|em)\s+(hỏi|biết))\s+(về\s+|thông\s+tin\s+về\s+)?/i,
    /^(xin\s+(hỏi|cho\s+biết))\s+(về\s+)?/i,
    /^(làm\s+ơn\s+cho\s+(tôi|mình)\s+biết)\s+(về\s+)?/i,
    /^(bạn\s+có\s+thể\s+(cho\s+biết|nói\s+về|giải\s+thích))\s+/i,
    /^(vui\s+lòng\s+cho\s+biết)\s+/i,
    /^(ad\s+cho\s+(mình|em)\s+hỏi)\s+/i,
  ];

  let search = collapsed;
  for (const prefix of conversationalPrefixes) {
    if (prefix.test(search)) {
      search = search.replace(prefix, "").trim();
      break;
    }
  }
  if (!search || search.length < 2) {
    search = collapsed;
  }

  const exactPhrases: string[] = [];
  const lowerSearch = search.toLowerCase();

  const knownPhrases = [
    "báo giảm", "báo tăng", "chấm dứt hợp đồng", "nghỉ việc", "thôi việc",
    "hợp đồng lao động", "thử việc", "bảo hiểm xã hội", "bảo hiểm y tế",
    "thuế thu nhập cá nhân", "chương trình đào tạo", "học phí", "tín chỉ",
    "môn học", "điều kiện tiên quyết", "đồ án tốt nghiệp", "khóa luận",
    "thực tập", "quy chế đào tạo", "chuẩn đầu ra",
  ];

  for (const kp of knownPhrases) {
    if (lowerSearch.includes(kp)) {
      exactPhrases.push(kp);
    }
  }

  // Match months/dates: "tháng 9", "tháng 09/2026", "16/09/2026"
  const dateMatches = search.match(/(tháng\s+\d{1,2}(\/\d{2,4})?|năm\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/gi);
  if (dateMatches) {
    for (const dm of dateMatches) {
      if (!exactPhrases.includes(dm.trim().toLowerCase())) {
        exactPhrases.push(dm.trim());
      }
    }
  }

  // Match legal references: "Điều 10", "Khoản 2", "Mục 3.2"
  const legalMatches = search.match(/(điều\s+\d+|khoản\s+\d+|mục\s+\d+(\.\d+)?|mẫu\s+[a-z0-9_-]+)/gi);
  if (legalMatches) {
    for (const lm of legalMatches) {
      if (!exactPhrases.includes(lm.trim().toLowerCase())) {
        exactPhrases.push(lm.trim());
      }
    }
  }

  const keywordsSet = new Set<string>();
  for (const p of exactPhrases) keywordsSet.add(p);

  const businessTerms = [
    "BHXH", "BHYT", "BHTN", "TNCN", "TNDN", "HĐLĐ", "HDLD", "KPI", "OKR",
    "API", "AI", "RAG", "LLM", "EIU", "MIS", "MKTG", "BUS", "STA", "FIN", "ACC", "CSE"
  ];
  for (const term of businessTerms) {
    if (new RegExp(`\\b${term}\\b`, "i").test(search)) {
      keywordsSet.add(term);
    }
  }

  // Alphanumeric codes: "620", "T20", "MIS 301", "BUS 214"
  const codeMatches = search.match(/\b([A-Z]{2,6}\s*\d{2,4}|\d{2,4}[A-Z]{1,4}|[A-Z]\d{2,4}|\d{3,6})\b/g);
  if (codeMatches) {
    for (const cm of codeMatches) keywordsSet.add(cm.trim());
  }

  // Word tokens skipping trivial particles
  const stopwords = new Set(["và", "hoặc", "của", "cho", "ở", "tại", "với", "như", "là", "các", "những", "gì", "sao", "thế", "được", "có", "không", "khi", "nếu", "để"]);
  const words = search
    .replace(/[^\w\s/.-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopwords.has(w.toLowerCase()));

  for (const w of words) keywordsSet.add(w);

  return {
    originalQuery: original,
    normalizedQuery: collapsed.toLowerCase(),
    searchQuery: search,
    keywords: Array.from(keywordsSet),
    exactPhrases,
  };
}

export function createResponseCacheKey(params: {
  knowledgeBaseId: string;
  knowledgeVersion: string;
  rulesVersion: string;
  message: string;
  folder?: string;
  subfolder?: string;
}): string {
  const normalizedMessage = params.message
    .toLocaleLowerCase("vi")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
  return crypto
    .createHash("sha256")
    .update(
      `${params.knowledgeBaseId}\n${params.folder || ""}\n${params.subfolder || ""}\n${params.knowledgeVersion}\n${params.rulesVersion}\n${normalizedMessage}`
    )
    .digest("hex");
}

export async function getCachedAiAnswer(cacheKey: string): Promise<CachedAiAnswer | null> {
  const now = Date.now();
  const memoryHit = memoryAnswerCache.get(cacheKey);
  if (memoryHit) {
    if (memoryHit.expiresAt > now) return memoryHit;
    memoryAnswerCache.delete(cacheKey);
  }

  if (responseCacheStorageAvailable === false) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ai_response_cache")
    .select("answer, sources, expires_at")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date(now).toISOString())
    .maybeSingle();
  if (error) {
    responseCacheStorageAvailable = false;
    return null;
  }
  responseCacheStorageAvailable = true;
  if (!data) return null;

  const cached: CachedAiAnswer = {
    answer: String(data.answer || ""),
    sources: Array.isArray(data.sources) ? (data.sources as AISource[]) : [],
    expiresAt: new Date(data.expires_at).getTime(),
  };
  memoryAnswerCache.set(cacheKey, cached);
  return cached;
}

export async function setCachedAiAnswer(
  cacheKey: string,
  answer: string,
  sources: AISource[],
  knowledgeBaseId: string
): Promise<void> {
  if (!answer.trim()) return;
  const expiresAt = Date.now() + RESPONSE_CACHE_TTL_MS;
  if (memoryAnswerCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryAnswerCache.keys().next().value;
    if (oldestKey) memoryAnswerCache.delete(oldestKey);
  }
  memoryAnswerCache.set(cacheKey, { answer, sources, expiresAt });

  if (responseCacheStorageAvailable === false) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ai_response_cache").upsert({
    cache_key: cacheKey,
    knowledge_base_id: knowledgeBaseId,
    answer,
    sources,
    expires_at: new Date(expiresAt).toISOString(),
    created_at: new Date().toISOString(),
  });
  responseCacheStorageAvailable = !error;
}

export async function invalidateCacheForKnowledgeBase(knowledgeBaseId: string): Promise<void> {
  memoryAnswerCache.clear();
  const supabase = getSupabaseAdmin();
  try {
    await Promise.allSettled([
      supabase.from("ai_response_cache").delete().eq("knowledge_base_id", knowledgeBaseId),
      supabase.from("ai_semantic_cache").delete().eq("knowledge_base_id", knowledgeBaseId),
    ]);
  } catch {
    // ignore
  }
}

export async function getSemanticCachedAiAnswer(params: {
  ai: GoogleGenAI;
  knowledgeBaseId: string;
  folder: string;
  subfolder?: string;
  query: string;
  similarityThreshold?: number;
}): Promise<CachedAiAnswer | null> {
  if (semanticCacheStorageAvailable === false) return null;
  const threshold = params.similarityThreshold ?? 0.93;
  const supabase = getSupabaseAdmin();
  try {
    const [queryEmbedding] = await embedTexts(
      params.ai,
      [params.query],
      "RETRIEVAL_QUERY"
    );

    const { data, error } = await supabase.rpc("match_ai_semantic_cache", {
      query_embedding: queryEmbedding,
      filter_knowledge_base_id: params.knowledgeBaseId,
      filter_folder: params.folder,
      filter_subfolder: params.subfolder || "",
      similarity_threshold: threshold,
    });

    if (error) {
      semanticCacheStorageAvailable = false;
      return null;
    }
    semanticCacheStorageAvailable = true;

    if (data && data.length > 0) {
      const match = data[0];
      return {
        answer: String(match.answer || ""),
        sources: Array.isArray(match.sources) ? (match.sources as AISource[]) : [],
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      };
    }
    return null;
  } catch (err) {
    console.warn("Semantic cache check error:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setSemanticCachedAiAnswer(params: {
  ai: GoogleGenAI;
  cacheKey: string;
  knowledgeBaseId: string;
  folder: string;
  subfolder?: string;
  queryText: string;
  normalizedQuery: string;
  answer: string;
  sources: AISource[];
}): Promise<void> {
  if (semanticCacheStorageAvailable === false || !params.answer.trim()) return;
  const supabase = getSupabaseAdmin();
  try {
    const [queryEmbedding] = await embedTexts(
      params.ai,
      [params.normalizedQuery || params.queryText],
      "RETRIEVAL_QUERY"
    );
    const expiresAt = new Date(Date.now() + RESPONSE_CACHE_TTL_MS).toISOString();

    const { error } = await supabase.from("ai_semantic_cache").upsert({
      cache_key: params.cacheKey,
      knowledge_base_id: params.knowledgeBaseId,
      folder: params.folder,
      subfolder: params.subfolder || "",
      query_text: params.queryText,
      normalized_query: params.normalizedQuery,
      embedding: queryEmbedding,
      answer: params.answer,
      sources: params.sources,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

    if (error) {
      semanticCacheStorageAvailable = false;
    } else {
      semanticCacheStorageAvailable = true;
    }
  } catch {
    // Non-fatal if semantic cache write fails
  }
}

function splitLongText(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + maxChars, text.length);
    if (end < text.length) {
      const breakAt = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf("; ", end)
      );
      if (breakAt > cursor + Math.floor(maxChars * 0.55)) end = breakAt + 1;
    }
    const part = text.slice(cursor, end).trim();
    if (part) parts.push(part);
    if (end >= text.length) break;
    cursor = Math.max(end - CHUNK_OVERLAP_CHARS, cursor + 1);
  }
  return parts;
}

function chunkExtractedPages(pages: ExtractedPage[]): ExtractedPage[] {
  const chunks: ExtractedPage[] = [];
  for (const page of pages) {
    const cleanText = page.text.replace(/\s+/g, " ").trim();
    if (!cleanText) continue;
    for (const content of splitLongText(cleanText, CHUNK_MAX_CHARS)) {
      chunks.push({ page: page.page, text: content });
      if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) return chunks;
    }
  }
  return chunks;
}

async function embedTexts(
  ai: GoogleGenAI,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  title?: string
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: {
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
        ...(taskType === "RETRIEVAL_DOCUMENT" && title ? { title } : {}),
      },
    });
    const values = response.embeddings?.map((embedding) => embedding.values || []) || [];
    if (values.length !== batch.length || values.some((embedding) => embedding.length === 0)) {
      throw new Error("Gemini không trả về đầy đủ embeddings cho các đoạn tài liệu.");
    }
    allEmbeddings.push(...values);
  }
  return allEmbeddings;
}

export async function indexDocumentChunks(params: {
  ai: GoogleGenAI;
  knowledgeBaseId: string;
  documentId: string;
  filename: string;
  folder: string;
  subfolder: string;
  pages: ExtractedPage[];
  documentVersion?: number;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (vectorStorageAvailable === false) return false;
  const chunks = chunkExtractedPages(params.pages);
  if (chunks.length === 0) return false;

  try {
    const supabase = getSupabaseAdmin();
    if (vectorStorageAvailable === null) {
      const { error: availabilityError } = await supabase
        .from("ai_document_chunks")
        .select("id")
        .limit(1);
      if (availabilityError) {
        vectorStorageAvailable = false;
        return false;
      }
      vectorStorageAvailable = true;
    }

    const embeddings = await embedTexts(
      params.ai,
      chunks.map((chunk) => chunk.text),
      "RETRIEVAL_DOCUMENT",
      params.filename
    );

    const docVersion = params.documentVersion ?? 1;

    const rows = chunks.map((chunk, index) => {
      let section = chunk.page ? `Trang ${chunk.page}` : null;
      const headerMatch = chunk.text.match(/^(?:#+\s*|Mục\s+|Điều\s+|Phần\s+)([^\n.]+)/i);
      if (headerMatch) section = headerMatch[0].trim();

      return {
        knowledge_base_id: params.knowledgeBaseId,
        document_id: params.documentId,
        filename: params.filename,
        folder: params.folder,
        subfolder: params.subfolder,
        chunk_index: index,
        page_number: chunk.page,
        section,
        content: chunk.text,
        metadata: params.metadata || {},
        document_version: docVersion,
        embedding: embeddings[index],
      };
    });

    let { error } = await supabase.from("ai_document_chunks").upsert(rows, {
      onConflict: "document_id,chunk_index",
    });

    if (error && (error.message.includes("section") || error.message.includes("document_version") || error.message.includes("metadata"))) {
      const fallbackRows = rows.map((r) => ({
        knowledge_base_id: r.knowledge_base_id,
        document_id: r.document_id,
        filename: r.filename,
        folder: r.folder,
        subfolder: r.subfolder,
        chunk_index: r.chunk_index,
        page_number: r.page_number,
        content: r.content,
        embedding: r.embedding,
      }));
      const fallbackRes = await supabase.from("ai_document_chunks").upsert(fallbackRows, {
        onConflict: "document_id,chunk_index",
      });
      error = fallbackRes.error;
    }

    if (error) {
      vectorStorageAvailable = false;
      return false;
    }
    vectorStorageAvailable = true;
    return true;
  } catch (error) {
    console.warn("Could not create local vector index:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Hybrid chunk scoring:
 * Exact keyword > weak semantic similarity.
 */
function scoreChunk(chunk: RetrievedChunk, query: NormalizedQuery): number {
  const contentLower = chunk.content.toLowerCase();
  const filenameLower = chunk.filename.toLowerCase();
  const sectionLower = (chunk.section || "").toLowerCase();

  let matchedKeywordsCount = 0;
  for (const kw of query.keywords) {
    const kwLower = kw.toLowerCase();
    if (contentLower.includes(kwLower) || sectionLower.includes(kwLower) || filenameLower.includes(kwLower)) {
      matchedKeywordsCount++;
    }
  }

  const keywordRatio = query.keywords.length > 0 ? matchedKeywordsCount / query.keywords.length : 0;

  let exactPhraseBonus = 0;
  for (const phrase of query.exactPhrases) {
    if (contentLower.includes(phrase.toLowerCase())) {
      exactPhraseBonus += 0.12;
    }
  }
  if (contentLower.includes(query.searchQuery.toLowerCase())) {
    exactPhraseBonus += 0.20;
  }
  exactPhraseBonus = Math.min(exactPhraseBonus, 0.30);

  let titleMatchBonus = 0;
  for (const kw of query.keywords) {
    if (filenameLower.includes(kw.toLowerCase())) {
      titleMatchBonus = 0.10;
      break;
    }
  }

  const semanticScore = chunk.similarity || 0;

  let score = semanticScore * 0.40 + keywordRatio * 0.35 + exactPhraseBonus + titleMatchBonus;

  if (keywordRatio >= 0.5 || exactPhraseBonus > 0) {
    score += 0.20;
  }

  return score;
}

/**
 * Retrieves top 3-8 relevant knowledge chunks with exact keyword prioritization.
 */
export async function retrieveDocumentChunks(params: {
  ai: GoogleGenAI;
  knowledgeBaseId: string;
  query: string;
  folder: string;
  subfolder?: string;
  limit?: number;
}): Promise<RetrievedChunk[] | null> {
  if (vectorStorageAvailable === false) return null;

  const limit = Math.max(3, Math.min(params.limit || 6, 8));
  const normalized = normalizeQuery(params.query);

  try {
    const [queryEmbedding] = await embedTexts(
      params.ai,
      [normalized.searchQuery],
      "RETRIEVAL_QUERY"
    );

    const supabase = getSupabaseAdmin();

    // 1. Vector similarity search via RPC
    const { data: vectorData, error: vectorError } = await supabase.rpc("match_ai_document_chunks", {
      query_embedding: queryEmbedding,
      filter_knowledge_base_id: params.knowledgeBaseId,
      filter_folder: params.folder,
      filter_subfolder: params.subfolder || "",
      match_count: 12,
    });

    if (vectorError) {
      vectorStorageAvailable = false;
      return null;
    }
    vectorStorageAvailable = true;

    // 2. Keyword full-text search via RPC (optional enhancement)
    let keywordData: Record<string, unknown>[] = [];
    try {
      const { data: kwRes } = await supabase.rpc("search_ai_document_chunks_keyword", {
        search_query: normalized.searchQuery,
        filter_knowledge_base_id: params.knowledgeBaseId,
        filter_folder: params.folder,
        filter_subfolder: params.subfolder || "",
        match_count: 8,
      });
      if (Array.isArray(kwRes)) {
        keywordData = kwRes as Record<string, unknown>[];
      }
    } catch {
      // Keyword RPC is optional, fallback gracefully
    }

    // Merge and deduplicate candidates
    const candidateMap = new Map<string, RetrievedChunk>();

    for (const row of (vectorData || [])) {
      const key = `${row.document_id || ""}_${String(row.content || "").slice(0, 80)}`;
      candidateMap.set(key, {
        id: row.id ? String(row.id) : undefined,
        documentId: String(row.document_id || ""),
        filename: String(row.filename || "Tài liệu"),
        page: typeof row.page_number === "number" ? row.page_number : null,
        section: typeof row.section === "string" ? row.section : null,
        content: String(row.content || ""),
        similarity: typeof row.similarity === "number" ? row.similarity : 0,
      });
    }

    for (const row of keywordData) {
      const key = `${row.document_id || ""}_${String(row.content || "").slice(0, 80)}`;
      const existing = candidateMap.get(key);
      if (existing) {
        existing.similarity = Math.max(existing.similarity || 0, 0.65);
      } else {
        candidateMap.set(key, {
          documentId: String(row.document_id || ""),
          filename: String(row.filename || "Tài liệu"),
          page: typeof row.page_number === "number" ? row.page_number : null,
          section: typeof row.section === "string" ? row.section : null,
          content: String(row.content || ""),
          similarity: 0.50,
        });
      }
    }

    const rawCandidates = Array.from(candidateMap.values());
    if (rawCandidates.length === 0) return null;

    // 3. Score with hybrid keyword + exact phrase ranking
    const scoredCandidates = rawCandidates.map((c) => ({
      ...c,
      hybridScore: scoreChunk(c, normalized),
    }));

    // Sort descending by hybridScore
    scoredCandidates.sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0));

    // Return top 3-8 relevant chunks
    return scoredCandidates.slice(0, limit);
  } catch (error) {
    console.warn("retrieveDocumentChunks error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function chunksToContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((chunk, idx) => {
      const headerParts = [`[${idx + 1}] Tài liệu: ${chunk.filename}`];
      if (chunk.page) headerParts.push(`Trang ${chunk.page}`);
      if (chunk.section) headerParts.push(`Mục: ${chunk.section}`);

      return `${headerParts.join(" — ")}\n${chunk.content.trim()}`;
    })
    .join("\n\n---\n\n");
}

export function chunksToSources(chunks: RetrievedChunk[]): AISource[] {
  const result: AISource[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const key = `${chunk.filename}:${chunk.page ?? ""}:${chunk.section ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      document: chunk.filename,
      ...(chunk.page ? { page: chunk.page } : {}),
      ...(chunk.section ? { section: chunk.section } : {}),
      ...(chunk.id ? { chunkId: chunk.id } : {}),
    });
  }
  return result;
}
