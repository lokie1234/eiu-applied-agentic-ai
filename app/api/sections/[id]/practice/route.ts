import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSectionTermination } from "@/lib/sectionTermination";
import { notifyRealtime } from "@/lib/realtime/publish";
import { notifyClassroom, notifyClassroomAnswer } from "@/lib/realtime/classroom";
import { MIS301_COURSE_ID, MIS301_SECTION_ID, MIS301_PRACTICE, mis301Part } from "@/lib/mis301Practice";

type Context = { params: Promise<{ id: string }> };
type RecordRow = { id: number; created_at: string; details: { sessionId: string; name: string; email: string; partId: string; values: Record<string, string> } };
async function resolve(request: Request, context: Context) {
  const { id } = await context.params;
  if (id !== MIS301_SECTION_ID) return null;
  const access = await currentUserAccess(request.signal);
  const section = access?.sections.find(section => section.id === id && section.courseId === MIS301_COURSE_ID);
  const course = access?.courses.find(course => course.id === section?.courseId);
  if (!access?.isActive || !section || !course || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  const teaching = access.isAdmin || section.canFacilitate === true;
  return { access, section, course, teaching, identity: access.learnerIdentity, termination: await readSectionTermination(course.id, section.id, request.signal) };
}
type Scope = NonNullable<Awaited<ReturnType<typeof resolve>>>;
function records(scope: Scope, signal: AbortSignal) {
  let query = getSupabaseAdmin(signal).from("access_audit_logs").select("id,created_at,details")
    .eq("action", "ACTIVITY_SUBMITTED").contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit", practice: "mis301-pandas", practiceSession: scope.termination?.details.token || "initial" });
  if (scope.termination) query = query.gt("id", scope.termination.id);
  return query;
}
export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "You do not have access to this practice." }, { status: 403 });
    if (!scope.teaching && (!scope.identity?.information.name || !scope.identity.email || scope.identity.email.endsWith("@passcode.eiu"))) return NextResponse.json({ message: "Please sign in again and enter your username and email through Learning Access." }, { status: 403 });
    if (new URL(request.url).searchParams.get("context") === "1") return NextResponse.json({ teaching: scope.teaching,
      practiceSession: scope.termination?.details.token || "initial", learner: scope.identity ? { name: scope.identity.name, email: scope.identity.email } : null, items: [],
    }, { headers: { "Cache-Control": "private, no-store" } });
    let query = records(scope, request.signal);
    if (!scope.teaching) {
      if (!scope.identity) return NextResponse.json({ message: "Sign in through Learning Access and complete your information first." }, { status: 403 });
      query = query.contains("details", { sessionId: scope.identity.sessionId });
    }
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ teaching: scope.teaching, practiceSession: scope.termination?.details.token || "initial",
      learner: scope.identity ? { name: scope.identity.name, email: scope.identity.email } : null,
      items: ((data || []) as RecordRow[]).map(row => ({ id: String(row.id), submittedAt: row.created_at, name: row.details.name, email: row.details.email, partId: row.details.partId, values: row.details.values })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "Unable to load practice answers. Please try again." }, { status: 500 });
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "You do not have access to this practice." }, { status: 403 });
    if (scope.teaching || !scope.identity?.information.name || !scope.identity.email || scope.identity.email.endsWith("@passcode.eiu")) return NextResponse.json({ message: "Use Learning Access and complete your username and email to submit answers." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 16000) return NextResponse.json({ message: "Your answer is too long." }, { status: 413 });
    let body; try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Invalid answer." }, { status: 400 }); }
    const partId = mis301Part(body?.partId), submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
    if (!partId || !/^[a-f0-9-]{36}$/i.test(submissionId)) return NextResponse.json({ message: "Invalid practice part or submission." }, { status: 400 });
    if (body.practiceSession !== (scope.termination?.details.token || "initial")) return NextResponse.json({ message: "This practice session has changed. Reload the slide before submitting." }, { status: 409 });
    const definition = MIS301_PRACTICE[partId], values: Record<string, string> = {};
    for (const field of definition.fields) {
      const value = typeof body.values?.[field.id] === "string" ? body.values[field.id].trim() : "";
      if (!value || value.length > 2000) return NextResponse.json({ message: `Complete ${field.label} (up to 2,000 characters).` }, { status: 400 });
      values[field.id] = value;
    }
    const existing = await records(scope, request.signal).contains("details", { sessionId: scope.identity.sessionId, submissionId }).limit(1).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) { notifyClassroom(); return NextResponse.json({ success: true, submittedAt: existing.data.created_at }); }
    const { error, data } = await getSupabaseAdmin(request.signal).from("access_audit_logs").insert({
      action: "ACTIVITY_SUBMITTED", actor_email: scope.identity.email, course_id: scope.course.id,
      details: { ...scope.identity, courseId: scope.course.id, courseTitle: scope.course.title, sectionId: scope.section.id, sectionTitle: scope.section.title, section: scope.section.sectionKey,
        folderGroupId: scope.course.folderGroupId, folderGroupName: scope.course.folderGroupName, submissionStorage: "audit", practice: "mis301-pandas", practiceSession: body.practiceSession,
        submissionId, partId, activityType: `mis301-${partId}`, activityLabel: definition.label, activityFields: definition.fields, values },
    }).select("id,created_at").single();
    if (error) {
      // A retried concurrent request may hit the unique submission index.
      if (error.code === "23505") { notifyClassroom(); return NextResponse.json({ success: true }); }
      throw error;
    }
    notifyRealtime();
    notifyClassroomAnswer({ sectionId: scope.section.id, epoch: body.practiceSession, answer: { recordId: String(data.id), subject: scope.identity.sessionId,
      username: scope.identity.name, partId, values, submittedAt: data.created_at } });
    return NextResponse.json({ success: true, submittedAt: data.created_at });
  } catch {
    return NextResponse.json({ message: "Unable to save your answer. Your input is kept; please try again." }, { status: 500 });
  }
}
