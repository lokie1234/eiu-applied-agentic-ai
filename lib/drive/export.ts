import "server-only";
import { createHash } from "node:crypto";
import type { OAuth2Client } from "google-auth-library";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCoursesAndSectionsData } from "@/lib/auth/courseAccessStorage";
import { driveDocumentName, driveSectionName, sectionSourceType } from "@/lib/sectionSourceFiles";
import { saveDriveOriginal } from "./sourceUpload";
import { driveFolderId } from "./destinations";
import { readLocalOriginal } from "./localOriginal";
import { readDriveFile } from "./sectionContent";
import { compileTsx, validateInteractiveJs } from "@/lib/sectionContent";
import { localSectionSourcePath, readLocalSectionSource } from "@/lib/localSectionContent";
function fileType(name: string) { return /\.js$/i.test(name) ? "js" as const : sectionSourceType(name); }
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
  const { data: stored, error } = await db.from("course_sections").select("id,course_id,content_type,content_path,original_content_path,source_filename").in("id", sections.map(item => item.id));
  if (error) throw error;
  const { data: sources, error: sourceError } = await db.from("section_source_files").select("id,section_id,original_filename,file_type").in("section_id", sections.map(item => item.id)).eq("status", "ready");
  if (sourceError) throw sourceError;
  const tasks: { sectionId: string; courseId: string; sourceId?: string; name: string; builtin?: boolean; note?: string; unavailable?: string }[] = [];
  for (const section of sections) {
    const row = stored?.find(item => item.id === section.id);
    const builtin = courses.some(course => course.id === section.course_id && course.slug === "applied-agentic-ai") && ["section1", "section2"].includes(section.section_key);
    if (builtin) tasks.push({ sectionId: section.id, courseId: section.course_id, builtin: true, name: driveSectionName(section.position, section.title, "js") });
    const course = courses.find(item => item.id === section.course_id);
    const local = row && course ? localSectionSourcePath(course, row) : null;
    if (local && row?.source_filename) {
      tasks.push({ sectionId: section.id, courseId: section.course_id, name: driveSectionName(section.position, section.title, "js"), note: "Self-contained JavaScript lesson. Export preserves the project file bytes." });
    } else if (row?.content_path && row.source_filename) {
      const type = fileType(row.source_filename);
      tasks.push({ sectionId: section.id, courseId: section.course_id, name: driveSectionName(section.position, section.title, type === "tsx" ? "js" : type) });
    }
    for (const source of sources ?? []) if (source.section_id === section.id) tasks.push({ sectionId: section.id, courseId: section.course_id, sourceId: source.id, name: driveDocumentName("", source.original_filename, source.file_type === "tsx" ? "js" : sectionSourceType(source.original_filename)) });
  }
  return tasks;
}
export async function exportDocument(client: OAuth2Client, input: { sectionId: string; sourceId?: string; folderId: string; name?: string }) {
  const db = getSupabaseAdmin();
  const { data: section, error } = await db.from("course_sections").select("id,course_id,title,position,content_type,content_path,original_content_path,source_filename").eq("id", input.sectionId).maybeSingle();
  if (error || !section) throw new Error("Section not found.");
  if (input.sourceId) {
    const { data: source, error } = await db.from("section_source_files").select("id,drive_file_id,original_filename,file_type").eq("id", input.sourceId).eq("section_id", section.id).eq("status", "ready").maybeSingle();
    if (error || !source?.drive_file_id) throw new Error("Source document not found.");
    if (source.file_type === "tsx") {
      const file = await readDriveFile(source.drive_file_id, client);
      const text = new TextDecoder().decode(file.bytes);
      const isJs = /\.js$/i.test(source.original_filename);
      if (isJs) validateInteractiveJs(text);
      const body = isJs ? file.bytes : Buffer.from(compileTsx(text));
      return saveDriveOriginal(client, { sourceId: source.id, sectionId: section.id, folderId: input.folderId, name: driveDocumentName(input.name ?? "", source.original_filename, "js"), mimeType: "text/javascript", body, sha256: createHash("sha256").update(body).digest("hex") });
    }
    const key = createHash("sha256").update(source.id).digest("hex");
    const found = await client.request<{ files: { id: string }[] }>({ url: "https://www.googleapis.com/drive/v3/files", timeout: 10000, params: { q: "'" + driveFolderId(input.folderId) + "' in parents and trashed=false and appProperties has { key='eiuCopiedSource' and value='" + key + "' }", fields: "files(id)" } });
    if (found.data.files[0]) return found.data.files[0].id;
    const copy = await client.request<{ id: string }>({ url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(source.drive_file_id) + "/copy", method: "POST", timeout: 30000, params: { supportsAllDrives: true, fields: "id" }, data: { name: driveDocumentName(input.name ?? "", source.original_filename, sectionSourceType(source.original_filename)), parents: [input.folderId], appProperties: { eiuCopiedSource: key } } });
    return copy.data.id;
  }
  if (section.content_type === "tsx" || /\.(tsx|js)$/i.test(section.source_filename ?? "")) {
    const catalog = await getCoursesAndSectionsData();
    const course = catalog.courses.find(item => item.id === section.course_id);
    const local = course ? await readLocalSectionSource(course, section) : null;
    let source: Uint8Array;
    let alreadyJs = false;
    if (local) { source = local; alreadyJs = true; }
    else if (section.content_path?.startsWith("drive:")) {
      source = (await readDriveFile(section.content_path, client)).bytes;
      alreadyJs = /\.js$/i.test(section.source_filename ?? "");
    } else {
      const recovered = !section.original_content_path ? await readLocalOriginal(section) : null;
      const sourcePath = section.original_content_path || section.content_path;
      if (recovered) { source = recovered; alreadyJs = true; }
      else {
        if (!sourcePath?.startsWith(section.course_id + "/" + section.id + "/")) throw new Error("Invalid stored document path.");
        const stored = await db.storage.from("course-section-content").download(sourcePath);
        if (stored.error || !stored.data || stored.data.size > 50 * 1024 * 1024) throw new Error("Unable to read the stored document.");
        source = new Uint8Array(await stored.data.arrayBuffer());
        alreadyJs = /\.js$/i.test(sourcePath);
      }
    }
    const text = new TextDecoder().decode(source);
    if (alreadyJs) validateInteractiveJs(text);
    const body = alreadyJs ? source : Buffer.from(compileTsx(text));
    if (body.byteLength > 50 * 1024 * 1024) throw new Error("Document exceeds 50 MB.");
    {
      const name = input.name?.trim() ? driveDocumentName(input.name, section.source_filename || "section.js", "js") : driveSectionName(section.position, section.title, "js");
      const hash = createHash("sha256").update("project-tsx:" + section.id).digest("hex").slice(0, 32);
      const sourceId = hash.slice(0,8) + "-" + hash.slice(8,12) + "-" + hash.slice(12,16) + "-" + hash.slice(16,20) + "-" + hash.slice(20);
      const sha256 = createHash("sha256").update(body).digest("hex");
      const fileId = await saveDriveOriginal(client, { sourceId, sectionId: section.id, folderId: input.folderId, name, sha256, body, mimeType: "text/javascript" });
      const verified = await readDriveFile(fileId, client);
      if (createHash("sha256").update(verified.bytes).digest("hex") !== sha256) throw new Error("Drive file verification failed. The existing lesson is unchanged.");
      if (!local && !(alreadyJs && section.content_path?.startsWith("drive:"))) {
        let update = db.from("course_sections").update({ content_path: "drive:" + fileId, original_content_path: null, source_filename: name, updated_at: new Date().toISOString() }).eq("id", section.id).eq("content_path", section.content_path);
        update = section.original_content_path ? update.eq("original_content_path", section.original_content_path) : update.is("original_content_path", null);
        const saved = await update.select("id").maybeSingle();
        if (saved.error || !saved.data) throw new Error("File saved to Drive, but the section changed or could not be updated. Reload and retry; the current lesson is unchanged.");
      }
      // Repository-controlled lessons continue displaying their project TSX.
      return fileId;
    }
  }
  if (!section.source_filename || !section.content_path) throw new Error("This section has no stored document.");
  const type = fileType(section.source_filename);
  const name = input.name?.trim() ? driveDocumentName(input.name, section.source_filename, type) : driveSectionName(section.position, section.title, type);
  const storagePath = section.content_path;
  const previous = { id: section.id, content_path: section.content_path, original_content_path: section.original_content_path };
  // Publish only after verifying Drive bytes and comparing the original source
  // reference, so a concurrent edit cannot be replaced by an older export.
  async function publish(fileId: string, body: Uint8Array) {
    const verified = await readDriveFile(fileId, client);
    if (createHash("sha256").update(verified.bytes).digest("hex") !== createHash("sha256").update(body).digest("hex")) throw new Error("Drive file verification failed. The existing lesson is unchanged.");
    let update = db.from("course_sections").update({
      content_path: "drive:" + fileId, original_content_path: null,
      source_filename: name, updated_at: new Date().toISOString(),
    }).eq("id", previous.id).eq("content_path", previous.content_path);
    update = previous.original_content_path ? update.eq("original_content_path", previous.original_content_path) : update.is("original_content_path", null);
    const result = await update.select("id").maybeSingle();
    if (result.error || !result.data) throw new Error("File saved to Drive, but the section changed or could not be updated. Reload and retry; the current lesson is unchanged.");
    return fileId;
  }
  if (storagePath.startsWith("drive:")) {
    const fileId = storagePath.slice(6);
    if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error("Invalid Drive file reference.");
    const copy = await client.request<{ id: string }>({ url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "/copy", method: "POST", timeout: 30000, params: { supportsAllDrives: true, fields: "id" }, data: { name, parents: [input.folderId] } });
    // Already Drive-backed: exporting a copy must not change the live source.
    return copy.data.id;
  }
  if (!storagePath.startsWith(section.course_id + "/" + section.id + "/")) throw new Error("Invalid stored document path.");
  const { data: file, error: downloadError } = await db.storage.from("course-section-content").download(storagePath);
  if (downloadError || !file) throw new Error("Unable to read the stored document.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Document exceeds 50 MB.");
  const body = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  const hash = createHash("sha256").update(section.id + ":" + storagePath).digest("hex").slice(0, 32);
  const sourceId = hash.slice(0,8) + "-" + hash.slice(8,12) + "-" + hash.slice(12,16) + "-" + hash.slice(16,20) + "-" + hash.slice(20);
  const fileId = await saveDriveOriginal(client, { sourceId, sectionId: section.id, folderId: input.folderId, name, sha256, body, mimeType: type === "pdf" ? "application/pdf" : type === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "text/plain" });
  return publish(fileId, body);
}
