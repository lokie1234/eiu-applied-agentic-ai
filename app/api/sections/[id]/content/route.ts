import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";

import { readDriveFile } from "@/lib/drive/sectionContent";
import { compileTsx } from "@/lib/sectionContent";
import { readLocalSectionSource } from "@/lib/localSectionContent";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await currentUserAccess();
  if (!access?.isActive) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: section, error } = await supabase
      .from("course_sections")
      .select("id, course_id, content_type, content_path, source_filename")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!section || !["pdf", "tsx", "pptx"].includes(section.content_type)) {
      return NextResponse.json({ message: "This section does not have uploaded content." }, { status: 404 });
    }
    const course = access.courses.find((item) => item.id === String(section.course_id));
    const canAccess = Boolean(access.isAdmin || access.sections.some(item => item.id === id && item.courseId === String(section.course_id)));
    if (!course || !canAccess) return NextResponse.json({ message: "Course access required." }, { status: 403 });

    const attachmentRequested = new URL(request.url).searchParams.get("download") === "1";
    const localSource = await readLocalSectionSource(course, section);
    let data: Blob;
    if (localSource) {
      data = attachmentRequested
        ? new Blob([new Uint8Array(localSource)])
        : new Blob([compileTsx(localSource.toString("utf8"))]);
    } else if (!section.content_path) {
      return NextResponse.json({ message: "This section does not have uploaded content." }, { status: 404 });
    } else if (String(section.content_path).startsWith("drive:")) {
      const file = await readDriveFile(String(section.content_path));
      data = section.content_type === "tsx" && !attachmentRequested && !/\.js$/i.test(String(section.source_filename))
        ? new Blob([compileTsx(new TextDecoder().decode(file.bytes))])
        : new Blob([file.bytes as Uint8Array<ArrayBuffer>]);
    } else {
      const stored = await supabase.storage.from("course-section-content").download(String(section.content_path));
      if (stored.error || !stored.data) throw Error("Stored content unavailable.");
      data = stored.data;
    }
    const isPptx = section.content_type === "pptx";
    const attachment = isPptx || new URL(request.url).searchParams.get("download") === "1";
    const filename = String(section.source_filename || `section.${section.content_type}`);
    const fallbackFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new NextResponse(data, {
      headers: {
        "Content-Type": isPptx
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : section.content_type === "pdf" ? "application/pdf" : attachmentRequested && (localSource || String(section.content_path).startsWith("drive:")) ? "text/plain; charset=utf-8" : "text/javascript; charset=utf-8",
        "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "X-EIU-Content-Source": localSource ? "project-tsx" : "uploaded",
      },
    });
  } catch (error) {
    void error;
    return NextResponse.json({ message: "Unable to load section content." }, { status: 500 });
  }
}
