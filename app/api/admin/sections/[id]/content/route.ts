import ts from "typescript";
import JSZip from "jszip";
import { after, NextResponse } from "next/server";
import { canManageSection } from "@/lib/auth/currentUser";
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
  const { id } = await context.params;
  if (!(await canManageSection(id))) {
    return NextResponse.json({ success: false, message: "You do not have permission to upload content to this section." }, { status: 403 });
  }
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({
        success: false,
        message: "Upload data is incomplete or invalid. Please select the file again and retry (maximum 50 MB).",
      }, { status: 400 });
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, message: "Choose a PDF, TSX, or PPTX file." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: "The maximum file size is 50 MB." }, { status: 413 });
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "tsx" && extension !== "pptx") {
      return NextResponse.json({ success: false, message: "Only .pdf, .tsx, and .pptx files are supported." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: section, error: readError } = await supabase
      .from("course_sections")
      .select("id, course_id, section_key, content_path, original_content_path")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!section) return NextResponse.json({ success: false, message: "Section not found." }, { status: 404 });
    if (["section1", "section2"].includes(String(section.section_key))) {
      const { data: parentCourse } = await supabase.from("courses").select("slug").eq("id", section.course_id).maybeSingle();
      if (parentCourse?.slug === "applied-agentic-ai" && extension !== "pptx") {
        return NextResponse.json({
          success: false,
          message: "Built-in sections accept original PPTX attachments only. Their interactive lessons stay unchanged; upload PDF or TSX to a new section instead.",
        }, { status: 400 });
      }
    }

    let body: Uint8Array;
    let contentType: "pdf" | "tsx" | "pptx";
    let mimeType: string;
    let pptxSlideCount: number | null = null;
    if (extension === "tsx") {
      const source = await file.text();
      const compiled = compileTsx(source);
      body = new TextEncoder().encode(compiled);
      contentType = "tsx";
      mimeType = "text/javascript";
    } else {
      body = new Uint8Array(await file.arrayBuffer());
      if (extension === "pptx") {
        // Read the package directory only. Never regenerate the archive: doing so
        // can strip media, animation, embedded objects, and add-in relationships.
        try {
          const archive = await JSZip.loadAsync(body);
          const slides = archive.file(/^ppt\/slides\/slide\d+\.xml$/);
          if (!archive.file("[Content_Types].xml") || !archive.file("_rels/.rels") ||
              !archive.file("ppt/presentation.xml") || slides.length === 0) {
            throw new Error("Invalid PowerPoint package.");
          }
          pptxSlideCount = slides.length;
        } catch {
          return NextResponse.json({ success: false, message: "This file is not a valid .pptx presentation." }, { status: 400 });
        }
        contentType = "pptx";
        mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      } else {
        contentType = "pdf";
        mimeType = "application/pdf";
      }
    }

    const storedName = `${Date.now()}-${safeFilename(file.name.replace(/\.tsx$/i, ".js"))}`;
    const path = `${section.course_id}/${section.id}/${storedName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    let originalPath: string | null = null;
    if (extension === "tsx") {
      originalPath = section.course_id + "/" + section.id + "/" + Date.now() + "-original-" + safeFilename(file.name);
      const original = await supabase.storage.from(BUCKET).upload(originalPath, new Uint8Array(await file.arrayBuffer()), { contentType: "text/plain", upsert: false });
      if (original.error) { await supabase.storage.from(BUCKET).remove([path]); throw original.error; }
    }
    const rawSlideCount = Number(formData.get("slideCount"));
    const slideCount = pptxSlideCount ?? (Number.isInteger(rawSlideCount) && rawSlideCount > 0 ? rawSlideCount : null);
    const { error: updateError } = await supabase.from("course_sections").update({
      content_type: contentType,
      content_path: path,
      original_content_path: originalPath,
      source_filename: file.name,
      slide_count: slideCount,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) {
      await supabase.storage.from(BUCKET).remove(originalPath ? [path, originalPath] : [path]);
      throw updateError;
    }
    if (section.content_path && section.content_path !== path) {
      const previousPath = String(section.content_path);
      after(async () => {
        try {
          const { error } = await supabase.storage.from(BUCKET).remove([previousPath]);
          if (error) console.error("Previous section content cleanup error:", error);
        } catch (error) {
          console.error("Previous section content cleanup error:", error);
        }
      });
    }
    if (section.original_content_path && section.original_content_path !== originalPath) {
      const previousOriginal = String(section.original_content_path);
      after(async () => { await supabase.storage.from(BUCKET).remove([previousOriginal]); });
    }
    return NextResponse.json({ success: true, contentType, contentPath: path, sourceFilename: file.name, slideCount });
  } catch (error) {
    console.error("Section content upload error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unable to upload section content.",
    }, { status: 500 });
  }
}

