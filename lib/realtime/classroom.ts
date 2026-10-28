import "server-only";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MIS301_SECTION_ID, MIS301_COURSE_ID, mis301Part } from "@/lib/mis301Practice";
import { readSectionTermination } from "@/lib/sectionTermination";
import { realtimeConfigured } from "./server";

export async function classroomSnapshot(signal?: AbortSignal) {
  const version = Date.now(), db = getSupabaseAdmin(signal);
  const termination = await readSectionTermination(MIS301_COURSE_ID, MIS301_SECTION_ID, signal);
  const epoch = termination?.details.token || "initial";
  const since = new Date(Math.max(version - 86400_000, termination ? Date.parse(termination.created_at) : 0)).toISOString();
  const cutoff = new Date(version).toISOString();
  const [logins, answers] = await Promise.all([
    db.from("access_audit_logs").select("id,details,created_at").eq("action", "PASSCODE_LOGIN")
      .contains("details", { accessMode: "learner", scopes: [{ sectionId: MIS301_SECTION_ID }] }).gte("created_at", since).lte("created_at", cutoff)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
    db.from("access_audit_logs").select("id,details,created_at").eq("action", "ACTIVITY_SUBMITTED")
      .contains("details", { sectionId: MIS301_SECTION_ID, practice: "mis301-pandas", practiceSession: epoch }).lte("created_at", cutoff)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
  ]);
  if (logins.error) throw logins.error;
  if (answers.error) throw answers.error;
  const emails = new Set<string>();
  const members: Array<{ subject: string; username: string }> = [];
  for (const row of logins.data || []) {
    const identity = row.details;
    const username = String(identity.information?.name || identity.information?.username || "").trim();
    const email = String(identity.email || "").trim().toLowerCase();
    if (!username || !email || email.endsWith("@passcode.eiu") || !identity.sessionId || emails.has(email)) continue;
    emails.add(email); members.push({ subject: String(identity.sessionId), username: username.slice(0, 200) });
  }
  return { sectionId: MIS301_SECTION_ID, version, epoch, members,
    answers: (answers.data || []).filter(row => mis301Part(row.details.partId)).map(row => ({ recordId: String(row.id), subject: String(row.details.sessionId),
      username: String(row.details.name || "Learner"), partId: String(row.details.partId), values: row.details.values as Record<string, string>, submittedAt: row.created_at })),
  };
}
export async function publishClassroom() {
  if (!realtimeConfigured()) return;
  const payload = await classroomSnapshot();
  const response = await fetch(`${process.env.CONVEX_SITE_URL!.replace(/\/$/, "")}/classroom`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REALTIME_BRIDGE_SECRET}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Classroom synchronization pending.");
}
export function notifyClassroom() {
  if (!realtimeConfigured()) return;
  after(async () => { try { await publishClassroom(); } catch { console.error("Classroom projection pending reconciliation; report data remains saved."); } });
}
export function notifyClassroomAnswer(payload: { sectionId: string; epoch: string; answer: { recordId: string; subject: string; username: string; partId: string; values: Record<string, string>; submittedAt: string } }) {
  if (!realtimeConfigured()) return;
  after(async () => {
    try {
      const response = await fetch(`${process.env.CONVEX_SITE_URL!.replace(/\/$/, "")}/classroom/answer`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REALTIME_BRIDGE_SECRET}` },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Projection pending.");
    } catch { console.error("Practice answer notification pending reconciliation; durable answer remains saved."); }
  });
}
