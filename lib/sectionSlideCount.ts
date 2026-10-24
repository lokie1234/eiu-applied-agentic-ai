import { createTsxDocument } from "./tsxDocument";
import { getCompiledSectionMetadata } from "./compiledSectionMetadata";
export { getCompiledSectionMetadata } from "./compiledSectionMetadata";

export type SectionFileType = "tsx" | "pdf" | "pptx";

export function countTsxSlides(code: string, signal: AbortSignal, isAdmin = false): Promise<number> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const frame = document.createElement("iframe");
    const requestId = crypto.randomUUID();
    frame.hidden = true;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.title = "Count section slides";
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
      signal.removeEventListener("abort", abort);
      frame.remove();
    };
    const abort = () => { cleanup(); reject(signal.reason); };
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.requestId !== requestId) return;
      if (event.data.type === "eiu-tsx-error") { cleanup(); reject(new Error("Unable to count section slides.")); }
      if (event.data.type !== "eiu-tsx-ready") return;
      const count = event.data.slides;
      if (!Number.isSafeInteger(count) || count < 0 || count > 10_000) return;
      cleanup(); resolve(count);
    };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("Slide counting timed out.")); }, 10_000);
    window.addEventListener("message", receive);
    signal.addEventListener("abort", abort, { once: true });
    frame.srcdoc = createTsxDocument(code, null, "", "", requestId, isAdmin);
    document.body.append(frame);
  });
}

export async function readSectionSlideCount(sectionId: string, type: SectionFileType, signal: AbortSignal, isAdmin = false) {
  signal.throwIfAborted();
  const compiled = type === "tsx" ? getCompiledSectionMetadata(sectionId) : undefined;
  // Generated with the JS, including the same adminOnly filtering as the frame.
  // Reading two counters must not download and evaluate two entire lessons.
  if (compiled) return isAdmin ? compiled.teachingSlides : compiled.learnerSlides;
  const response = await fetch(`/api/sections/${encodeURIComponent(sectionId)}/content`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Unable to read section content.");
  if (type === "tsx") return countTsxSlides(await response.text(), signal, isAdmin);
  const bytes = new Uint8Array(await response.arrayBuffer());
  signal.throwIfAborted();
  if (type === "pptx") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    signal.throwIfAborted();
    const presentation = zip.file("ppt/presentation.xml");
    if (!presentation) throw new Error("Invalid presentation.");
    const xml = new DOMParser().parseFromString(await presentation.async("string"), "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("Invalid presentation.");
    return Array.from(xml.getElementsByTagName("*")).filter(node =>
      node.localName === "sldId" && node.parentElement?.localName === "sldIdLst",
    ).length;
  }
  const pdfjs = await import("pdfjs-dist");
  signal.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: bytes });
  const abort = () => { void task.destroy(); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const document = await task.promise;
    signal.throwIfAborted();
    return document.numPages;
  } finally { signal.removeEventListener("abort", abort); await task.destroy(); }
}
