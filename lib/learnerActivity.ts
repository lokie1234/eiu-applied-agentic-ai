import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LearnerIdentity } from "./learningIdentity";

export async function recordLearnerActivity(identity: LearnerIdentity, action: "IDEA_SUBMITTED" | "SHOWCASE_SUBMITTED" | "QUIZ_COMPLETED" | "FEEDBACK_SUBMITTED", section: string, recordId: string | number) {
  const { error } = await getSupabaseAdmin().from("access_audit_logs").insert({ action, actor_email: identity.email, details: { ...identity, section, recordId } });
  if (error) throw error;
}
