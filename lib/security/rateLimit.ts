import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const RATE_COOKIE = "eiu_request_identity";
export const BLOCK_SECONDS = 120;
const WINDOW_SECONDS = 60;
const IDENTITY_AGE = 86400;

function secret() {
  const value = process.env.PASSCODE_SESSION_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!value) throw new Error("Request identity signing secret is not configured.");
  return value;
}

function digest(value: string) {
  return createHmac("sha256", secret()).update(`request-limit:${value}`).digest("hex");
}

export function requestIdentity(cookie?: string, now = Date.now()) {
  if (cookie && cookie.length < 200) {
    const [id, expires, signature, ...extra] = cookie.split(".");
    if (!extra.length && /^[a-f0-9-]{36}$/.test(id) && /^\d{13}$/.test(expires)
      && Number(expires) > now && Number(expires) <= now + IDENTITY_AGE * 1000
      && /^[a-f0-9]{64}$/.test(signature ?? "")
      && timingSafeEqual(Buffer.from(signature), Buffer.from(digest(`${id}.${expires}`)))) {
      return { id, cookie, fresh: false };
    }
  }
  const id = randomUUID();
  const payload = `${id}.${now + IDENTITY_AGE * 1000}`;
  return { id, cookie: `${payload}.${digest(payload)}`, fresh: true };
}

// These paths include automatic requests; a page's normal background traffic
// must never consume its five reload/login attempts.
export function requestPolicy(path: string, method: string, headers: Headers) {
  const api = path.startsWith("/api/");
  if (method === "OPTIONS" || path === "/api/signout" || path === "/api/admin/drive/callback") return null;
  if (!api) {
    const document = headers.get("sec-fetch-dest") === "document" || headers.get("accept")?.includes("text/html");
    if (method !== "GET" || !document || headers.get("rsc") === "1" || headers.has("next-router-prefetch") || headers.get("purpose") === "prefetch") {
      return { group: "page-data", limit: 120, networkLimit: 3000 };
    }
    return { group: "navigation", limit: 5, networkLimit: 500 };
  }
  if (path.startsWith("/api/auth/")) return { group: "login", limit: 5, networkLimit: 500 };
  if (path === "/api/presence" && method === "POST") return { group: "heartbeat", limit: 12, networkLimit: 1500 };
  if (method === "GET" || method === "HEAD") return { group: "reads", limit: 240, networkLimit: 6000 };
  // One bounded group also covers unknown URLs; arbitrary pathnames must not
  // let a caller create unlimited fresh buckets or evade the write budget.
  return { group: "writes", limit: 5, networkLimit: 500 };
}

export type RatePolicy = NonNullable<ReturnType<typeof requestPolicy>>;
export function rateRules(identity: string, policy: RatePolicy, headers: Headers) {
  const rules = [{ key: digest(`browser:${identity}:${policy.group}`), limit: policy.limit }];
  // Vercel overwrites X-Forwarded-For. Do not trust arbitrary forwarding
  // headers on a direct/local deployment. Never store raw IP addresses.
  const ip = process.env.VERCEL === "1" ? headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  if (ip && isIP(ip)) rules.push({ key: digest(`network:${ip}:${policy.group}`), limit: policy.networkLimit });
  return rules;
}

export async function consumeRateLimit(identity: string, policy: RatePolicy, headers: Headers, signal?: AbortSignal) {
  const { data, error } = await getSupabaseAdmin(signal).rpc("consume_request_limits", {
    p_rules: rateRules(identity, policy, headers),
    p_window_seconds: WINDOW_SECONDS,
    p_block_seconds: BLOCK_SECONDS,
  });
  if (error) throw new Error("Shared request limiter unavailable.");
  if (!data || typeof data.allowed !== "boolean" || !Number.isInteger(data.retry_after) || data.retry_after < 0) {
    throw new Error("Invalid request limiter response.");
  }
  return data as { allowed: boolean; retry_after: number };
}
