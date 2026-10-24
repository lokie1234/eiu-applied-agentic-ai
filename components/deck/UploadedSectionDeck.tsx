"use client";

import { memo, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import HairlineLoading from "@/components/HairlineLoading";
import styles from "./UploadedSectionDeck.module.css";
import { WEB_DEVELOPMENT_SECTION_ID } from "@/lib/webDevelopmentQuiz";
import { getCompiledSectionMetadata } from "@/lib/compiledSectionMetadata";
const ShowcaseSlide = dynamic(() => import("@/components/ShowcaseSlide"), { loading: () => <HairlineLoading contained /> });
const QuizSlide = dynamic(() => import("@/components/QuizSlide"), { loading: () => <HairlineLoading contained /> });
const PptxSectionDeck = dynamic(() => import("./PptxSectionDeck"), { ssr: false, loading: () => <HairlineLoading contained /> });
const UploadedPdfDeck = dynamic(() => import("./UploadedPdfDeck"), { ssr: false, loading: () => <HairlineLoading contained /> });

type Props = {
  sectionId: string;
  uploadedContent?: boolean;
  isAdmin?: boolean;
  templateKey?: string;
  contentType: "pdf" | "tsx" | "pptx";
  slideCount: number | null;
  courseTitle: string;
  sectionTitle: string;
};

import { createTsxDocument } from "@/lib/tsxDocument";

const sectionCodeCache = new Map<string, string>();

// Keep the large source document stable during presence updates and zooming.
const TsxSlide = memo(function TsxSlide({ code, page, background, templateKey, title, frameRef, sectionId, isAdmin }: {
  code: string; page: number; background: string; templateKey?: string; title: string;
  sectionId: string; isAdmin: boolean;
  frameRef: RefObject<HTMLIFrameElement | null>;
}) {
  const document = useMemo(() => createTsxDocument(code, page, background, templateKey, `${sectionId}:${page}`, isAdmin), [code, page, background, templateKey, sectionId, isAdmin]);
  return <iframe ref={frameRef} className={styles.tsxFrame}
    sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox"
    title={`${title} · slide ${page}`} srcDoc={document} />;
});

export default function UploadedSectionDeck({ sectionId, uploadedContent, contentType, slideCount, courseTitle, sectionTitle, templateKey, isAdmin = false }: Props) {
  const compiled = contentType === "tsx" && !uploadedContent ? getCompiledSectionMetadata(sectionId) : undefined;
  const compiledCount = compiled ? isAdmin ? compiled.teachingSlides : compiled.learnerSlides : undefined;
  const needsTemplate = Boolean(templateKey && !(templateKey === "eiu-business-v1" && compiled?.preservesBusinessTemplate));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentUrl = `/api/sections/${encodeURIComponent(sectionId)}/content`;
  const [totalSlides, setTotalSlides] = useState(compiledCount ?? slideCount ?? 1);
  const [tsxCode, setTsxCode] = useState(() => sectionCodeCache.get(contentUrl) ?? "");
  const [tsxReady, setTsxReady] = useState(false);
  const [slideCountReady, setSlideCountReady] = useState(compiledCount !== undefined);
  const [showcasePage, setShowcasePage] = useState<number | null>(null);
  const [quizPage, setQuizPage] = useState<number | null>(null);
  const [templateImage, setTemplateImage] = useState("");
  const useTemplate = Boolean(templateImage);
  const [templateLoading, setTemplateLoading] = useState(needsTemplate);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!needsTemplate) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    fetch("/api/templates", { cache: "no-store", signal }).then(async response => {
      if (!response.ok) throw new Error("Unable to load slide layout.");
      const { templates } = await response.json();
      const template = templates.find((item: { id: string; background: string }) => item.id === templateKey);
      if (!template) return ""; // Deleted layouts fall back to original slides.
      if (template.background.startsWith("data:")) return template.background;
      const imageResponse = await fetch(template.background, { signal });
      if (!imageResponse.ok) throw new Error("Unable to load layout background.");
      const blob = await imageResponse.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
      });
    }).then(data => { if (!controller.signal.aborted) { setTemplateImage(data); setTemplateLoading(false); } })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setTemplateLoading(false); } });
    return () => controller.abort();
  }, [templateKey, needsTemplate]);

  useEffect(() => {
    if (contentType !== "tsx") return;
    const controller = new AbortController();
    let disposed = false;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    fetch(contentUrl, { cache: "no-store", signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load TSX section content.");
        return response.text();
      })
      .then((code) => {
        if (!code.trim()) throw new Error("This section has no slide content yet.");
        sectionCodeCache.set(contentUrl, code);
        if (!disposed) setTsxCode(code);
      })
      .catch((reason) => { if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load content."); });
    return () => { disposed = true; controller.abort(); };
  }, [contentType, contentUrl]);

  useEffect(() => {
    if (contentType !== "tsx") return;
    function onMessage(event: MessageEvent) {
      const payload = event.data as { type?: string; slides?: number; page?: number; interaction?: string; requestId?: string };
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (payload?.type === "eiu-tsx-error" && typeof payload.requestId === "string" && payload.requestId.startsWith(`${sectionId}:`)) {
        setError("Unable to display this lesson. Please reload the section.");
      }
      if (payload?.type === "eiu-slide-interaction" && Number.isSafeInteger(payload.page) && payload.requestId === `${sectionId}:${payload.page}`) {
        setShowcasePage(payload.interaction === "showcase" ? Number(payload.page) : null);
        setQuizPage(payload.interaction === "quiz" && sectionId === WEB_DEVELOPMENT_SECTION_ID ? Number(payload.page) : null);
      }
      if (payload?.type === "eiu-tsx-ready" && Number.isSafeInteger(payload.slides) && Number(payload.slides) > 0) {
        setTsxReady(true);
        setTotalSlides(Number(payload.slides));
        setSlideCountReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contentType, sectionId]);

  useEffect(() => {
    if (contentType !== "tsx" || !tsxCode || templateLoading || (tsxReady && slideCountReady)) return;
    const timer = window.setTimeout(() => setError("This lesson took too long to display. Please reopen the section."), 15_000);
    return () => window.clearTimeout(timer);
  }, [contentType, tsxCode, templateLoading, tsxReady, slideCountReady]);

  if (templateLoading) return <HairlineLoading contained label="Loading slide layout" />;
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
      renderSlide={(pageNumber, renderWidth) => {
        if (error) return <div className={styles.message}>{error}</div>;
        if (!tsxCode || (useTemplate && !templateImage)) return <HairlineLoading contained />;
        return (
          <div className={styles.loadingFrame}>
          <TsxSlide isAdmin={isAdmin} frameRef={iframeRef} sectionId={sectionId} code={tsxCode} page={pageNumber} background={useTemplate ? templateImage : ""}
            templateKey={templateKey} title={sectionTitle} />
          {showcasePage === pageNumber && <ShowcaseSlide scale={renderWidth / 960} isAdmin={isAdmin} sectionId={sectionId} courseTitle={courseTitle} sectionTitle={sectionTitle} />}
          {quizPage === pageNumber && <QuizSlide key={sectionId} scale={renderWidth / 960} isAdmin={isAdmin} sectionId={sectionId} courseTitle={courseTitle} />}
          {!tsxReady && <div className={styles.loadingOverlay}><HairlineLoading contained /></div>}
          </div>
        );
      }}
    />
  );
}
