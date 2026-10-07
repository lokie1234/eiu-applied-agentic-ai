import { createHash } from "node:crypto";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { canManageSection } from "@/lib/auth/currentUser";
import { getCoursesAndSectionsData } from "@/lib/auth/courseAccessStorage";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { authorizedDriveClient } from "@/lib/drive/connection";
import { saveDriveOriginal } from "@/lib/drive/sourceUpload";
import { describeSectionSource, sectionSourceType } from "@/lib/sectionSourceFiles";

export const runtime = "nodejs";
export const maxDuration = 120;
const TABLE = "section_source_files";
const FIELDS = "id,section_id,original_filename,exported_filename,file_type,byte_size,status,created_at,updated_at";
const headers = { "Cache-Control": "no-store, private" };
const json = (data: object, status = 200) => NextResponse.json(data, { status, headers });
function databaseMessage(error: { code?: string }) {
  return ["42P01", "PGRST205"].includes(error.code ?? "")
    ? "Chạy migration 202610070001_section_source_files.sql trong Supabase SQL Editor trước khi dùng thư viện nguồn."
    : "Không thể lưu danh mục file. Thử lại sau.";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await canManageSection(id))) return json({ message: "Section management access required." }, 403);
  const { data, error } = await getSupabaseAdmin().from(TABLE).select(FIELDS).eq("section_id", id).order("created_at", { ascending: false }).limit(200);
  if (error) return json({ message: databaseMessage(error) }, 503);
  return json({ sources: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await canManageSection(id))) return json({ message: "Section management access required." }, 403);
  const db = getSupabaseAdmin();
  let sourceId = "";
  let claimed = false;
  try {
    const form = await request.formData();
    const file = form.get("file");
    sourceId = String(form.get("sourceId") ?? "");
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(sourceId)) return json({ message: "Invalid upload ID." }, 400);
    if (!(file instanceof File) || file.size === 0) return json({ message: "Chọn file PDF, PPTX hoặc TSX." }, 400);
    if (file.size > 50 * 1024 * 1024) return json({ message: "File tối đa 50 MB." }, 413);
    let type;
    try { type = sectionSourceType(file.name); } catch { return json({ message: "Chỉ hỗ trợ PDF, PPTX và TSX." }, 400); }
    const body = new Uint8Array(await file.arrayBuffer());
    if (type === "pdf" && !Buffer.from(body.subarray(0, 1024)).includes(Buffer.from("%PDF-"))) return json({ message: "File không có định dạng PDF hợp lệ." }, 400);
    if (type === "pptx") {
      try {
        const zip = await JSZip.loadAsync(body);
        if (!zip.file("[Content_Types].xml") || !zip.file("ppt/presentation.xml") || !zip.file(/^ppt\/slides\/slide\d+\.xml$/).length) throw new Error("Invalid PPTX.");
      } catch { return json({ message: "File không có định dạng PPTX hợp lệ." }, 400); }
    }
    // TSX is archived as original bytes here; execution validation happens at publish.
    const sha256 = createHash("sha256").update(body).digest("hex");
    const catalog = await getCoursesAndSectionsData();
    const section = catalog.sections.find(item => item.id === id);
    const course = catalog.courses.find(item => item.id === section?.course_id);
    if (!section || !course) return json({ message: "Section not found." }, 404);
    const folder = catalog.folderGroups.find(item => item.id === course.folderGroupId);
    const exported = describeSectionSource({ folderName: folder?.name ?? course.folderGroupName, courseTitle: course.title, sectionTitle: section.title, originalFilename: file.name, sourceId, uploadedAt: new Date() });
    // Confirm DB availability before making any external file write.
    const existing = await db.from(TABLE).select("id,section_id,sha256,status,exported_filename,drive_folder_id,updated_at").eq("id", sourceId).maybeSingle();
    if (existing.error) return json({ message: databaseMessage(existing.error) }, 503);
    if (existing.data) {
      if (existing.data.section_id !== id || existing.data.sha256 !== sha256) return json({ message: "Upload ID belongs to different content." }, 409);
      if (existing.data.status === "ready") return json({ success: true });
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const claim = await db.from(TABLE).update({ status: "uploading", updated_at: new Date().toISOString() }).eq("id", sourceId)
        .or(`status.eq.failed,and(status.eq.uploading,updated_at.lt.${cutoff})`).select("id").maybeSingle();
      if (claim.error) return json({ message: databaseMessage(claim.error) }, 503);
      if (!claim.data) return json({ message: "File đang được lưu. Đợi vài phút rồi tải lại danh sách trước khi thử lại." }, 409);
    } else {
      const insert = await db.from(TABLE).insert({ id: sourceId, section_id: id, original_filename: file.name, exported_filename: exported.name, file_type: type, byte_size: file.size, sha256, drive_folder_id: exported.driveFolderId });
      if (insert.error) return json({ message: databaseMessage(insert.error) }, 503);
    }
    claimed = true;
    const client = await authorizedDriveClient();
    const driveId = await saveDriveOriginal(client, {
      sourceId, sectionId: id, folderId: existing.data?.drive_folder_id ?? exported.driveFolderId,
      name: existing.data?.exported_filename ?? exported.name, sha256, body,
      mimeType: type === "pdf" ? "application/pdf" : type === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "text/plain",
    });
    const saved = await db.from(TABLE).update({ drive_file_id: driveId, status: "ready", updated_at: new Date().toISOString() }).eq("id", sourceId);
    if (saved.error) throw new Error("Catalog update failed.");
    return json({ success: true });
  } catch {
    if (claimed) await db.from(TABLE).update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", sourceId);
    return json({ message: "Chưa lưu xong file vào Drive và danh mục. Thử lại cùng file; bản bài học đang dạy được giữ nguyên." }, 502);
  }
}
