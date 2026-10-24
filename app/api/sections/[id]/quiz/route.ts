import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { WEB_DEVELOPMENT_COURSE_ID, WEB_DEVELOPMENT_SECTION_ID, WEB_DEVELOPMENT_QUESTIONS } from "@/lib/webDevelopmentQuiz";
import { readSectionTermination } from "@/lib/sectionTermination";

type Context = { params: Promise<{ id: string }> };
type AuditRow = { id: number; created_at: string; details: Record<string, unknown> };

async function resolve(request: Request, context: Context) {
  const [{ id }, access] = await Promise.all([context.params, currentUserAccess(request.signal)]);
  const section = access?.sections.find(section => section.id === id);
  const course = access?.courses.find(course => course.id === section?.courseId);
  if (!access?.isActive || !section || !course || id !== WEB_DEVELOPMENT_SECTION_ID || course.id !== WEB_DEVELOPMENT_COURSE_ID
    || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  const identity = access.learnerIdentity || { sessionId: access.authUserId, name: access.displayName, email: access.email, information: {}, fields: [] };
  const termination = await readSectionTermination(course.id, section.id, request.signal);
  return { access, section, course, identity, afterId: termination?.id, quizSession: termination?.details.token || "initial", teaching: access.isAdmin || section.canFacilitate === true };
}
type Scope = NonNullable<Awaited<ReturnType<typeof resolve>>>;

function records(scope: Scope, action: string, signal?: AbortSignal) {
  let query = getSupabaseAdmin(signal).from("access_audit_logs").select("id,created_at,details")
    .eq("action", action).contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit", quizSession: scope.quizSession });
  if (scope.afterId !== undefined) query = query.gt("id", scope.afterId);
  return query;
}
async function latest(scope: Scope, action: string, learner: boolean, signal?: AbortSignal) {
  let query = records(scope, action, signal);
  if (learner) query = query.contains("details", { sessionId: scope.identity.sessionId });
  const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as AuditRow | null;
}
async function progress(scope: Scope, signal?: AbortSignal) {
  const [result, feedback] = await Promise.all([latest(scope, "QUIZ_COMPLETED", true, signal), latest(scope, "FEEDBACK_SUBMITTED", true, signal)]);
  return result ? { ...result.details, completedAt: result.created_at, feedbackSubmitted: Boolean(feedback),
    learner: { ...scope.identity, fields: scope.identity.fields || [] } } : null;
}
async function save(scope: Scope, action: string, details: Record<string, unknown>, signal?: AbortSignal) {
  const { data, error } = await getSupabaseAdmin(signal).from("access_audit_logs").insert({
    action, actor_email: scope.identity.email, course_id: scope.course.id,
    details: { ...scope.identity, courseId: scope.course.id, courseTitle: scope.course.title,
      folderGroupId: scope.course.folderGroupId, folderGroupName: scope.course.folderGroupName,
      sectionId: scope.section.id, sectionTitle: scope.section.title, section: scope.section.sectionKey,
      ...details, submissionStorage: "audit", quizSession: scope.quizSession },
  }).select("id,created_at,details").single();
  if (error) throw error;
  return data as AuditRow;
}
const denied = () => NextResponse.json({ message: "Bạn không có quyền truy cập quiz này." }, { status: 403 });

export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return denied();
    const state = await latest(scope, "QUIZ_OPENED", false, request.signal);
    if (!scope.teaching) return NextResponse.json({ success: true, isOpen: Boolean(state), quizSession: scope.quizSession, result: await progress(scope, request.signal) }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await records(scope, "QUIZ_COMPLETED", request.signal).order("created_at", { ascending: false });
    if (error) throw error;
    const seen = new Set<string>();
    const completedLearners = ((data || []) as AuditRow[]).filter(row => {
      const key = String(row.details.sessionId);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(row => ({ name: row.details.name, completedAt: row.created_at }));
    return NextResponse.json({ success: true, isOpen: Boolean(state), completedLearners }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Không thể tải quiz. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return denied();
    const body = await request.json();
    if (body.action === "open") {
      if (!scope.teaching) return denied();
      if (!await latest(scope, "QUIZ_OPENED", false)) await save(scope, "QUIZ_OPENED", {}, request.signal);
      return NextResponse.json({ success: true, isOpen: true });
    }
    if (scope.teaching) return denied();
    if (body.quizSession !== scope.quizSession) return NextResponse.json({ message: "Phiên quiz đã thay đổi. Vui lòng mở lại slide." }, { status: 409 });
    const previous = await progress(scope, request.signal);
    if (body.action === "result") {
      if (previous) return NextResponse.json({ success: true, ...previous });
      if (!await latest(scope, "QUIZ_OPENED", false, request.signal)) return NextResponse.json({ message: "Quiz chưa được mở." }, { status: 403 });
      if (!Array.isArray(body.answers) || body.answers.length !== WEB_DEVELOPMENT_QUESTIONS.length) return NextResponse.json({ message: "Hãy hoàn thành đủ 10 câu hỏi." }, { status: 400 });
      const answers = WEB_DEVELOPMENT_QUESTIONS.map((question, index) => {
        const selected = body.answers[index]?.selected;
        return { question: question.question, selected, correct: question.options[question.answer], isCorrect: selected === question.options[question.answer] };
      });
      if (answers.some((answer, index) => !WEB_DEVELOPMENT_QUESTIONS[index].options.includes(answer.selected))) return NextResponse.json({ message: "Câu trả lời không hợp lệ." }, { status: 400 });
      const score = answers.filter(answer => answer.isCorrect).length;
      const saved = await save(scope, "QUIZ_COMPLETED", { score, total: answers.length, answers }, request.signal);
      return NextResponse.json({ success: true, score, total: answers.length, answers, completedAt: saved.created_at, learner: { ...scope.identity, fields: scope.identity.fields || [] } });
    }
    if (body.action === "feedback") {
      if (!previous) return NextResponse.json({ message: "Vui lòng hoàn thành quiz trước khi gửi feedback." }, { status: 403 });
      const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
      if (!feedback || feedback.length > 2000) return NextResponse.json({ message: "Feedback cần có từ 1 đến 2000 ký tự." }, { status: 400 });
      if (!previous.feedbackSubmitted) await save(scope, "FEEDBACK_SUBMITTED", { feedback }, request.signal);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ message: "Thao tác không hợp lệ." }, { status: 400 });
  } catch {
    return NextResponse.json({ message: "Không thể lưu dữ liệu quiz. Vui lòng thử lại." }, { status: 500 });
  }
}
