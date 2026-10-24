import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";

import { readDriveFile } from "@/lib/drive/sectionContent";
import { readLocalSectionSource } from "@/lib/localSectionContent";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await currentUserAccess(request.signal);
  if (!access?.isActive) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin(request.signal);
    type ContentSection = { id: string; course_id: string; content_type: string; content_path: string | null; source_filename: string | null };
    const granted = access.sections?.find(item => item.id === id);
    const grantedCourse = access.courses.find(item => item.id === granted?.courseId);
    if (!access.isAdmin && (granted?.hidden || grantedCourse?.hidden)) return NextResponse.json({ message: "Course access required." }, { status: 403 });
    let section: ContentSection | null = null;
    let localSource: Awaited<ReturnType<typeof readLocalSectionSource>> = null;
    // The fresh access catalog already resolved active, authorized local lessons.
    // Avoid querying the same section again before reading its repository bytes.
    if (granted?.contentType === "tsx" && grantedCourse && (access.isAdmin || (!granted.hidden && !grantedCourse.hidden))) {
      localSource = await readLocalSectionSource(grantedCourse, { id, content_type: "tsx" });
      if (localSource) section = { id, course_id: granted.courseId, content_type: "tsx", content_path: null, source_filename: granted.sourceFilename || null };
    }
    if (!section) {
      const { data, error } = await supabase
      .from("course_sections")
      .select("id, course_id, content_type, content_path, source_filename")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
      if (error) throw error;
      section = data;
    }
    if (!section || !["pdf", "tsx", "pptx"].includes(section.content_type)) {
      return NextResponse.json({ message: "This section does not have uploaded content." }, { status: 404 });
    }
    const course = access.courses.find((item) => item.id === String(section.course_id));
    const canAccess = Boolean(access.isAdmin || access.sections.some(item => item.id === id && item.courseId === String(section.course_id)));
    if (!course || !canAccess || (!access.isAdmin && (course.hidden || granted?.hidden))) return NextResponse.json({ message: "Course access required." }, { status: 403 });

    localSource ??= await readLocalSectionSource(course, section);
    // JS lesson bytes are served directly; only legacy TSX needs compilation.
    const legacyJs = async (source: string) => (await import("@/lib/sectionContent")).compileTsx(source);
    let data: Blob;
    if (localSource) {
      data = new Blob([new Uint8Array(localSource)]);
    } else if (!section.content_path) {
      return NextResponse.json({ message: "This section does not have uploaded content." }, { status: 404 });
    } else if (String(section.content_path).startsWith("drive:")) {
      const file = await readDriveFile(String(section.content_path));
      data = section.content_type === "tsx" && !/\.js$/i.test(String(section.source_filename))
        ? new Blob([await legacyJs(new TextDecoder().decode(file.bytes))])
        : new Blob([file.bytes as Uint8Array<ArrayBuffer>]);
    } else {
      const stored = await supabase.storage.from("course-section-content").download(String(section.content_path));
      if (stored.error || !stored.data) throw Error("Stored content unavailable.");
      data = stored.data;
    }
    const isPptx = section.content_type === "pptx";
    const attachment = isPptx || new URL(request.url).searchParams.get("download") === "1";
    const filename = section.content_type === "tsx" ? String(section.source_filename || "section.js").replace(/\.tsx$/i, ".js") : String(section.source_filename || `section.${section.content_type}`);
    const fallbackFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new NextResponse(data, {
      headers: {
        "Content-Type": isPptx
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : section.content_type === "pdf" ? "application/pdf" : "text/javascript; charset=utf-8",
        "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "X-EIU-Content-Source": localSource ? "project-js" : "uploaded",
      },
    });
  } catch (error) {
    void error;
    return NextResponse.json({ message: "Unable to load section content." }, { status: 500 });
  }
}
