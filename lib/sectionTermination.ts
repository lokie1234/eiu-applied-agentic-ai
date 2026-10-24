import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function readSectionTermination(courseId: string, sectionId: string, signal?: AbortSignal) {
  const { data, error } = await getSupabaseAdmin(signal).from("access_audit_logs").select("id,created_at,details")
    .eq("action", "SECTION_TERMINATED").contains("details", { courseId, sectionId })
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as { id: number; created_at: string; details: { token: string } } | null;
}
