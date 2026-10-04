"use client";

import { useEffect, useRef, useState } from "react";
import type { PptxViewer, SlideHandle } from "@aiden0z/pptx-renderer";
import SharedDeckFrame from "./SharedDeckFrame";
import styles from "./UploadedSectionDeck.module.css";
import { fitPptxTables } from "@/lib/pptxTableLayout";

function PreviewSlide({ viewer, page, width }: { viewer: PptxViewer; page: number; width: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const scale = width / viewer.slideWidth;
  useEffect(() => {
    if (!container.current) return;
    const target = container.current;
    // The renderer appends DOM; dispose releases resources but leaves that DOM in place.
    target.replaceChildren();
    let disposed = false;
    let handle: SlideHandle | null = null;
    try {
      handle = viewer.renderSlideToContainer(page - 1, target, scale);
      if (!handle) throw new Error("This slide could not be rendered.");
      // Keep intrinsic slide geometry out of normal flow. CSS transforms change
      // visual size only; the unscaled box must not affect centering or clipping.
      handle.element.style.position = "absolute";
      handle.element.style.left = "0";
      handle.element.style.top = "0";
      const slide = handle.element;
      void handle.ready.then(async () => {
        await document.fonts.ready;
        if (!disposed) fitPptxTables(slide);
      }).catch(() => { if (!disposed) setError("This slide could not be rendered."); });
    } catch {
      queueMicrotask(() => { if (!disposed) setError("This slide could not be rendered."); });
    }
    return () => {
      disposed = true;
      handle?.dispose();
      handle?.element.remove();
    };
  }, [viewer, page, scale]);
  return (
    <div className={styles.pptxSlide} onClickCapture={(event) => {
      // This is a static preview, not an execution surface for uploaded links.
      if ((event.target as Element).closest("a")) event.preventDefault();
    }}>
      {error ? <div className={styles.message}>{error}</div> :
        <div ref={container} style={{ position: "relative", flexShrink: 0, width: viewer.slideWidth * scale, height: viewer.slideHeight * scale }} />}
    </div>
  );
}

export default function PptxSectionDeck({ sectionId, courseTitle, sectionTitle }: {
  sectionId: string; courseTitle: string; sectionTitle: string;
}) {
  const [viewer, setViewer] = useState<PptxViewer | null>(null);
  const [error, setError] = useState("");
  const url = `/api/sections/${encodeURIComponent(sectionId)}/content`;
  useEffect(() => {
    const controller = new AbortController();
    let instance: PptxViewer | null = null;
    let disposed = false;
    async function load() {
      try {
        const [library, response] = await Promise.all([
          import("@aiden0z/pptx-renderer"),
          fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) }),
        ]);
        if (!response.ok) throw new Error("Unable to load this presentation. Check your course access and try again.");
        const bytes = await response.arrayBuffer();
        const files = await library.parseZipLazyMedia(bytes, library.RECOMMENDED_ZIP_LIMITS);
        if (disposed) return;
        const presentation = library.buildPresentation(files, { lazySlides: true });
        if (!presentation.slides.length) throw new Error("This presentation has no slides to preview.");
        instance = new library.PptxViewer(document.createElement("div"), { pdfjs: false, lazyMedia: true, lazySlides: true });
        instance.load(presentation);
        if (!disposed) setViewer(instance);
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to preview this presentation.");
      }
    }
    void load();
    return () => { disposed = true; controller.abort(); instance?.destroy(); };
  }, [url]);
  return (
    <div className={styles.pptxPreviewShell}>
      <SharedDeckFrame courseTitle={courseTitle} sectionTitle={sectionTitle} totalSlides={viewer?.slideCount || 1}
        aspectRatio={viewer ? viewer.slideWidth / viewer.slideHeight : 16 / 9}
        frameClassName={styles.frame} transitionClassName={styles.slide}
        renderSlide={(page, width) => viewer
          ? <PreviewSlide viewer={viewer} page={page} width={width} />
          : <div className={styles.message} role={error ? "alert" : "status"}>{error || "Loading presentation preview…"}</div>} />
    </div>
  );
}
