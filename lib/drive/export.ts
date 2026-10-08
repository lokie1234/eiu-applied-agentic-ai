import "server-only";
import { createHash } from "node:crypto";
import type { OAuth2Client } from "google-auth-library";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCoursesAndSectionsData } from "@/lib/auth/courseAccessStorage";
import { driveDocumentName, sectionSourceType } from "@/lib/sectionSourceFiles";
import { saveDriveOriginal } from "./sourceUpload";
import { driveFolderId } from "./destinations";
export async function webFolder(client: OAuth2Client, parent: string, groupId?: string, courseId?: string) {
  const catalog = await getCoursesAndSectionsData();
  const group = courseId ? catalog.courses.find(item => item.id === courseId) : catalog.folderGroups.find(item => item.id === groupId);
  if (!group) throw new Error("Web folder not found.");
  const folderName = "name" in group ? group.name : group.title;
  const key = createHash("sha256").update((courseId ? "course:" : "") + group.id).digest("hex");
  const { data } = await client.request<{ files: { id: string; name: string }[] }>({ url: "https://www.googleapis.com/drive/v3/files", timeout: 10000,
    params: { q: "'" + driveFolderId(parent) + "' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='eiuWebFolder' and value='" + key + "' }", fields: "files(id,name)", pageSize: 10 } });
  if (data.files[0]) {
    if (data.files[0].name !== folderName) await client.request({ url: "https://www.googleapis.com/drive/v3/files/" + data.files[0].id, method: "PATCH", params: { supportsAllDrives: true }, data: { name: folderName }, timeout: 10000 });
    return data.files[0].id;
  }
  const created = await client.request<{ id: string }>({ url: "https://www.googleapis.com/drive/v3/files", method: "POST", timeout: 10000, params: { supportsAllDrives: true, fields: "id" }, data: { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parent], appProperties: { eiuWebFolder: key } } });
  return created.data.id;
}
export async function exportPlan(groupId?: string, sectionId?: string, courseId?: string) {
  const catalog = await getCoursesAndSectionsData();
  if (groupId && !catalog.folderGroups.some(item => item.id === groupId)) throw new Error("Web folder not found.");
  if (courseId && !catalog.courses.some(item => item.id === courseId)) throw new Error("Course not found.");
  const courses = catalog.courses.filter(course => (!groupId || course.folderGroupId === groupId) && (!courseId || course.id === courseId));
  const courseIds = new Set(courses.map(course => course.id));
  const sections = catalog.sections.filter(section => courseIds.has(section.course_id) && (!sectionId || section.id === sectionId));
  if (!sections.length) return [];
  const db = getSupabaseAdmin();
  const { data: stored, error } = await db.from("course_sections").select("id,content_type,content_path,original_content_path,source_filename").in("id", sections.map(item => item.id));
  if (error) throw error;
  const { data: sources, error: sourceError } = await db.from("section_source_files").select("id,section_id,original_filename,file_type").in("section_id", sections.map(item => item.id)).eq("status", "ready");
  if (sourceError) throw sourceError;
  const tasks: { sectionId: string; sourceId?: string; name: string; unavailable?: string }[] = [];
  for (const section of sections) {
    const row = stored?.find(item => item.id === section.id);
    const course = courses.find(item => item.id === section.course_id)!;
    const base = course.title + " — " + section.title;
    if (row?.content_path && row.source_filename) {
      const type = sectionSourceType(row.source_filename);
      tasks.push({ sectionId: section.id, name: driveDocumentName("", base, type), ...(type === "tsx" && !row.original_content_path ? { unavailable: "Original TSX is unavailable. Re-upload the TSX file to preserve its original source." } : {}) });
    }
    for (const source of sources ?? []) if (source.section_id === section.id) tasks.push({ sectionId: section.id, sourceId: source.id, name: driveDocumentName("", source.original_filename, sectionSourceType(source.original_filename)) });
  }
  return tasks;
}
export async function exportDocument(client: OAuth2Client, input: { sectionId: string; sourceId?: string; folderId: string; name?: string }) {
  const db = getSupabaseAdmin();
  const { data: section, error } = await db.from("course_sections").select("id,course_id,title,content_type,content_path,original_content_path,source_filename").eq("id", input.sectionId).maybeSingle();
  if (error || !section) throw new Error("Section not found.");
  if (input.sourceId) {
    const { data: source, error } = await db.from("section_source_files").select("id,drive_file_id,original_filename,file_type").eq("id", input.sourceId).eq("section_id", section.id).eq("status", "ready").maybeSingle();
    if (error || !source?.drive_file_id) throw new Error("Source document not found.");
    const key = createHash("sha256").update(source.id).digest("hex");
    const found = await client.request<{ files: { id: string }[] }>({ url: "https://www.googleapis.com/drive/v3/files", timeout: 10000, params: { q: "'" + driveFolderId(input.folderId) + "' in parents and trashed=false and appProperties has { key='eiuCopiedSource' and value='" + key + "' }", fields: "files(id)" } });
    if (found.data.files[0]) return found.data.files[0].id;
    const copy = await client.request<{ id: string }>({ url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(source.drive_file_id) + "/copy", method: "POST", timeout: 30000, params: { supportsAllDrives: true, fields: "id" }, data: { name: driveDocumentName(input.name ?? "", source.original_filename, sectionSourceType(source.original_filename)), parents: [input.folderId], appProperties: { eiuCopiedSource: key } } });
    return copy.data.id;
  }
  if (!section.source_filename || !section.content_path) throw new Error("This section has no stored document.");
  const type = sectionSourceType(section.source_filename);
  const storagePath = type === "tsx" ? section.original_content_path : section.content_path;
  if (!storagePath) throw new Error("Original TSX unavailable. Re-upload the original file first.");
  if (!storagePath.startsWith(section.course_id + "/" + section.id + "/")) throw new Error("Invalid stored document path.");
  const { data: file, error: downloadError } = await db.storage.from("course-section-content").download(storagePath);
  if (downloadError || !file) throw new Error("Unable to read the stored document.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Document exceeds 50 MB.");
  const body = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  const hash = createHash("sha256").update(section.id + ":" + storagePath).digest("hex").slice(0, 32);
  const sourceId = hash.slice(0,8) + "-" + hash.slice(8,12) + "-" + hash.slice(12,16) + "-" + hash.slice(16,20) + "-" + hash.slice(20);
  return saveDriveOriginal(client, { sourceId, sectionId: section.id, folderId: input.folderId, name: driveDocumentName(input.name ?? "", section.source_filename, type), sha256, body, mimeType: type === "pdf" ? "application/pdf" : type === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "text/plain" });
}
