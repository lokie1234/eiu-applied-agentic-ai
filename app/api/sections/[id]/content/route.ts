import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    if (!section?.content_path || !["pdf", "tsx"].includes(section.content_type)) {
      return NextResponse.json({ message: "This section does not have uploaded content." }, { status: 404 });
    }
    const course = access.courses.find((item) => item.id === String(section.course_id));
    const canAccess = Boolean(access.isAdmin || course?.isUnlocked);
    if (!course || !canAccess) return NextResponse.json({ message: "Course access required." }, { status: 403 });

    const { data, error: downloadError } = await supabase.storage
      .from("course-section-content")
      .download(String(section.content_path));
    if (downloadError) throw downloadError;
    return new NextResponse(data, {
      headers: {
        "Content-Type": section.content_type === "pdf" ? "application/pdf" : "text/javascript; charset=utf-8",
        "Content-Disposition": `inline; filename="${String(section.source_filename || `section.${section.content_type}`)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Section content download error:", error);
    return NextResponse.json({ message: "Unable to load section content." }, { status: 500 });
  }
}
