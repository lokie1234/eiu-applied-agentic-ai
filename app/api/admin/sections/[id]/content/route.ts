import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canManageSection } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { prepareSectionFile, MAX_SECTION_BYTES } from "@/lib/sectionContent";
import { uploadDriveSection } from "@/lib/drive/sectionContent";
import { localSectionSourcePath } from "@/lib/localSectionContent";

export const runtime = "nodejs";
export const maxDuration = 120;
const BUCKET = "course-section-content";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await canManageSection(id))) return NextResponse.json({ success: false, message: "Section management access required." }, { status: 403 });
  try {
    const db = getSupabaseAdmin();
    const { data: section, error } = await db.from("course_sections").select("id,course_id,section_key,content_type,content_path,original_content_path,source_filename").eq("id",id).maybeSingle();
    if (error) throw Error("Unable to load section.");
    if (!section) return NextResponse.json({success:false,message:"Section not found."},{status:404});
    let bytes: Uint8Array, name: string, destinationId = "";
    if (request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ success: false, message: "Drive import and migration are no longer supported. Use Save to Drive to export web documents." }, { status: 410 });
    } else {
      let form: FormData;
      try { form = await request.formData(); } catch { return NextResponse.json({success:false,message:"Upload data is incomplete or invalid. Choose the file again."},{status:400}); }
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) return NextResponse.json({success:false,message:"Choose a PDF, JS, or PPTX file."},{status:400});
      if (file.size > MAX_SECTION_BYTES) return NextResponse.json({success:false,message:"The maximum file size is 50 MB."},{status:413});
      bytes = new Uint8Array(await file.arrayBuffer()); name = file.name; destinationId = String(form.get("destinationId") || "");
    }
    let validated;
    try { validated = await prepareSectionFile(bytes,name); bytes = validated.bytes; name = validated.name; } catch (error) { return NextResponse.json({success:false,message:error instanceof Error ? error.message : "Invalid file."},{status:400}); }
    const parent = await db.from("courses").select("slug,title").eq("id",section.course_id).maybeSingle();
    if (parent.error) throw Error("Unable to load section.");
    if (["section1","section2"].includes(String(section.section_key))) {
      if (parent.data?.slug === "applied-agentic-ai" && validated.contentType !== "pptx") return NextResponse.json({success:false,message:"Built-in lessons accept PPTX attachments only. Choose a custom section for PDF or JS."},{status:400});
    }
    const contentSource = parent.data && localSectionSourcePath({ id: String(section.course_id) }, { id: String(section.id), content_type: validated.contentType }) ? "project-tsx" : "uploaded";
    const driveId = await uploadDriveSection({ sectionId:id, destinationId, name, bytes, mimeType:validated.mimeType });
    const contentPath = "drive:" + driveId;
    let update = db.from("course_sections").update({content_type:validated.contentType,content_path:contentPath,original_content_path:null,source_filename:name,slide_count:validated.slideCount,updated_at:new Date().toISOString()}).eq("id",id);
    update = section.content_path ? update.eq("content_path", section.content_path) : update.is("content_path", null);
    const updated = await update.select("id").maybeSingle();
    if (updated.error || !updated.data) throw Error("The file is on Drive, but the section changed or could not be updated. The existing lesson is unchanged; reload and retry.");
    // Drive files remain owned by the administrator. Only obsolete web-storage copies are removed.
    const obsolete = [...new Set([section.content_path, section.original_content_path].filter((path): path is string => typeof path === "string" && path.startsWith(`${section.course_id}/${section.id}/`)))];
    if (obsolete.length) after(async () => { const result = await db.storage.from(BUCKET).remove(obsolete); if (result.error) console.error("Legacy section file cleanup failed."); });
    revalidatePath("/learn");
    return NextResponse.json({success:true,contentType:validated.contentType,contentPath,sourceFilename:name,slideCount:validated.slideCount,contentSource,message:contentSource === "project-tsx" ? "File saved to Drive. Slides continue to use the TSX in the project." : "File saved to Drive and connected to this section."});
  } catch (error) {
    // Provider exceptions may contain tokens; only our own known messages are returned.
    const message = error instanceof Error && /^(Unable to read this Drive|Drive file verification|The file is on Drive|Original file unavailable|Unable to read the existing|Use a valid Google|Use a Google Drive|Choose a saved Drive|Choose a writable Drive)/.test(error.message) ? error.message : "Unable to connect the Drive file. Check Drive settings and try again.";
    return NextResponse.json({success:false,message},{status:502});
  }
}
