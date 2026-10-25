import ts from "typescript";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { MAX_SECTION_BYTES } from "./sectionLimits";
export { MAX_SECTION_BYTES } from "./sectionLimits";

// Only derived code is cached. Authorization and original file reads remain live.
const compiledSections = new Map<string, { code: string; bytes: number }>();
const MAX_COMPILED_CACHE_BYTES = 24 * 1024 * 1024;
let compiledCacheBytes = 0;
export function compileTsx(source: string) {
  const key = createHash("sha256").update(source).digest("hex");
  const cached = compiledSections.get(key);
  if (cached) {
    compiledSections.delete(key);
    compiledSections.set(key, cached);
    return cached.code;
  }
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
  const bytes = Buffer.byteLength(result.outputText);
  if (bytes <= MAX_COMPILED_CACHE_BYTES) {
    while (compiledSections.size && (compiledCacheBytes + bytes > MAX_COMPILED_CACHE_BYTES || compiledSections.size >= 32)) {
      const oldest = compiledSections.keys().next().value!;
      compiledCacheBytes -= compiledSections.get(oldest)!.bytes;
      compiledSections.delete(oldest);
    }
    compiledSections.set(key, { code: result.outputText, bytes });
    compiledCacheBytes += bytes;
  }
  return result.outputText;
}

export async function validateSectionContent(bytes: Uint8Array, name: string) {
  if (!bytes.byteLength || bytes.byteLength > MAX_SECTION_BYTES) throw new Error("Choose a nonempty file up to 50 MB.");
  const type = name.split(".").pop()?.toLowerCase();
  if (!["pdf", "js", "pptx"].includes(type || "")) throw new Error("Only PDF, PPTX and lesson JS files are supported. Export legacy TSX as JS before uploading.");
  let slideCount: number | null = null;
  if (type === "js") validateInteractiveJs(new TextDecoder().decode(bytes));
  if (type === "pdf" && !Buffer.from(bytes.subarray(0,1024)).includes(Buffer.from("%PDF-"))) throw new Error("This is not a valid PDF file.");
  if (type === "pptx") {
    try {
      const zip = await JSZip.loadAsync(bytes);
      const slides = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
      if (!zip.file("[Content_Types].xml") || !zip.file("_rels/.rels") || !zip.file("ppt/presentation.xml") || !slides.length) throw Error();
      slideCount = slides.length;
    } catch { throw new Error("This file is not a valid .pptx presentation."); }
  }
  // "tsx" is the database/player category, not the uploaded file format.
  // JS stays byte-for-byte JS; validation parses syntax without transpiling it.
  return { contentType: (type === "js" ? "tsx" : type) as "pdf" | "tsx" | "pptx", slideCount, mimeType: type === "pdf" ? "application/pdf" : type === "js" ? "text/javascript" : "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
}

export function validateInteractiveJs(source: string) {
  if (!/\bexports\s*(?:\.\s*(?:default|slides)\b|\[\s*["'](?:default|slides)["']\s*\])/.test(source)) throw new Error("Use compiled lesson JS exporting exports.default or exports.slides. Rename-only TSX and ES module files are not supported.");
  const parsed = ts.createSourceFile("section.js", source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  // Parse without executing administrator-supplied JavaScript on the server.
  const diagnostics = (parsed as typeof parsed & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (diagnostics.length) throw new Error("Invalid JavaScript lesson. Export a compiled JS file from Learning Space.");
  function check(node: ts.Node) {
    // Inspect executable syntax, not lesson text, comments or embedded assets.
    // A slide explaining localStorage must remain a valid upload.
    const restrictedIdentifier = ts.isIdentifier(node) &&
      ["require", "fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage"].includes(node.text);
    const dynamicImport = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const property = ts.isPropertyAccessExpression(node) ? node.name.text
      : ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
    const receiver = ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ? node.expression : null;
    const restrictedProperty = property && (
      ["require", "fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage"].includes(property) ||
      (receiver && ts.isIdentifier(receiver) && (
        (receiver.text === "document" && property === "cookie") ||
        (receiver.text === "window" && ["parent", "top", "opener"].includes(property))
      ))
    );
    if (restrictedIdentifier || dynamicImport || restrictedProperty || ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      throw new Error("JS lessons must be self-contained and cannot import modules or access browser/session data.");
    }
    const hasExport = ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (
      ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) ||
      ts.isExportDeclaration(node) || ts.isExportAssignment(node) || hasExport ||
      ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node) ||
      ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ||
      ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ("type" in node && node.type)
    ) throw new Error("Use plain lesson JS without imports, JSX or TypeScript syntax.");
    ts.forEachChild(node, check);
  }
  check(parsed);
}

export async function prepareSectionFile(bytes: Uint8Array, name: string) {
  const validated = await validateSectionContent(bytes, name);
  return { ...validated, bytes, name };
}
