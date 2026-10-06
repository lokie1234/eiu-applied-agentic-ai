import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireCourseManager } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  clearAllAuthorizedEmails,
  clearCourseEmails,
  createFolderGroup,
  deleteFolderGroup,
  generateNewCoursePasscode,
  getAllAuthorizedEmails,
  getCoursesAndSectionsData,
  parseCourseMetadata,
  removeAuthorizedEmails,
  removeCourseEmail,
  serializeCourseMetadata,
  setAllCoursesUnlocked,
  setAuthorizedEmailsBulk,
  setCourseEmailsBulk,
  setCourseFolderGroup,
  setCoursePasscode,
  setCourseUnlocked,
  setFolderGroupUnlocked,
  setSectionPasscode,
  updateCourseSummary,
  updateCourseSystemIcons,
  updateFolderGroup,
} from "@/lib/auth/courseAccessStorage";

export const runtime = "nodejs";

const LANGUAGE_LABELS = new Set(["vi", "en", "vi_en"]);
const SECTION_CONTENT_BUCKET = "course-section-content";

async function removeSectionFiles(paths: Array<string | null | undefined>) {
  const cleanPaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (cleanPaths.length === 0) return;
  await getSupabaseAdmin().storage.from(SECTION_CONTENT_BUCKET).remove(cleanPaths);
}

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
  const actor = await requireCourseManager();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });
  }
  try {
    if (!actor.isAdmin) return NextResponse.json({ success: true, ...await teacherData(actor.authUserId) });
    const data = await getCoursesAndSectionsData();
    const authorizedEmails = await getAllAuthorizedEmails(data.courses);
    return NextResponse.json({ success: true, ...data, authorizedEmails });
  } catch (error) {
    console.error("Load admin data error:", error);
    return NextResponse.json({ success: false, message: "Unable to load administration data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireCourseManager();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const supabase = getSupabaseAdmin();
    if (!actor.isAdmin) {
      const allowed = ["create_course", "create_section", "delete_section", "delete_sections", "rename_section", "reorder_sections", "update_course_title", "update_course_summary", "update_course_description", "set_course_language", "delete_course"];
      if (!allowed.includes(action)) return NextResponse.json({ message: "Administrator access required for this action." }, { status: 403 });
      if (["delete_section", "delete_sections", "rename_section"].includes(action)) {
        const ids = action === "delete_sections" && Array.isArray(body.sectionIds) ? body.sectionIds.map(String) : [String(body.sectionId ?? "")];
        const { data, error } = await supabase.from("course_sections").select("id,created_by").in("id", ids);
        if (error) throw error;
        if (!ids.length || data?.length !== new Set(ids).size || data.some(section => section.created_by !== actor.authUserId)) return NextResponse.json({ message: "You can only edit your own sections." }, { status: 403 });
      } else if (action !== "create_course") {
        const courseId = String(body.courseId ?? "");
        const { data: course, error } = await supabase.from("courses").select("created_by").eq("id", courseId).maybeSingle();
        if (error) throw error;
        if (!course || course.created_by !== actor.authUserId) return NextResponse.json({ message: "You can only manage your own courses." }, { status: 403 });
        if (["delete_course", "reorder_sections"].includes(action)) {
          const { count, error: sectionError } = await supabase.from("course_sections").select("id", { count: "exact", head: true }).eq("course_id", courseId).or('created_by.is.null,created_by.neq.' + actor.authUserId);
          if (sectionError) throw sectionError;
          if (count) return NextResponse.json({ message: "This course contains sections owned by another user." }, { status: 403 });
        }
      }
    }
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
    } else if (action === "update_course_system_icons") {
      const courseId = String(body.courseId ?? "");
      const systemIcons = Array.isArray(body.systemIcons) ? body.systemIcons : [];
      if (!courseId) {
        return NextResponse.json({ success: false, message: "Missing course ID." }, { status: 400 });
      }
      await updateCourseSystemIcons(courseId, systemIcons);
    } else if (action === "create_course") {
      const title = String(body.title ?? "").trim();
      const titles: string[] = Array.isArray(body.titles) ? body.titles.map((value: unknown) => String(value).trim()) : [title];
      const folderGroupId = String(body.folderGroupId ?? "fg-ai-agentic").trim();
      const folderGroupName = String(body.folderGroupName ?? "Chương Trình AI & Agentic").trim();
      const slugs = titles.map(slugify);
      if (!titles.length || titles.length > 100 || titles.some((value) => !value || value.length > 120) || slugs.some((slug) => !slug)) {
        return NextResponse.json({ success: false, message: "Invalid course title." }, { status: 400 });
      }
      if (new Set(slugs).size !== slugs.length) {
        return NextResponse.json({ success: false, message: "Course names must be distinct." }, { status: 400 });
      }
      const rows = titles.map((courseTitle, index) => ({
        created_by: actor.isTeacher ? actor.authUserId : null,
        title: courseTitle,
        slug: slugs[index],
        status: "active",
        language_label: "vi_en",
        description: JSON.stringify({
        summary: courseTitle,
        allowedEmails: [actor.email],
        sectionPasscodes: {},
        unlocked: false,
        folderGroupId,
        folderGroupName,
        }),
      }));
      const { error } = await supabase
        .from("courses")
        .insert(rows);
      if (error?.code === "23505") {
        return NextResponse.json({ success: false, message: "A course with one of these names already exists. Choose different names." }, { status: 409 });
      }
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
    } else if (action === "reorder_courses") {
      const folderId = String(body.folderGroupId ?? "");
      const ids: string[] = Array.isArray(body.courseIds) ? body.courseIds.map(String) : [];
      const data = await getCoursesAndSectionsData();
      const members = data.courses.filter((course) => course.status === "active" && course.folderGroupId === folderId);
      if (!folderId || !ids.length || new Set(ids).size !== ids.length || ids.length !== members.length ||
          members.some((course) => !ids.includes(course.id))) {
        return NextResponse.json({ success: false, message: "The folder contents have changed. Refresh and try again." }, { status: 400 });
      }
      const { data: originals, error: readError } = await supabase.from("courses").select("id, description").in("id", ids);
      if (readError) throw readError;
      if (originals?.length !== ids.length) throw new Error("Course list changed.");
      try {
        for (const [index, id] of ids.entries()) {
          const original = originals.find((course) => course.id === id)!;
          const metadata = parseCourseMetadata(original.description);
          const { error } = await supabase.from("courses").update({
            description: serializeCourseMetadata({ ...metadata, folderOrder: index + 1 }),
          }).eq("id", id);
          if (error) throw error;
        }
      } catch (error) {
        for (const course of originals) {
          const { error: rollbackError } = await supabase.from("courses").update({ description: course.description }).eq("id", course.id);
          if (rollbackError) console.error("Course order rollback error:", rollbackError);
        }
        throw error;
      }
      revalidatePath("/learn");
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
        .select("id, slug")
        .eq("id", courseId)
        .maybeSingle();
      if (readError) throw readError;
      if (!course) return NextResponse.json({ success: false, message: "Course not found." }, { status: 404 });
      if (course.slug === APPLIED_AGENTIC_AI_SLUG) {
        return NextResponse.json({ success: false, message: "The core course cannot be deleted." }, { status: 400 });
      }
      const { data: courseSectionFiles } = await supabase
        .from("course_sections")
        .select("content_path")
        .eq("course_id", courseId);
      await removeSectionFiles((courseSectionFiles ?? []).map((item) => item.content_path));
      // Delete associated sections first
      await supabase.from("course_sections").delete().eq("course_id", courseId);
      try {
        await supabase.from("course_passcodes").delete().eq("course_id", courseId);
      } catch {}
      try {
        await supabase.from("user_unlocked_courses").delete().eq("course_id", courseId);
      } catch {}
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
      const { data: batchSectionFiles } = await supabase
        .from("course_sections")
        .select("content_path")
        .in("course_id", validCourseIds);
      await removeSectionFiles((batchSectionFiles ?? []).map((item) => item.content_path));
      await supabase.from("course_sections").delete().in("course_id", validCourseIds);
      try {
        await supabase.from("course_passcodes").delete().in("course_id", validCourseIds);
      } catch {}
      try {
        await supabase.from("user_unlocked_courses").delete().in("course_id", validCourseIds);
      } catch {}
      try {
        await supabase.from("course_folder_allowed_emails").delete().in("course_id", validCourseIds);
      } catch {}
      const { error } = await supabase.from("courses").delete().in("id", validCourseIds);
      if (error) throw error;
    } else if (action === "create_section") {
      const courseId = String(body.courseId ?? "");
      const title = String(body.title ?? "").trim();
      const titles = Array.isArray(body.titles) ? body.titles.map((value: unknown) => String(value).trim()) : [title];
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("slug")
        .eq("id", courseId)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!course || titles.length === 0 || titles.length > 100 || titles.some((value: string) => !value || value.length > 120)) {
        return NextResponse.json({ success: false, message: "Invalid section title." }, { status: 400 });
      }
      const { data: last, error: positionError } = await supabase
        .from("course_sections")
        .select("position")
        .eq("course_id", courseId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (positionError) throw positionError;
      const stamp = Date.now().toString(36);
      const rows = titles.map((sectionTitle: string, index: number) => ({
        created_by: actor.isTeacher ? actor.authUserId : null,
        course_id: courseId,
        section_key: `${course.slug}-${slugify(sectionTitle)}-${stamp}-${index}`,
        title: sectionTitle,
        position: Number(last?.position ?? 0) + index + 1,
        status: "active",
      }));
      const { error } = await supabase.from("course_sections").insert(rows);
      if (error) throw error;

      // Assign initial 4-digit code for the new section
      for (const row of rows) {
        await setSectionPasscode(courseId, row.section_key, randomInt(1000, 9999).toString());
      }
    } else if (action === "reorder_sections") {
      const courseId = String(body.courseId ?? "");
      const ids: string[] = Array.isArray(body.sectionIds) ? body.sectionIds.map(String) : [];
      const { data: existing, error: readError } = await supabase.from("course_sections")
        .select("id, position").eq("course_id", courseId).eq("status", "active");
      if (readError) throw readError;
      if (!courseId || !ids.length || new Set(ids).size !== ids.length || ids.length !== existing?.length ||
          existing.some((section) => !ids.includes(section.id))) {
        return NextResponse.json({ success: false, message: "The section list has changed. Refresh and try again." }, { status: 400 });
      }
      try {
        for (const [index, id] of ids.entries()) {
          const { error } = await supabase.from("course_sections")
            .update({ position: index + 1 }).eq("id", id).eq("course_id", courseId);
          if (error) throw error;
        }
      } catch (error) {
        // Restore the previous order if a database write fails partway through.
        for (const section of existing) {
          const { error: rollbackError } = await supabase.from("course_sections")
            .update({ position: section.position }).eq("id", section.id).eq("course_id", courseId);
          if (rollbackError) console.error("Section order rollback error:", rollbackError);
        }
        throw error;
      }
      revalidatePath("/learn");
    } else if (action === "rename_section") {
      const sectionId = String(body.sectionId ?? "");
      const title = String(body.title ?? "").trim();
      if (!sectionId || !title || title.length > 120) {
        return NextResponse.json({ success: false, message: "Invalid section title." }, { status: 400 });
      }
      const { data: section, error } = await supabase
        .from("course_sections")
        .update({ title })
        .eq("id", sectionId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!section) return NextResponse.json({ success: false, message: "Section not found." }, { status: 404 });
      revalidatePath("/learn");
    } else if (action === "delete_section") {
      const sectionId = String(body.sectionId ?? "");
      const { data: section, error: readError } = await supabase
        .from("course_sections")
        .select("id, section_key, course_id, content_path")
        .eq("id", sectionId)
        .maybeSingle();
      if (readError) throw readError;
      if (!section) return NextResponse.json({ success: false, message: "Section not found." }, { status: 404 });

      const { data: parentCourse } = await supabase
        .from("courses")
        .select("id, slug, description")
        .eq("id", section.course_id)
        .maybeSingle();

      if (["section1", "section2"].includes(section.section_key) && parentCourse?.slug === APPLIED_AGENTIC_AI_SLUG) {
        return NextResponse.json({ success: false, message: "The default Section 1 and Section 2 of core course cannot be deleted." }, { status: 400 });
      }

      try {
        await supabase.from("course_passcodes").delete().eq("section_key", section.section_key);
      } catch {}

      if (parentCourse?.description) {
        try {
          const meta = parseCourseMetadata(parentCourse.description);
          if (meta.sectionPasscodes && (meta.sectionPasscodes[section.section_key] || meta.sectionPasscodes[section.id])) {
            delete meta.sectionPasscodes[section.section_key];
            delete meta.sectionPasscodes[section.id];
            await supabase.from("courses").update({
              description: serializeCourseMetadata(meta),
              updated_at: new Date().toISOString(),
            }).eq("id", parentCourse.id);
          }
        } catch {}
      }

      await removeSectionFiles([section.content_path]);
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
        .select("id, section_key, course_id, content_path")
        .in("id", sectionIds);
      if (readError) throw readError;

      const { data: coreCourse } = await supabase
        .from("courses")
        .select("id")
        .eq("slug", APPLIED_AGENTIC_AI_SLUG)
        .maybeSingle();

      const validSecs = (secs || []).filter((s) => {
        const isCoreSec = ["section1", "section2"].includes(s.section_key) && s.course_id === coreCourse?.id;
        return !isCoreSec;
      });

      if (validSecs.length === 0) {
        return NextResponse.json({ success: false, message: "Default core sections cannot be deleted." }, { status: 400 });
      }
      const validIds = validSecs.map((s) => s.id);
      const validKeys = validSecs.map((s) => s.section_key);

      try {
        await supabase.from("course_passcodes").delete().in("section_key", validKeys);
      } catch {}

      const courseIds = [...new Set(validSecs.map((s) => s.course_id))];
      for (const cId of courseIds) {
        const { data: c } = await supabase.from("courses").select("id, description").eq("id", cId).maybeSingle();
        if (c?.description) {
          try {
            const meta = parseCourseMetadata(c.description);
            let changed = false;
            for (const s of validSecs.filter((sec) => sec.course_id === cId)) {
              if (meta.sectionPasscodes?.[s.section_key]) {
                delete meta.sectionPasscodes[s.section_key];
                changed = true;
              }
              if (meta.sectionPasscodes?.[s.id]) {
                delete meta.sectionPasscodes[s.id];
                changed = true;
              }
            }
            if (changed) {
              await supabase.from("courses").update({
                description: serializeCourseMetadata(meta),
                updated_at: new Date().toISOString(),
              }).eq("id", c.id);
            }
          } catch {}
        }
      }

      await removeSectionFiles(validSecs.map((section) => section.content_path));
      const { error } = await supabase.from("course_sections").delete().in("id", validIds);
      if (error) throw error;
    } else {
      return NextResponse.json({ success: false, message: "Unsupported action." }, { status: 400 });
    }

    if (!actor.isAdmin) return NextResponse.json({ success: true, ...await teacherData(actor.authUserId) });
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

async function teacherData(actorId: string) {
  const db = getSupabaseAdmin();
  const [courses, sections] = await Promise.all([
    db.from("courses").select("id,slug,title,description,language_label,created_by").eq("status", "active").order("title"),
    db.from("course_sections").select("id,course_id,section_key,title,created_by,position,content_type,content_path,source_filename,slide_count").eq("status", "active").order("position"),
  ]);
  if (courses.error) throw courses.error;
  if (sections.error) throw sections.error;
  return {
    courses: courses.data.map(c => { const meta = parseCourseMetadata(c.description, c.title); return { id: c.id, slug: c.slug, title: c.title, summary: meta.summary, languageLabel: c.language_label, canEdit: c.created_by === actorId }; }),
    sections: sections.data.map(s => ({ ...s, canEdit: s.created_by === actorId })),
  };
}
