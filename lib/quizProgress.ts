import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LearnerIdentity } from "./learningIdentity";

export async function readQuizProgress(identity: LearnerIdentity, section: string) {
  const db = getSupabaseAdmin();
  const { data: audit, error } = await db.from("access_audit_logs").select("details").eq("action", "QUIZ_COMPLETED").contains("details", { sessionId: identity.sessionId, section }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!audit?.details?.recordId) return null;
  const { data: result, error: resultError } = await db.from("quiz_results").select("score,total,answers,completed_at").eq("id", audit.details.recordId).eq("section", section).maybeSingle();
  if (resultError) throw resultError;
  if (!result) return null;
  const { data: feedback, error: feedbackError } = await db.from("access_audit_logs").select("id").eq("action", "FEEDBACK_SUBMITTED").contains("details", { sessionId: identity.sessionId, section }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (feedbackError) throw feedbackError;
  return { score: result.score, total: result.total, answers: result.answers, completedAt: result.completed_at, feedbackSubmitted: Boolean(feedback), learner: { name: identity.name, email: identity.email, information: identity.information, fields: identity.fields || [] } };
}
