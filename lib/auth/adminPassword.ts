import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AdminCredential = { session_version: number };

export async function getAdminCredential(signal?: AbortSignal): Promise<AdminCredential | null> {
  try {
    const { data, error } = await getSupabaseAdmin(signal).from("admin_credentials")
      .select("session_version").eq("id", true).maybeSingle();
    // Older deployments may not have the session-version table yet.
    if (error && !["42P01", "PGRST205"].includes(error.code)) throw error;
    return data ?? null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

function cleanPassword(val: string | undefined): string {
  if (!val) return "";
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function verifyAdminPassword(candidate: string | unknown): boolean {
  const configured = cleanPassword(process.env.ADMIN_ACCESS_PASSWORD);
  if (!configured || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  const candidateDigest = createHash("sha256").update(trimmed).digest();
  const configuredDigest = createHash("sha256").update(configured).digest();
  return timingSafeEqual(candidateDigest, configuredDigest);
}
