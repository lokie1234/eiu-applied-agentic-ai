import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canManageSection } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readDriveFile } from "@/lib/drive/sectionContent";
import { prepareSectionFile } from "@/lib/sectionContent";
import { localSectionSourcePath } from "@/lib/localSectionContent";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await canManageSection(id)) return NextResponse.json({ message: "Section management access required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request." }, { status: 400 }); }
  if (!["preview", "connect"].includes(body?.action) || typeof body.fileId !== "string") return NextResponse.json({ message: "Choose a Drive file." }, { status: 400 });
  try {
    const db = getSupabaseAdmin();
    const { data: section, error } = await db.from("course_sections").select("id,course_id,section_key,content_type,content_path").eq("id", id).maybeSingle();
    if (error) throw Error();
    if (!section) return NextResponse.json({ message: "Section not found." }, { status: 404 });
    if (localSectionSourcePath({ id: String(section.course_id) }, { id, content_type: "tsx" })) return NextResponse.json({ message: "This lesson uses project TSX. Edit its registered project file to update the slides." }, { status: 409 });
    const parent = await db.from("courses").select("slug").eq("id", section.course_id).maybeSingle();
    if (parent.error || !parent.data) throw Error();
    const file = await readDriveFile(body.fileId);
    let validated;
    try { validated = await prepareSectionFile(file.bytes, file.name); }
    catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Invalid file." }, { status: 400 }); }
    if (parent.data.slug === "applied-agentic-ai" && ["section1", "section2"].includes(section.section_key) && validated.contentType !== "pptx") return NextResponse.json({ message: "Built-in lessons accept PPTX attachments only." }, { status: 400 });
    const revision = createHash("sha256").update(file.bytes).digest("hex");
    if (body.action === "preview") return NextResponse.json({ file: { id: file.id, name: validated.name, bytes: validated.bytes.byteLength, type: validated.contentType, revision } }, { headers: { "Cache-Control": "no-store" } });
    if (body.revision !== revision) return NextResponse.json({ message: "The Drive file changed. Choose it again before connecting." }, { status: 409 });
    const contentPath = `drive:${file.id}`;
    let update = db.from("course_sections").update({ content_type: validated.contentType, content_path: contentPath, original_content_path: null, source_filename: validated.name, slide_count: validated.slideCount, updated_at: new Date().toISOString() }).eq("id", id);
    update = section.content_path ? update.eq("content_path", section.content_path) : update.is("content_path", null);
    const saved = await update.select("id").maybeSingle();
    if (saved.error || !saved.data) return NextResponse.json({ message: "The section changed or could not be saved. Reload and try again." }, { status: 409 });
    revalidatePath("/learn");
    return NextResponse.json({ success: true, sourceFilename: validated.name });
  } catch {
    return NextResponse.json({ message: "Unable to read or connect this Drive file. Check the connected account, access and the 50 MB limit." }, { status: 502 });
  }
}
