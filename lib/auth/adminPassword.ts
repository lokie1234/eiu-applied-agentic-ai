import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AdminCredential = { session_version: number };
export async function getAdminCredential(): Promise<AdminCredential | null> {
  const { data, error } = await getSupabaseAdmin().from("admin_credentials")
    .select("session_version").eq("id", true).maybeSingle();
  // Older deployments may not have the session-version table yet.
  if (error && !["42P01", "PGRST205"].includes(error.code)) throw error;
  return data ?? null;
}
