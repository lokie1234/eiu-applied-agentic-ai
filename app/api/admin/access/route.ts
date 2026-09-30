import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG, isEiuEmail } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

async function loadAccessData() {
  const supabase = getSupabaseAdmin();
  const [usersResult, coursesResult, sectionsResult, grantsResult] = await Promise.all([
    supabase.from("app_users")
      .select("email, display_name, is_admin, status, auth_user_id, created_at").order("email"),
    supabase.from("courses")
      .select("id, slug, title, description, status").neq("status", "archived").order("title"),
    supabase.from("course_sections")
      .select("id, course_id, section_key, title, position, status")
      .neq("status", "archived").order("position"),
    supabase.from("user_section_access").select("user_email, section_id, granted_at"),
  ]);
  if (usersResult.error) throw usersResult.error;
  if (coursesResult.error) throw coursesResult.error;
  if (sectionsResult.error) throw sectionsResult.error;
  if (grantsResult.error) throw grantsResult.error;
  return {
    users: usersResult.data ?? [], courses: coursesResult.data ?? [],
    sections: sectionsResult.data ?? [], grants: grantsResult.data ?? [],
  };
}

export async function GET() {
  if (!(await requireAdminAccess())) {
    return NextResponse.json({ success: false, message: "Không có quyền quản trị." }, { status: 403 });
  }
  try {
    return NextResponse.json({ success: true, ...(await loadAccessData()) });
  } catch (error) {
    console.error("Load access data error:", error);
    return NextResponse.json({ success: false, message: "Không thể tải danh sách quyền." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireAdminAccess();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Không có quyền quản trị." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const supabase = getSupabaseAdmin();

    if (action === "add_users") {
      const rawEmails = Array.isArray(body.emails) ? body.emails : [];
      const emails = [...new Set(
        rawEmails.map((value: unknown) => String(value).trim().toLowerCase()).filter(isEiuEmail),
      )].slice(0, 500);
      if (emails.length === 0) {
        return NextResponse.json(
          { success: false, message: "Không tìm thấy email hợp lệ có đuôi @eiu.edu.vn." },
          { status: 400 },
        );
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("app_users").upsert(
        emails.map((email) => ({ email, status: "active", updated_at: now })),
        { onConflict: "email" },
      );
      if (error) throw error;
      await supabase.from("access_audit_logs").insert(
        emails.map((email) => ({
          actor_email: actor.email,
          action: "ADD_USER",
          target_email: email,
          details: { source: "bulk" },
        })),
      );
    } else if (["add_user", "remove_user", "set_section_access"].includes(action)) {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!isEiuEmail(email)) {
        return NextResponse.json(
          { success: false, message: "Email phải có đúng đuôi @eiu.edu.vn." }, { status: 400 },
        );
      }

      if (action === "add_user") {
        const { error } = await supabase.from("app_users").upsert(
          { email, status: "active", updated_at: new Date().toISOString() }, { onConflict: "email" },
        );
        if (error) throw error;
        await supabase.from("access_audit_logs").insert({
          actor_email: actor.email, action: "ADD_USER", target_email: email,
        });
      } else if (action === "remove_user") {
        const { data: target, error: targetError } = await supabase
          .from("app_users").select("is_admin").eq("email", email).maybeSingle();
        if (targetError) throw targetError;
        if (target?.is_admin) {
          return NextResponse.json(
            { success: false, message: "Không thể xóa tài khoản admin tại màn hình này." }, { status: 400 },
          );
        }
        const { error } = await supabase.from("app_users").delete().eq("email", email);
        if (error) throw error;
        await supabase.from("access_audit_logs").insert({
          actor_email: actor.email, action: "REMOVE_USER", target_email: email,
        });
      } else {
        const sectionId = String(body.sectionId ?? "");
        const enabled = body.enabled === true;
        const { data: section, error: sectionError } = await supabase
          .from("course_sections").select("id, title, course_id")
          .eq("id", sectionId).neq("status", "archived").maybeSingle();
        if (sectionError) throw sectionError;
        if (!section) {
          return NextResponse.json({ success: false, message: "Section không tồn tại." }, { status: 404 });
        }
        if (enabled) {
          const { error } = await supabase.from("user_section_access").upsert(
            { user_email: email, section_id: sectionId, granted_by: actor.email },
            { onConflict: "user_email,section_id" },
          );
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_section_access").delete()
            .eq("user_email", email).eq("section_id", sectionId);
          if (error) throw error;
        }
        await supabase.from("access_audit_logs").insert({
          actor_email: actor.email,
          action: enabled ? "GRANT_SECTION" : "REVOKE_SECTION",
          target_email: email, course_id: section.course_id,
          details: { sectionId, sectionTitle: section.title },
        });
      }
    } else if (action === "create_course") {
      const title = String(body.title ?? "").trim();
      const slug = slugify(title);
      if (!title || title.length > 120 || !slug) {
        return NextResponse.json({ success: false, message: "Tên khóa học không hợp lệ." }, { status: 400 });
      }
      const { data: course, error } = await supabase.from("courses")
        .insert({ title, slug, status: "active" }).select("id").single();
      if (error) throw error;
      await supabase.from("access_audit_logs").insert({
        actor_email: actor.email, action: "CREATE_COURSE", course_id: course.id, details: { title, slug },
      });
    } else if (action === "delete_course") {
      const courseId = String(body.courseId ?? "");
      const { data: course, error: readError } = await supabase
        .from("courses").select("id, slug, title").eq("id", courseId).maybeSingle();
      if (readError) throw readError;
      if (!course) return NextResponse.json({ success: false, message: "Khóa học không tồn tại." }, { status: 404 });
      if (course.slug === APPLIED_AGENTIC_AI_SLUG) {
        return NextResponse.json(
          { success: false, message: "Không thể xóa khóa học nội dung đang được triển khai." }, { status: 400 },
        );
      }
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
      await supabase.from("access_audit_logs").insert({
        actor_email: actor.email, action: "DELETE_COURSE", course_id: courseId,
        details: { title: course.title },
      });
    } else if (action === "create_section") {
      const courseId = String(body.courseId ?? "");
      const title = String(body.title ?? "").trim();
      const { data: course, error: courseError } = await supabase
        .from("courses").select("slug").eq("id", courseId).maybeSingle();
      if (courseError) throw courseError;
      if (!course || !title || title.length > 120) {
        return NextResponse.json({ success: false, message: "Khóa học hoặc tên section không hợp lệ." }, { status: 400 });
      }
      const sectionKey = `${course.slug}-${slugify(title)}-${Date.now().toString(36)}`;
      const { data: lastSection } = await supabase.from("course_sections")
        .select("position").eq("course_id", courseId).order("position", { ascending: false })
        .limit(1).maybeSingle();
      const { data: section, error } = await supabase.from("course_sections").insert({
        course_id: courseId, section_key: sectionKey, title,
        position: Number(lastSection?.position ?? 0) + 1, status: "active",
      }).select("id").single();
      if (error) throw error;
      await supabase.from("access_audit_logs").insert({
        actor_email: actor.email, action: "CREATE_SECTION", course_id: courseId,
        details: { sectionId: section.id, title, sectionKey },
      });
    } else if (action === "delete_section") {
      const sectionId = String(body.sectionId ?? "");
      const { data: section, error: readError } = await supabase.from("course_sections")
        .select("id, section_key, title, course_id").eq("id", sectionId).maybeSingle();
      if (readError) throw readError;
      if (!section) return NextResponse.json({ success: false, message: "Section không tồn tại." }, { status: 404 });
      if (section.section_key === "section1" || section.section_key === "section2") {
        return NextResponse.json(
          { success: false, message: "Không thể xóa Section 1/2 đang gắn với nội dung hiện tại." }, { status: 400 },
        );
      }
      const { error } = await supabase.from("course_sections").delete().eq("id", sectionId);
      if (error) throw error;
      await supabase.from("access_audit_logs").insert({
        actor_email: actor.email, action: "DELETE_SECTION", course_id: section.course_id,
        details: { sectionId, title: section.title },
      });
    } else {
      return NextResponse.json({ success: false, message: "Thao tác không hợp lệ." }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...(await loadAccessData()) });
  } catch (error) {
    console.error("Update access data error:", error);
    const message = error instanceof Error && error.message.toLowerCase().includes("duplicate")
      ? "Tên khóa học đã tồn tại." : "Không thể cập nhật dữ liệu quản trị.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
