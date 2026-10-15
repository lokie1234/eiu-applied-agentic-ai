"use client";

import { memo, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import HairlineLoading from "@/components/HairlineLoading";
import styles from "./UploadedSectionDeck.module.css";
const PptxSectionDeck = dynamic(() => import("./PptxSectionDeck"), { ssr: false, loading: () => <HairlineLoading /> });
const UploadedPdfDeck = dynamic(() => import("./UploadedPdfDeck"), { ssr: false, loading: () => <HairlineLoading /> });

type Props = {
  sectionId: string;
  templateKey?: string;
  contentType: "pdf" | "tsx" | "pptx";
  slideCount: number | null;
  courseTitle: string;
  sectionTitle: string;
};

import { createTsxDocument } from "@/lib/tsxDocument";

// Keep the large source document stable during presence updates and zooming.
const TsxSlide = memo(function TsxSlide({ code, page, background, templateKey, title, frameRef, onLoad }: {
  code: string; page: number; background: string; templateKey?: string; title: string;
  frameRef: RefObject<HTMLIFrameElement | null>; onLoad: () => void;
}) {
  const document = useMemo(() => createTsxDocument(code, page, background, templateKey), [code, page, background, templateKey]);
  return <iframe ref={frameRef} className={styles.tsxFrame}
    sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox"
    title={`${title} · slide ${page}`} srcDoc={document} onLoad={onLoad} />;
});

export default function UploadedSectionDeck({ sectionId, contentType, slideCount, courseTitle, sectionTitle, templateKey }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [totalSlides, setTotalSlides] = useState(slideCount ?? 1);
  const [tsxCode, setTsxCode] = useState("");
  const [tsxReady, setTsxReady] = useState(false);
  const [slideCountReady, setSlideCountReady] = useState(false);
  const onTsxLoad = useCallback(() => setTsxReady(true), []);
  const [templateImage, setTemplateImage] = useState("");
  const useTemplate = Boolean(templateImage);
  const [templateLoading, setTemplateLoading] = useState(Boolean(templateKey));
  const [error, setError] = useState("");
  const contentUrl = `/api/sections/${encodeURIComponent(sectionId)}/content`;

  useEffect(() => {
    if (!templateKey) return;
    const controller = new AbortController();
    fetch("/api/templates", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unable to load slide layout.");
      const { templates } = await response.json();
      const template = templates.find((item: { id: string; background: string }) => item.id === templateKey);
      if (!template) return ""; // Deleted layouts fall back to original slides.
      if (template.background.startsWith("data:")) return template.background;
      const imageResponse = await fetch(template.background, { signal: controller.signal });
      if (!imageResponse.ok) throw new Error("Unable to load layout background.");
      const blob = await imageResponse.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
      });
    }).then(data => { if (!controller.signal.aborted) { setTemplateImage(data); setTemplateLoading(false); } })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setTemplateLoading(false); } });
    return () => controller.abort();
  }, [templateKey]);

  useEffect(() => {
    if (contentType !== "tsx") return;
    const controller = new AbortController();
    let disposed = false;
    fetch(contentUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load TSX section content.");
        return response.text();
      })
      .then((code) => {
        if (!code.trim()) throw new Error("This section has no slide content yet.");
        if (!disposed) setTsxCode(code);
      })
      .catch((reason) => { if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load content."); });
    return () => { disposed = true; controller.abort(); };
  }, [contentType, contentUrl]);

  useEffect(() => {
    if (contentType !== "tsx") return;
    function onMessage(event: MessageEvent) {
      const payload = event.data as { type?: string; slides?: number };
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (payload?.type === "eiu-tsx-ready" && Number.isSafeInteger(payload.slides) && Number(payload.slides) > 0) {
        setTotalSlides(Number(payload.slides));
        setSlideCountReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contentType]);

  if (templateLoading) return <HairlineLoading label="Loading slide layout" />;
  if (error) return <div className={styles.message} role="alert">{error}</div>;
  if (contentType === "pptx") {
    return <PptxSectionDeck templateImage={templateImage} useTemplate={useTemplate} sectionId={sectionId} courseTitle={courseTitle} sectionTitle={sectionTitle} />;
  }
  if (contentType === "pdf") {
    return <UploadedPdfDeck contentUrl={contentUrl} slideCount={slideCount} courseTitle={courseTitle} sectionTitle={sectionTitle} templateImage={templateImage} />;
  }

  return (
    <SharedDeckFrame
      courseTitle={courseTitle}
      sectionTitle={sectionTitle}
      totalSlides={totalSlides}
      navigationReady={slideCountReady}
      frameClassName={styles.frame}
      transitionClassName={styles.slide}
      renderSlide={(pageNumber) => {
        if (error) return <div className={styles.message}>{error}</div>;
        if (!tsxCode || (useTemplate && !templateImage)) return <HairlineLoading />;
        return (
          <div className={styles.loadingFrame}>
          <TsxSlide frameRef={iframeRef} code={tsxCode} page={pageNumber} background={useTemplate ? templateImage : ""}
            templateKey={templateKey} title={sectionTitle} onLoad={onTsxLoad} />
          {!tsxReady && <div className={styles.loadingOverlay}><HairlineLoading /></div>}
          </div>
        );
      }}
    />
  );
}
