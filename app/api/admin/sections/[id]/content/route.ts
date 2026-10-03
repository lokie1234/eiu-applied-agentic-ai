import ts from "typescript";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "course-section-content";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

function compileTsx(source: string) {
  const forbidden = [
    /\bimport\s+(?!type\b)/,
    /\brequire\s*\(/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /document\s*\.\s*cookie/,
    /window\s*\.\s*(?:parent|top|opener)/,
  ];
  if (forbidden.some((pattern) => pattern.test(source))) {
    throw new Error("TSX must be self-contained and cannot import modules or access browser/session data.");
  }
  if (!/export\s+(?:default|const\s+slides\b)/.test(source)) {
    throw new Error("TSX must export default a slide/component array, or export const slides.");
  }
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      jsxFactory: "h",
      jsxFragmentFactory: "Fragment",
      esModuleInterop: true,
    },
    reportDiagnostics: true,
    fileName: "section.tsx",
  });
  const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    throw new Error(ts.flattenDiagnosticMessageText(errors[0].messageText, " "));
  }
  return result.outputText;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminAccess())) {
    return NextResponse.json({ success: false, message: "Administrator access required." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, message: "Choose a PDF or TSX file." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: "The maximum file size is 50 MB." }, { status: 413 });
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "tsx") {
      return NextResponse.json({ success: false, message: "Only .pdf and .tsx files are supported." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: section, error: readError } = await supabase
      .from("course_sections")
      .select("id, course_id, section_key, content_path")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!section) return NextResponse.json({ success: false, message: "Section not found." }, { status: 404 });
    if (["section1", "section2"].includes(String(section.section_key))) {
      const { data: parentCourse } = await supabase.from("courses").select("slug").eq("id", section.course_id).maybeSingle();
      if (parentCourse?.slug === "applied-agentic-ai") {
        return NextResponse.json({
          success: false,
          message: "The two built-in sections keep their interactive functions. Upload files to a new section instead.",
        }, { status: 400 });
      }
    }

    let body: Uint8Array;
    let contentType: "pdf" | "tsx";
    let mimeType: string;
    if (extension === "tsx") {
      const source = await file.text();
      const compiled = compileTsx(source);
      body = new TextEncoder().encode(compiled);
      contentType = "tsx";
      mimeType = "text/javascript";
    } else {
      body = new Uint8Array(await file.arrayBuffer());
      contentType = "pdf";
      mimeType = "application/pdf";
    }

    const storedName = `${Date.now()}-${safeFilename(file.name.replace(/\.tsx$/i, ".js"))}`;
    const path = `${section.course_id}/${section.id}/${storedName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const rawSlideCount = Number(formData.get("slideCount"));
    const slideCount = Number.isInteger(rawSlideCount) && rawSlideCount > 0 ? rawSlideCount : null;
    const { error: updateError } = await supabase.from("course_sections").update({
      content_type: contentType,
      content_path: path,
      source_filename: file.name,
      slide_count: slideCount,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw updateError;
    }
    if (section.content_path && section.content_path !== path) {
      await supabase.storage.from(BUCKET).remove([String(section.content_path)]);
    }
    return NextResponse.json({ success: true, contentType, sourceFilename: file.name, slideCount });
  } catch (error) {
    console.error("Section content upload error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unable to upload section content.",
    }, { status: 500 });
  }
}

