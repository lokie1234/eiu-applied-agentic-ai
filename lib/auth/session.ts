import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const ACCESS_SESSION_COOKIE = "eiu_access_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

export type CreateSessionPayload =
  | { role: "admin"; email?: string; sessionVersion?: number; authMethod: "google" }
  | { role: "guest"; sessionId: string }
  | { role: "passcode"; credentialHash: string; sessionId: string; identityLogId?: number };
export type AccessSession = CreateSessionPayload & { expiresAt: number };

function secret() {
  const value = process.env.PASSCODE_SESSION_SECRET?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!value) throw new Error("PASSCODE_SESSION_SECRET is not configured.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAccessSession(session: CreateSessionPayload) {
  const payload = Buffer.from(JSON.stringify({
    ...session,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyAccessSession(value: string | undefined): AccessSession | null {
  if (!value) return null;
  const [payload, signature, ...extra] = value.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessSession;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) return null;
    if (parsed.role === "admin" && parsed.authMethod === "google") return parsed;
    if (parsed.role === "guest" && typeof parsed.sessionId === "string" && /^[a-f0-9-]{36}$/.test(parsed.sessionId)) return parsed;
    if (parsed.role === "passcode" && /^[a-f0-9]{64}$/.test(parsed.credentialHash) && typeof parsed.sessionId === "string" && /^[a-f0-9-]{36}$/.test(parsed.sessionId) && (parsed.identityLogId === undefined || (Number.isSafeInteger(parsed.identityLogId) && parsed.identityLogId > 0))) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function currentAccessSession() {
  const session = verifyAccessSession((await cookies()).get(ACCESS_SESSION_COOKIE)?.value);
  if (session?.role === "admin") {
    const { data, error } = await getSupabaseAdmin().from("admin_credentials")
      .select("session_version").eq("id", true).maybeSingle();
    if (error && !["42P01", "PGRST205"].includes(error.code)) throw error;
    if ((session.sessionVersion ?? 0) !== (data?.session_version ?? 0)) return null;
  }
  return session;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
