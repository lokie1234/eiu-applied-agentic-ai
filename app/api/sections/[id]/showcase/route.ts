import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
type Row = { id: string | number; created_at: string; details: { name?: string; url?: string } };
const item = (row: Row) => ({ id: String(row.id), name: row.details.name || "Learner", url: row.details.url || "", sharedAt: row.created_at });

async function resolve(request: Request, context: Context) {
  const [{ id: sectionId }, access] = await Promise.all([context.params, currentUserAccess(request.signal)]);
  const section = access?.sections.find(section => section.id === sectionId);
  const course = access?.courses.find(course => course.id === section?.courseId);
  if (!access?.isActive || !section || !course || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  return { access, section, course };
}

export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "Bạn không có quyền xem bài làm của section này." }, { status: 403 });
    const { data, error } = await getSupabaseAdmin(request.signal).from("access_audit_logs")
      .select("id, created_at, details").eq("action", "SHOWCASE_SUBMITTED")
      .contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit" })
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ success: true, items: (data as Row[]).map(item) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Section showcase GET:", error);
    return NextResponse.json({ message: "Không thể tải bài làm. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "Bạn không có quyền nộp bài vào section này." }, { status: 403 });
    const { access, course, section } = scope;
    if (access.isAdmin || section.canFacilitate) return NextResponse.json({ message: "Hãy dùng phiên học viên để nộp bài." }, { status: 403 });
    const body = await request.json();
    if (body.website) return NextResponse.json({ success: true });
    const url = typeof body.url === "string" ? body.url.trim() : "";
    let valid = false;
    try { const parsed = new URL(url); valid = parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password; } catch { /* invalid URL */ }
    if (!valid || url.length > 500) return NextResponse.json({ message: "Dán link HTTPS hợp lệ của website hoặc bản demo." }, { status: 400 });
    const identity = access.learnerIdentity || { sessionId: access.authUserId, name: access.displayName, email: access.email, information: {} };
    // One atomic record in the existing Supabase activity store retains both
    // the submission and its server-resolved course/section and learner identity.
    const { data, error } = await getSupabaseAdmin(request.signal).from("access_audit_logs").insert({
      action: "SHOWCASE_SUBMITTED", actor_email: identity.email, course_id: course.id,
      details: { ...identity, courseId: course.id, courseTitle: course.title, sectionId: section.id, sectionTitle: section.title, section: section.sectionKey, url, submissionStorage: "audit" },
    }).select("id, created_at, details").single();
    if (error) throw error;
    return NextResponse.json({ success: true, item: item(data as Row) });
  } catch (error) {
    console.error("Section showcase POST:", error);
    return NextResponse.json({ message: "Không thể lưu bài làm. Vui lòng thử lại." }, { status: 500 });
  }
}
