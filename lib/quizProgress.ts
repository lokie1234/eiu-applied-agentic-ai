import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LearnerIdentity } from "./learningIdentity";

export async function readQuizProgress(identity: LearnerIdentity, section: string, signal?: AbortSignal) {
  const db = getSupabaseAdmin(signal);
  const [{ data: audit, error }, { data: state, error: stateError }] = await Promise.all([
    db.from("access_audit_logs").select("details,created_at").eq("action", "QUIZ_COMPLETED").contains("details", { sessionId: identity.sessionId, section }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("section_state").select("session_started_at").eq("section", section).maybeSingle(),
  ]);
  if (error) throw error;
  if (stateError) throw stateError;
  const startedAt = Date.parse(String(state?.session_started_at || ""));
  if (Date.parse(String(audit?.created_at || "")) < startedAt) return null;
  if (!audit?.details?.recordId) return null;
  const [{ data: result, error: resultError }, { data: feedback, error: feedbackError }] = await Promise.all([
    db.from("quiz_results").select("score,total,answers,completed_at").eq("id", audit.details.recordId).eq("section", section).maybeSingle(),
    db.from("access_audit_logs").select("id,created_at").eq("action", "FEEDBACK_SUBMITTED").contains("details", { sessionId: identity.sessionId, section }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (resultError) throw resultError;
  if (!result) return null;
  if (feedbackError) throw feedbackError;
  return { score: result.score, total: result.total, answers: result.answers, completedAt: result.completed_at, feedbackSubmitted: Boolean(feedback) && !(Date.parse(String(feedback?.created_at || "")) < startedAt), learner: { name: identity.name, email: identity.email, information: identity.information, fields: identity.fields || [] } };
}
