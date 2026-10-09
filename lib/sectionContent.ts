import ts from "typescript";
import JSZip from "jszip";
export function compileTsx(source: string) {
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

export const MAX_SECTION_BYTES = 50 * 1024 * 1024;
export async function validateSectionContent(bytes: Uint8Array, name: string) {
  if (!bytes.byteLength || bytes.byteLength > MAX_SECTION_BYTES) throw new Error("Choose a nonempty file up to 50 MB.");
  const type = name.split(".").pop()?.toLowerCase();
  if (!["pdf", "tsx", "pptx"].includes(type || "")) throw new Error("Only PDF, PPTX and TSX files are supported.");
  let slideCount: number | null = null;
  if (type === "tsx") compileTsx(new TextDecoder().decode(bytes));
  if (type === "pdf" && !Buffer.from(bytes.subarray(0,1024)).includes(Buffer.from("%PDF-"))) throw new Error("This is not a valid PDF file.");
  if (type === "pptx") {
    try {
      const zip = await JSZip.loadAsync(bytes);
      const slides = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
      if (!zip.file("[Content_Types].xml") || !zip.file("_rels/.rels") || !zip.file("ppt/presentation.xml") || !slides.length) throw Error();
      slideCount = slides.length;
    } catch { throw new Error("This file is not a valid .pptx presentation."); }
  }
  return { contentType: type as "pdf" | "tsx" | "pptx", slideCount, mimeType: type === "pdf" ? "application/pdf" : type === "tsx" ? "text/plain" : "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
}
