import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { passcodeDigest } from "@/lib/auth/session";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LANGUAGE_LABELS = new Set(["vi", "en", "vi_en"]);

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

async function loadAccessData() {
  const supabase = getSupabaseAdmin();
  const [coursesResult, sectionsResult, passcodesResult] = await Promise.all([
    supabase.from("courses").select("id, slug, title, description, status, language_label").neq("status", "archived").order("title"),
    supabase.from("course_sections").select("id, course_id, section_key, title, position, status").neq("status", "archived").order("position"),
    supabase.from("course_passcodes").select("id, course_id, code_hint, status, last_used_at, created_at").eq("status", "active").order("created_at", { ascending: false }),
  ]);
  if (coursesResult.error) throw coursesResult.error;
  if (sectionsResult.error) throw sectionsResult.error;
  if (passcodesResult.error) throw passcodesResult.error;
  return { courses: coursesResult.data ?? [], sections: sectionsResult.data ?? [], passcodes: passcodesResult.data ?? [] };
}

export async function GET() {
  if (!(await requireAdminAccess())) return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });
  try {
    return NextResponse.json({ success: true, ...(await loadAccessData()) });
  } catch (error) {
    console.error("Load admin data error:", error);
    return NextResponse.json({ success: false, message: "Unable to load administration data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireAdminAccess();
  if (!actor) return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const supabase = getSupabaseAdmin();
    let generatedCode: string | undefined;

    if (action === "generate_course_passcode") {
      const courseId = String(body.courseId ?? "");
      const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("id", courseId).eq("status", "active").maybeSingle();
      if (courseError) throw courseError;
      if (!course) return NextResponse.json({ success: false, message: "Course folder not found." }, { status: 404 });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = randomInt(0, 10_000).toString().padStart(4, "0");
        const { data: existing, error: lookupError } = await supabase.from("course_passcodes")
          .select("course_id")
          .eq("code_hash", passcodeDigest(candidate))
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) {
          generatedCode = candidate;
          break;
        }
      }
      if (!generatedCode) throw new Error("Unable to allocate a unique four-digit passcode.");

      // A new row ID revokes sessions created with the previous folder code.
      const { error: deleteError } = await supabase.from("course_passcodes").delete().eq("course_id", courseId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("course_passcodes").insert({
        course_id: courseId,
        code_hash: passcodeDigest(generatedCode),
        code_hint: generatedCode,
        label: "Shared folder access",
      });
      if (insertError) throw insertError;
      await supabase.from("access_audit_logs").insert({ actor_email: actor.email, action: "GENERATE_COURSE_PASSCODE", course_id: courseId });
    } else if (action === "delete_course_passcode") {
      const courseId = String(body.courseId ?? "");
      const { error } = await supabase.from("course_passcodes").delete().eq("course_id", courseId);
      if (error) throw error;
      await supabase.from("access_audit_logs").insert({ actor_email: actor.email, action: "DELETE_COURSE_PASSCODE", course_id: courseId });
    } else if (action === "set_course_language") {
      const courseId = String(body.courseId ?? "");
      const languageLabel = String(body.languageLabel ?? "");
      if (!LANGUAGE_LABELS.has(languageLabel)) return NextResponse.json({ success: false, message: "Invalid language label." }, { status: 400 });
      const { error } = await supabase.from("courses").update({ language_label: languageLabel, updated_at: new Date().toISOString() }).eq("id", courseId);
      if (error) throw error;
    } else if (action === "create_course") {
      const title = String(body.title ?? "").trim();
      const slug = slugify(title);
      if (!title || title.length > 120 || !slug) return NextResponse.json({ success: false, message: "Invalid course name." }, { status: 400 });
      const { error } = await supabase.from("courses").insert({ title, slug, status: "active", language_label: "vi_en" });
      if (error) throw error;
    } else if (action === "delete_course") {
      const courseId = String(body.courseId ?? "");
      const { data: course, error: readError } = await supabase.from("courses").select("slug").eq("id", courseId).maybeSingle();
      if (readError) throw readError;
      if (!course) return NextResponse.json({ success: false, message: "Course not found." }, { status: 404 });
      if (course.slug === APPLIED_AGENTIC_AI_SLUG) return NextResponse.json({ success: false, message: "The active course cannot be deleted." }, { status: 400 });
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    } else if (action === "create_section") {
      const courseId = String(body.courseId ?? "");
      const title = String(body.title ?? "").trim();
      const { data: course, error: courseError } = await supabase.from("courses").select("slug").eq("id", courseId).maybeSingle();
      if (courseError) throw courseError;
      if (!course || !title || title.length > 120) return NextResponse.json({ success: false, message: "Invalid course or section name." }, { status: 400 });
      const { data: last } = await supabase.from("course_sections").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabase.from("course_sections").insert({ course_id: courseId, section_key: `${course.slug}-${slugify(title)}-${Date.now().toString(36)}`, title, position: Number(last?.position ?? 0) + 1, status: "active" });
      if (error) throw error;
    } else if (action === "delete_section") {
      const sectionId = String(body.sectionId ?? "");
      const { data: section, error: readError } = await supabase.from("course_sections").select("section_key").eq("id", sectionId).maybeSingle();
      if (readError) throw readError;
      if (!section) return NextResponse.json({ success: false, message: "Section not found." }, { status: 404 });
      if (["section1", "section2"].includes(section.section_key)) return NextResponse.json({ success: false, message: "The active Section 1/2 content cannot be deleted." }, { status: 400 });
      const { error } = await supabase.from("course_sections").delete().eq("id", sectionId);
      if (error) throw error;
    } else {
      return NextResponse.json({ success: false, message: "Unsupported action." }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...(await loadAccessData()), ...(generatedCode ? { generatedCode } : {}) });
  } catch (error) {
    console.error("Admin update error:", error);
    const message = error instanceof Error && /duplicate|unique/i.test(error.message)
      ? "This passcode or course name is already in use."
      : "Unable to update administration data.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
