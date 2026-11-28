import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSectionTermination } from "@/lib/sectionTermination";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { notifyRealtime } from "@/lib/realtime/publish";
import { readShowcaseBytes, ShowcaseInputError } from "@/lib/showcaseImage";

type Context = { params: Promise<{ id: string }> };
async function resolve(request: Request, context: Context) {
  const [{ id }, access] = await Promise.all([context.params, currentUserAccess(request.signal)]);
  const section = access?.sections.find(section => section.id === id);
  const course = access?.courses.find(course => course.id === section?.courseId);
  if (!access?.isActive || !section || !course || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  return { access, section, course };
}
export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope || (!scope.access.isAdmin && !scope.section.canFacilitate)) return NextResponse.json({ message: "Chỉ giảng viên của section được xem ý tưởng." }, { status: 403 });
    const termination = await readSectionTermination(scope.course.id, scope.section.id, request.signal);
    let query = getSupabaseAdmin(request.signal).from("access_audit_logs").select("id, created_at, details").eq("action", "IDEA_SUBMITTED")
      .contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit" });
    if (termination) query = query.gt("id", termination.id);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return NextResponse.json({ success: true, canDelete: scope.access.isAdmin, items: data.map(row => ({ id: String(row.id), name: row.details.name || "Học viên", idea: row.details.idea, submittedAt: row.created_at })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Section ideas GET:", error);
    return NextResponse.json({ message: "Không tải được ý tưởng. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    const scope = await resolve(request, context);
    if (!scope?.access.isAdmin) return NextResponse.json({ message: "Chỉ admin có quyền xóa ý tưởng." }, { status: 403 });
    const body = JSON.parse((await readShowcaseBytes(request, 512)).toString("utf8"));
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[1-9]\d{0,19}$/.test(id)) return NextResponse.json({ message: "Ý tưởng không hợp lệ." }, { status: 400 });
    const limit = await consumeRateLimit(`ideas-delete:${scope.access.authUserId || "admin"}`, { group: "ideas-delete", limit: 30, networkLimit: 1000 }, request.headers, request.signal);
    if (!limit.allowed) return NextResponse.json({ message: "Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(limit.retry_after) } });
    request.signal.throwIfAborted();
    const { data, error } = await getSupabaseAdmin().from("access_audit_logs").delete()
      .eq("id", id).eq("action", "IDEA_SUBMITTED").eq("course_id", scope.course.id)
      .contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit" })
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Ý tưởng không còn trong section này." }, { status: 404 });
    notifyRealtime();
    return NextResponse.json({ success: true, deletedId: String(data.id) });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ message: "Yêu cầu xóa không hợp lệ." }, { status: 400 });
    if (error instanceof ShowcaseInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Section ideas DELETE:", error);
    return NextResponse.json({ message: "Chưa xóa được ý tưởng. Vui lòng thử lại." }, { status: 500 });
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    const scope = await resolve(request, context);
    if (!scope || scope.access.isAdmin || scope.section.canFacilitate) return NextResponse.json({ message: "Vui lòng đăng nhập bằng phiên học viên của section này." }, { status: 403 });
    const { access, section, course } = scope;
    const identity = access.learnerIdentity || { sessionId: access.authUserId, name: access.displayName, email: access.email, information: {} };
    if (!identity.sessionId || !identity.name?.trim()) return NextResponse.json({ message: "Vui lòng hoàn tất thông tin học viên trước khi gửi." }, { status: 403 });
    const body = JSON.parse((await readShowcaseBytes(request, 4096)).toString("utf8"));
    const idea = typeof body.idea === "string" ? body.idea.trim() : "";
    if (!idea || idea.length > 500) return NextResponse.json({ message: "Ý tưởng phải có nội dung và không vượt quá 500 ký tự." }, { status: 400 });
    const limit = await consumeRateLimit(`ideas:${identity.sessionId}`, { group: "ideas", limit: 10, networkLimit: 1000 }, request.headers, request.signal);
    if (!limit.allowed) return NextResponse.json({ message: "Bạn gửi quá nhanh. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(limit.retry_after) } });
    request.signal.throwIfAborted();
    const { error } = await getSupabaseAdmin(request.signal).from("access_audit_logs").insert({
      action: "IDEA_SUBMITTED", actor_email: identity.email, course_id: course.id,
      details: { ...identity, courseId: course.id, courseTitle: course.title, folderGroupId: course.folderGroupId, folderGroupName: course.folderGroupName, sectionId: section.id, sectionTitle: section.title, section: section.sectionKey, idea, submissionStorage: "audit" },
    });
    if (error) throw error;
    notifyRealtime();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ message: "Nội dung gửi không hợp lệ." }, { status: 400 });
    if (error instanceof ShowcaseInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Section ideas POST:", error);
    return NextResponse.json({ message: "Chưa gửi được ý tưởng. Vui lòng thử lại." }, { status: 500 });
  }
}
