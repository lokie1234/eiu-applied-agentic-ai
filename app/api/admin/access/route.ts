import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  clearAllAuthorizedEmails,
  clearCourseEmails,
  createFolderGroup,
  deleteFolderGroup,
  generateNewCoursePasscode,
  generateNewSectionPasscode,
  getAllAuthorizedEmails,
  getCoursesAndSectionsData,
  removeAuthorizedEmails,
  removeCourseEmail,
  setAllCoursesUnlocked,
  setAuthorizedEmailsBulk,
  setCourseEmailsBulk,
  setCourseFolderGroup,
  setCoursePasscode,
  setCourseUnlocked,
  setFolderGroupUnlocked,
  setSectionPasscode,
  updateCourseSummary,
  updateFolderGroup,
} from "@/lib/auth/courseAccessStorage";

export const runtime = "nodejs";

const LANGUAGE_LABELS = new Set(["vi", "en", "vi_en"]);

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

export async function GET() {
  if (!(await requireAdminAccess())) {
    return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });
  }
  try {
    const data = await getCoursesAndSectionsData();
    const authorizedEmails = await getAllAuthorizedEmails(data.courses);
    return NextResponse.json({ success: true, ...data, authorizedEmails });
  } catch (error) {
    console.error("Load admin data error:", error);
    return NextResponse.json({ success: false, message: "Unable to load administration data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireAdminAccess();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const supabase = getSupabaseAdmin();
    let generatedCode: string | undefined;

    if (action === "grant_emails_bulk") {
      const rawEmails = body.emails ?? body.rawEmails ?? "";
      const mode = body.mode === "replace" ? "replace" : "append";
      await setAuthorizedEmailsBulk(rawEmails, mode);
    } else if (action === "remove_emails") {
      const emails = Array.isArray(body.emails)
        ? body.emails
        : [String(body.email ?? "")].filter(Boolean);
      await removeAuthorizedEmails(emails);
    } else if (action === "clear_emails") {
      await clearAllAuthorizedEmails();
    } else if (action === "set_course_unlocked") {
      const unlocked = Boolean(body.unlocked);
      const courseIds: string[] = Array.isArray(body.courseIds)
        ? (body.courseIds as unknown[]).map(String).filter(Boolean)
        : body.courseId ? [String(body.courseId)] : [];
      if (courseIds.length === 0) {
        return NextResponse.json({ success: false, message: "Missing course ID." }, { status: 400 });
      }
      for (const id of courseIds) {
        await setCourseUnlocked(id, unlocked);
      }
    } else if (action === "set_all_courses_unlocked") {
      const unlocked = Boolean(body.unlocked);
      await setAllCoursesUnlocked(unlocked);
    } else if (action === "generate_course_passcode") {
      const courseId = String(body.courseId ?? "");
      if (!courseId) {
        return NextResponse.json({ success: false, message: "Missing course ID." }, { status: 400 });
      }
      generatedCode = await generateNewCoursePasscode(courseId);
    } else if (action === "set_course_passcode") {
      const courseId = String(body.courseId ?? "");
      const code = String(body.code ?? "").trim();
      if (!courseId || !code) {
        return NextResponse.json({ success: false, message: "Invalid passcode." }, { status: 400 });
      }
      await setCoursePasscode(courseId, code);
    } else if (action === "generate_section_passcode") {
      const courseId = String(body.courseId ?? "");
      generatedCode = await generateNewCoursePasscode(courseId);
    } else if (action === "set_section_passcode") {
      const courseId = String(body.courseId ?? "");
      const code = String(body.code ?? "").trim();
      if (!courseId || !code) {
        return NextResponse.json({ success: false, message: "Invalid passcode." }, { status: 400 });
      }
      await setCoursePasscode(courseId, code);
    } else if (action === "delete_section_passcode") {
      const courseId = String(body.courseId ?? "");
      const sectionKey = String(body.sectionKey ?? "");
      await setSectionPasscode(courseId, sectionKey, "");
    } else if (action === "grant_course_emails_bulk") {
      const courseId = String(body.courseId ?? "");
      const rawEmails = body.emails ?? body.rawEmails ?? "";
      const mode = body.mode === "replace" ? "replace" : "append";
      if (!courseId) {
        return NextResponse.json({ success: false, message: "Missing course ID." }, { status: 400 });
      }
      await setCourseEmailsBulk(courseId, rawEmails, mode);
    } else if (action === "remove_course_email") {
      const courseId = String(body.courseId ?? "");
      const email = String(body.email ?? "").trim();
      if (!courseId || !email) {
        return NextResponse.json({ success: false, message: "Missing email to remove." }, { status: 400 });
      }
      await removeCourseEmail(courseId, email);
    } else if (action === "clear_course_emails") {
      const courseId = String(body.courseId ?? "");
      if (!courseId) {
        return NextResponse.json({ success: false, message: "Missing course ID." }, { status: 400 });
      }
      await clearCourseEmails(courseId);
    } else if (action === "set_course_language") {
      const courseId = String(body.courseId ?? "");
      const languageLabel = String(body.languageLabel ?? "");
      if (!LANGUAGE_LABELS.has(languageLabel)) {
        return NextResponse.json({ success: false, message: "Invalid language label." }, { status: 400 });
      }
      const { error } = await supabase
        .from("courses")
        .update({ language_label: languageLabel, updated_at: new Date().toISOString() })
        .eq("id", courseId);
      if (error) throw error;
    } else if (action === "update_course_description" || action === "update_course_summary") {
      const courseId = String(body.courseId ?? "");
      const summary = String(body.summary ?? body.description ?? "").trim();
      if (!courseId) {
        return NextResponse.json({ success: false, message: "Missing course ID." }, { status: 400 });
      }
      await updateCourseSummary(courseId, summary);
    } else if (action === "update_course_title") {
      const courseId = String(body.courseId ?? "");
      const title = String(body.title ?? "").trim();
      if (!courseId || !title || title.length > 120) {
        return NextResponse.json({ success: false, message: "Invalid course title." }, { status: 400 });
      }
      const { error } = await supabase
        .from("courses")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", courseId);
      if (error) throw error;
    } else if (action === "create_course") {
      const title = String(body.title ?? "").trim();
      const folderGroupId = String(body.folderGroupId ?? "fg-ai-agentic").trim();
      const folderGroupName = String(body.folderGroupName ?? "Chương Trình AI & Agentic").trim();
      const slug = slugify(title);
      if (!title || title.length > 120 || !slug) {
        return NextResponse.json({ success: false, message: "Invalid course title." }, { status: 400 });
      }
      const initialMeta = JSON.stringify({
        summary: title,
        allowedEmails: [actor.email],
        sectionPasscodes: {},
        unlocked: false,
        folderGroupId,
        folderGroupName,
      });
      const { error } = await supabase
        .from("courses")
        .insert({ title, slug, status: "active", language_label: "vi_en", description: initialMeta });
      if (error) throw error;
    } else if (action === "create_folder_group") {
      const name = String(body.name ?? "").trim();
      const description = typeof body.description === "string" ? body.description.trim() : undefined;
      if (!name) {
        return NextResponse.json({ success: false, message: "Folder name is required." }, { status: 400 });
      }
      await createFolderGroup(name, description);
    } else if (action === "update_folder_group") {
      const id = String(body.id ?? "");
      const name = String(body.name ?? "").trim();
      const description = typeof body.description === "string" ? body.description.trim() : undefined;
      if (!id || !name) {
        return NextResponse.json({ success: false, message: "Folder ID and name are required." }, { status: 400 });
      }
      await updateFolderGroup(id, name, description);
    } else if (action === "delete_folder_group") {
      const id = String(body.id ?? "");
      if (!id) {
        return NextResponse.json({ success: false, message: "Folder ID is required." }, { status: 400 });
      }
      await deleteFolderGroup(id);
    } else if (action === "delete_folder_groups") {
      const ids: string[] = Array.isArray(body.folderGroupIds)
        ? (body.folderGroupIds as unknown[]).map(String).filter(Boolean)
        : [];
      if (ids.length === 0) {
        return NextResponse.json({ success: false, message: "No folder groups selected." }, { status: 400 });
      }
      for (const id of ids) {
        await deleteFolderGroup(id);
      }
    } else if (action === "set_course_folder_group") {
      const courseId = String(body.courseId ?? "");
      const folderGroupId = String(body.folderGroupId ?? "");
      const folderGroupName = typeof body.folderGroupName === "string" ? body.folderGroupName : undefined;
      if (!courseId || !folderGroupId) {
        return NextResponse.json({ success: false, message: "Course ID and folder ID are required." }, { status: 400 });
      }
      await setCourseFolderGroup(courseId, folderGroupId, folderGroupName);
    } else if (action === "set_folder_group_unlocked") {
      const folderGroupId = String(body.folderGroupId ?? "");
      const unlocked = Boolean(body.unlocked);
      if (!folderGroupId) {
        return NextResponse.json({ success: false, message: "Folder ID is required." }, { status: 400 });
      }
      await setFolderGroupUnlocked(folderGroupId, unlocked);
    } else if (action === "delete_course") {
      const courseId = String(body.courseId ?? "");
      const { data: course, error: readError } = await supabase
        .from("courses")
        .select("slug")
        .eq("id", courseId)
        .maybeSingle();
      if (readError) throw readError;
      if (!course) return NextResponse.json({ success: false, message: "Course not found." }, { status: 404 });
      if (course.slug === APPLIED_AGENTIC_AI_SLUG) {
        return NextResponse.json({ success: false, message: "The core course cannot be deleted." }, { status: 400 });
      }
      // Delete associated sections first
      await supabase.from("course_sections").delete().eq("course_id", courseId);
      try {
        await supabase.from("course_folder_allowed_emails").delete().eq("course_id", courseId);
      } catch {}
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    } else if (action === "delete_courses") {
      const courseIds: string[] = Array.isArray(body.courseIds)
        ? (body.courseIds as unknown[]).map(String).filter(Boolean)
        : [];
      if (courseIds.length === 0) {
        return NextResponse.json({ success: false, message: "No courses selected." }, { status: 400 });
      }
      const { data: coursesToDelete, error: readError } = await supabase
        .from("courses")
        .select("id, slug")
        .in("id", courseIds);
      if (readError) throw readError;
      const validCourses = (coursesToDelete || []).filter((c) => c.slug !== APPLIED_AGENTIC_AI_SLUG);
      if (validCourses.length === 0) {
        return NextResponse.json({ success: false, message: "Core course cannot be deleted." }, { status: 400 });
      }
      const validCourseIds = validCourses.map((c) => c.id);
      await supabase.from("course_sections").delete().in("course_id", validCourseIds);
      try {
        await supabase.from("course_folder_allowed_emails").delete().in("course_id", validCourseIds);
      } catch {}
      const { error } = await supabase.from("courses").delete().in("id", validCourseIds);
      if (error) throw error;
    } else if (action === "create_section") {
      const courseId = String(body.courseId ?? "");
      const title = String(body.title ?? "").trim();
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("slug")
        .eq("id", courseId)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!course || !title || title.length > 120) {
        return NextResponse.json({ success: false, message: "Invalid section title." }, { status: 400 });
      }
      const { data: last } = await supabase
        .from("course_sections")
        .select("position")
        .eq("course_id", courseId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const newKey = `${course.slug}-${slugify(title)}-${Date.now().toString(36)}`;
      const { error } = await supabase.from("course_sections").insert({
        course_id: courseId,
        section_key: newKey,
        title,
        position: Number(last?.position ?? 0) + 1,
        status: "active",
      });
      if (error) throw error;

      // Assign initial 4-digit code for the new section
      const newPass = randomInt(1000, 9999).toString();
      await setSectionPasscode(courseId, newKey, newPass);
    } else if (action === "delete_section") {
      const sectionId = String(body.sectionId ?? "");
      const { data: section, error: readError } = await supabase
        .from("course_sections")
        .select("section_key")
        .eq("id", sectionId)
        .maybeSingle();
      if (readError) throw readError;
      if (!section) return NextResponse.json({ success: false, message: "Section not found." }, { status: 404 });
      if (["section1", "section2"].includes(section.section_key)) {
        return NextResponse.json({ success: false, message: "The default Section 1 and Section 2 cannot be deleted." }, { status: 400 });
      }
      const { error } = await supabase.from("course_sections").delete().eq("id", sectionId);
      if (error) throw error;
    } else if (action === "delete_sections") {
      const sectionIds: string[] = Array.isArray(body.sectionIds)
        ? (body.sectionIds as unknown[]).map(String).filter(Boolean)
        : [];
      if (sectionIds.length === 0) {
        return NextResponse.json({ success: false, message: "No sections selected." }, { status: 400 });
      }
      const { data: secs, error: readError } = await supabase
        .from("course_sections")
        .select("id, section_key")
        .in("id", sectionIds);
      if (readError) throw readError;
      const validIds = (secs || [])
        .filter((s) => !["section1", "section2"].includes(s.section_key))
        .map((s) => s.id);
      if (validIds.length === 0) {
        return NextResponse.json({ success: false, message: "Default sections cannot be deleted." }, { status: 400 });
      }
      const { error } = await supabase.from("course_sections").delete().in("id", validIds);
      if (error) throw error;
    } else {
      return NextResponse.json({ success: false, message: "Unsupported action." }, { status: 400 });
    }

    const updatedData = await getCoursesAndSectionsData();
    const authorizedEmails = await getAllAuthorizedEmails(updatedData.courses);
    return NextResponse.json({
      success: true,
      ...updatedData,
      authorizedEmails,
      ...(generatedCode ? { generatedCode } : {}),
    });
  } catch (error) {
    console.error("Admin update error:", error);
    const message = error instanceof Error && /duplicate|unique/i.test(error.message)
      ? "Duplicate item or entry already exists."
      : "Unable to update administration data.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
