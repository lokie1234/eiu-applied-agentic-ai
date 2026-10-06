import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { matchesPassword, validPassword } from "./teachers";

export type AdminCredential = { password_hash: string; session_version: number };
export async function getAdminCredential(): Promise<AdminCredential | null> {
  const { data, error } = await getSupabaseAdmin().from("admin_credentials")
    .select("password_hash,session_version").eq("id", true).maybeSingle();
  // Preserve the existing admin login until the new migration is applied.
  if (error && !["42P01", "PGRST205"].includes(error.code)) throw error;
  return data ?? null;
}
export async function verifyAdminPassword(password: string, credential: AdminCredential | null) {
  if (!validPassword(password)) return false;
  if (credential) return matchesPassword(password, credential.password_hash);
  const configured = process.env.ADMIN_ACCESS_PASSWORD?.trim();
  if (!configured) return false;
  return timingSafeEqual(createHash("sha256").update(password).digest(), createHash("sha256").update(configured).digest());
}
