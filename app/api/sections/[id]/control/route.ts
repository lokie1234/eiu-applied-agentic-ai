import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSectionTermination } from "@/lib/sectionTermination";

type Context = { params: Promise<{ id: string }> };
async function resolve(request: Request, context: Context) {
  const [{ id }, access] = await Promise.all([context.params, currentUserAccess(request.signal)]);
  const section = access?.sections.find(section => section.id === id);
  const course = access?.courses.find(course => course.id === section?.courseId);
  if (!access?.isActive || !section || !course || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  return { access, section, course, legacy: course.slug === APPLIED_AGENTIC_AI_SLUG && ["section1", "section2"].includes(section.sectionKey) };
}

export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "Access denied." }, { status: 403 });
    let token = "initial";
    if (scope.section.terminationEnabled) {
      if (scope.legacy) {
        const { data, error } = await getSupabaseAdmin(request.signal).from("section_state").select("termination_token").eq("section", scope.section.sectionKey).maybeSingle();
        if (error) throw error;
        token = data?.termination_token || "initial";
      } else token = (await readSectionTermination(scope.course.id, scope.section.id, request.signal))?.details.token || "initial";
    }
    return NextResponse.json({ success: true, enabled: scope.section.terminationEnabled === true, terminationToken: token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Unable to read section status." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope || !scope.access.isAdmin || !scope.section.terminationEnabled) return NextResponse.json({ message: "Section termination must be enabled by an administrator." }, { status: 403 });
    const token = randomUUID(), sessionStartedAt = new Date().toISOString();
    const db = getSupabaseAdmin(request.signal);
    if (scope.legacy) {
      const { error } = await db.from("section_state").upsert({ section: scope.section.sectionKey, termination_token: token,
        session_started_at: sessionStartedAt, quiz_open: false, quiz_opened_at: null, updated_at: sessionStartedAt }, { onConflict: "section" });
      if (error) throw error;
    } else {
      const { error } = await db.from("access_audit_logs").insert({ action: "SECTION_TERMINATED", actor_email: scope.access.email, course_id: scope.course.id,
        details: { courseId: scope.course.id, sectionId: scope.section.id, section: scope.section.sectionKey, token } });
      if (error) throw error;
    }
    return NextResponse.json({ success: true, token, sessionStartedAt });
  } catch {
    return NextResponse.json({ message: "Unable to terminate this section. Please try again." }, { status: 500 });
  }
}
