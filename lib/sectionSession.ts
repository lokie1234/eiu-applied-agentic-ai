import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type SectionId = "section1" | "section2";

const SHOW_ALL_FROM = "1970-01-01T00:00:00.000Z";

export async function getSectionSessionStartedAt(section: SectionId) {
  const { data, error } = await getSupabaseAdmin()
    .from("section_state")
    .select("session_started_at")
    .eq("section", section)
    .maybeSingle();
  if (error) throw error;

  const value = String(data?.session_started_at ?? "");
  return Number.isNaN(Date.parse(value)) ? SHOW_ALL_FROM : value;
}
