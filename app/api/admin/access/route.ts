import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireCourseManager } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG, type CourseSystemIcon } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  getSlideTemplates,
  updateCourseMetadata,
  setFolderGroupHidden,
  createFolderGroup,
  deleteFolderGroup,
  getCoursesAndSectionsData,
  parseCourseMetadata,
  serializeCourseMetadata,
  setCourseFolderGroup,
  setSectionTemplate,
  updateCourseSummary,
  updateCourseSystemIcons,
  updateFolderGroup,
} from "@/lib/auth/courseAccessStorage";

import { saveAccessPasscode, saveAccessPasscodes } from "@/lib/auth/passcodes";

export const runtime = "nodejs";

const LANGUAGE_LABELS = new Set(["vi", "en", "vi_en"]);
const SECTION_CONTENT_BUCKET = "course-section-content";

async function removeSectionFiles(paths: Array<string | null | undefined>) {
  const cleanPaths = [...new Set(paths.filter((path): path is string => Boolean(path) && !path?.startsWith("drive:")))];
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
    return NextResponse.json({ success: false, message: "Course management access required." }, { status: 403 });
  }
  try {

    const data = await getCoursesAndSectionsData();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Load admin data error:", error);
    return NextResponse.json({ success: false, message: "Unable to load workspace data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireCourseManager();
  if (!actor) {
    return NextResponse.json({ success: false, message: "Course management access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const supabase = getSupabaseAdmin();


    let generatedCode: string | undefined;
    let createdCourseIds: string[] | undefined;
    let createdFolderGroupId: string | undefined;

    if (action === "set_course_template") {
      const templateKey = String(body.templateKey ?? "");
      if (templateKey && !(await getSlideTemplates()).some(template => template.id === templateKey)) return NextResponse.json({ message: "Template no longer exists. Refresh and choose another layout." }, { status: 400 });
      await updateCourseMetadata(String(body.courseId), current => ({ ...current, templateKey }));
    } else if (action === "set_course_hidden") {
      if (typeof body.hidden !== "boolean") return NextResponse.json({ message: "Invalid visibility." }, { status: 400 });
      await updateCourseMetadata(String(body.courseId), current => ({ ...current, hidden: body.hidden }));
    } else if (action === "set_folder_group_hidden") {
      if (typeof body.hidden !== "boolean") return NextResponse.json({ message: "Invalid visibility." }, { status: 400 });
      await setFolderGroupHidden(String(body.folderGroupId), body.hidden);
    } else if (action === "set_section_hidden") {
      if (typeof body.hidden !== "boolean" || typeof body.sectionId !== "string") return NextResponse.json({ message: "Invalid section visibility." }, { status: 400 });
      const catalog = await getCoursesAndSectionsData();
      const section = catalog.sections.find(section => section.id === body.sectionId);
      if (!section) return NextResponse.json({ message: "Section not found." }, { status: 404 });
      await updateCourseMetadata(section.course_id, current => ({
        ...current,
        hiddenSectionIds: body.hidden ? [...new Set([...(current.hiddenSectionIds || []), section.id])] : (current.hiddenSectionIds || []).filter(id => id !== section.id),
      }));
    } else if (action === "bulk_access_passcodes") {
      if (!Array.isArray(body.targets) || !body.targets.length || body.targets.length > 200 || body.targets.some((target: { kind?: unknown; id?: unknown } | null) => !target || !["folder", "course"].includes(String(target.kind)) || typeof target.id !== "string") || !Array.isArray(body.modes) || !body.modes.length || body.modes.some((mode: unknown) => !["learner", "facilitator"].includes(String(mode))) || !["generate", "clear"].includes(body.operation)) {
        return NextResponse.json({ success: false, message: "Invalid bulk passcode request." }, { status: 400 });
      }
      try {
        await saveAccessPasscodes(body.targets, body.modes, body.operation === "generate" ? null : "", body.unhide === true);
      } catch (error) {
        revalidatePath("/learn");
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to update passcodes.", ...await getCoursesAndSectionsData() }, { status: 409 });
      }
    } else if (action === "set_access_passcode") {
      if (!["global", "folder", "course"].includes(body.kind) || !["learner", "facilitator"].includes(body.mode) || typeof body.id !== "string" || (body.generate !== true && typeof body.code !== "string")) {
        return NextResponse.json({ success: false, message: "Invalid passcode scope or access type." }, { status: 400 });
      }
      try {
        generatedCode = await saveAccessPasscode({ kind: body.kind, id: body.id }, body.mode, body.generate === true ? null : body.code, body.unhide === true);
      } catch (error) {
        revalidatePath("/learn");
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to save passcode.", ...await getCoursesAndSectionsData() }, { status: 409 });
      }
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
      const systemIcons: CourseSystemIcon[] = Array.isArray(body.systemIcons) ? body.systemIcons : [];
      if (!courseId || !Array.isArray(body.systemIcons) || systemIcons.length > 50 || systemIcons.some(icon => !icon || typeof icon.id !== "string" || !icon.id || icon.id.length > 128 || typeof icon.name !== "string" || icon.name.length > 120 || typeof icon.url !== "string" || icon.url.length > 256_000 || !/^(https?:\/\/|data:image\/(png|jpeg|webp|svg\+xml)[;,])/i.test(icon.url) || (icon.scale !== undefined && (typeof icon.scale !== "number" || !Number.isFinite(icon.scale) || icon.scale <= 0 || icon.scale > 4))) || new Set(systemIcons.map(icon => icon.id)).size !== systemIcons.length) {
        return NextResponse.json({ success: false, message: "Invalid course icons. Use up to 50 image icons with labels of up to 120 characters." }, { status: 400 });
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
        created_by: null,
        title: courseTitle,
        slug: slugs[index],
        status: "active",
        language_label: "vi_en",
        description: JSON.stringify({
        summary: courseTitle,
        passcode: "",
        facilitatorPasscode: "",
        sectionAccessCodes: {},
        allowedEmails: [actor.email],
        sectionPasscodes: {},
        unlocked: false,
        folderGroupId,
        folderGroupName,
        }),
      }));
      const { data: created, error } = await supabase
        .from("courses")
        .insert(rows)
        .select("id");
      if (error?.code === "23505") {
        return NextResponse.json({ success: false, message: "A course with one of these names already exists. Choose different names." }, { status: 409 });
      }
      if (error) throw error;
      createdCourseIds = (created ?? []).map(course => String(course.id));
    } else if (action === "create_folder_group") {
      const name = String(body.name ?? "").trim();
      const description = typeof body.description === "string" ? body.description.trim() : undefined;
      if (!name || name.length > 120 || (description?.length ?? 0) > 2000) {
        return NextResponse.json({ success: false, message: "Enter a folder name of up to 120 characters and a description of up to 2000 characters." }, { status: 400 });
      }
      const folder = await createFolderGroup(name, description, undefined);
      createdFolderGroupId = folder.id;
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
        .select("content_path,original_content_path")
        .eq("course_id", courseId);
      await removeSectionFiles((courseSectionFiles ?? []).flatMap((item) => [item.content_path, item.original_content_path]));
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
        .select("content_path,original_content_path")
        .in("course_id", validCourseIds);
      await removeSectionFiles((batchSectionFiles ?? []).flatMap((item) => [item.content_path, item.original_content_path]));
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
        created_by: null,
        course_id: courseId,
        section_key: `${course.slug}-${slugify(sectionTitle)}-${stamp}-${index}`,
        title: sectionTitle,
        position: Number(last?.position ?? 0) + index + 1,
        status: "active",
      }));
      const { error } = await supabase.from("course_sections").insert(rows);
      if (error) throw error;

      if (body.useEiuTemplate === true) {
        try {
          await setSectionTemplate(courseId, rows.map((row: { section_key: string }) => row.section_key), true);
        } catch (templateError) {
          const { error: rollbackError } = await supabase.from("course_sections").delete().eq("course_id", courseId).in("section_key", rows.map((row: { section_key: string }) => row.section_key));
          if (rollbackError) console.error("Section creation rollback error:", rollbackError);
          throw templateError;
        }
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
        .select("id, section_key, course_id, content_path, original_content_path")
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
          if (meta.sectionAccessCodes?.[section.id] || meta.sectionPasscodes?.[section.section_key] || meta.sectionPasscodes?.[section.id]) {
            if (meta.sectionAccessCodes) delete meta.sectionAccessCodes[section.id];
            if (meta.sectionPasscodes) delete meta.sectionPasscodes[section.section_key];
            if (meta.sectionPasscodes) delete meta.sectionPasscodes[section.id];
            await supabase.from("courses").update({
              description: serializeCourseMetadata(meta),
              updated_at: new Date().toISOString(),
            }).eq("id", parentCourse.id);
          }
        } catch {}
      }

      await removeSectionFiles([section.content_path, section.original_content_path]);
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
        .select("id, section_key, course_id, content_path, original_content_path")
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
              if (meta.sectionAccessCodes?.[s.id]) {
                delete meta.sectionAccessCodes[s.id];
                changed = true;
              }
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

      await removeSectionFiles(validSecs.flatMap((section) => [section.content_path, section.original_content_path]));
      const { error } = await supabase.from("course_sections").delete().in("id", validIds);
      if (error) throw error;
    } else {
      return NextResponse.json({ success: false, message: "Unsupported action." }, { status: 400 });
    }


    revalidatePath("/learn");
    const updatedData = await getCoursesAndSectionsData();
    return NextResponse.json({
      success: true,
      ...updatedData,
      ...(generatedCode ? { generatedCode } : {}),
      ...(createdCourseIds ? { createdCourseIds } : {}),
      ...(createdFolderGroupId ? { createdFolderGroupId } : {}),
    });
  } catch (error) {
    console.error("Admin update error:", error);
    const databaseError = error as { code?: string; message?: string; details?: string } | null;
    if (databaseError?.code === "23503" && /created_by/.test(`${databaseError.message} ${databaseError.details}`)) {
      return NextResponse.json({ success: false, errorCode: "COURSE_OWNERSHIP_NOT_CONFIGURED", message: "Course ownership setup needs an administrator update. Please contact your administrator before trying again." }, { status: 409 });
    }
    const message = error instanceof Error && /duplicate|unique/i.test(error.message)
      ? "Duplicate item or entry already exists."
      : "Unable to update workspace data.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
