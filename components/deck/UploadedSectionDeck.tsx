"use client";

import { memo, type ComponentProps, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import HairlineLoading from "@/components/HairlineLoading";
import styles from "./UploadedSectionDeck.module.css";
import { MIS301_SECTION_ID } from "@/lib/mis301Practice";
import { WEB_DEVELOPMENT_SECTION_ID } from "@/lib/webDevelopmentQuiz";
import { getCompiledSectionMetadata } from "@/lib/compiledSectionMetadata";
import { useLessonPracticeBridge } from "./useLessonPracticeBridge";
import { useMis301NotebookBridge } from "./useMis301NotebookBridge";
const ShowcaseSlide = dynamic(async () => {
  const { default: Showcase } = await import("@/components/ShowcaseSlide");
  return function LoadedShowcase(props: ComponentProps<typeof Showcase>) { return <div className={styles.nativeContent} data-slide-content-ready="true"><Showcase {...props} /></div>; };
}, { loading: () => <HairlineLoading contained /> });
const QuizSlide = dynamic(async () => {
  const { default: Quiz } = await import("@/components/QuizSlide");
  return function LoadedQuiz(props: ComponentProps<typeof Quiz>) { return <div className={styles.nativeContent} data-slide-content-ready="true"><Quiz {...props} /></div>; };
}, { loading: () => <HairlineLoading contained /> });
const PptxSectionDeck = dynamic(() => import("./PptxSectionDeck"), { ssr: false, loading: () => <HairlineLoading contained /> });
const UploadedPdfDeck = dynamic(() => import("./UploadedPdfDeck"), { ssr: false, loading: () => <HairlineLoading contained /> });

function QuizPrefetch() {
  useEffect(() => { void import("@/components/QuizSlide").catch(() => {}); }, []);
  return null;
}

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

function SlideSurface({ ready, native, onError, children }: { ready: boolean; native: boolean; onError: (message: string) => void; children: ReactNode }) {
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => onError("This lesson took too long to display. Please reopen the section."), 15_000);
    return () => window.clearTimeout(timer);
  }, [ready, onError]);
  return <div className={styles.loadingFrame}>
    <div className={styles.slideContent} data-slide-ready={ready} data-native-slide={native} data-slide-content-ready={ready && !native}>{children}</div>
    {!ready && <div className={styles.loadingOverlay}><HairlineLoading contained /></div>}
  </div>;
}

// Keep the large source document stable during presence updates and zooming.
const TsxSlide = memo(function TsxSlide({ code, page, background, templateKey, title, frameRef, sectionId, isAdmin, practiceAllowed, practiceAssignmentKey }: {
  code: string; page: number; background: string; templateKey?: string; title: string;
  sectionId: string; isAdmin: boolean; practiceAllowed: boolean; practiceAssignmentKey: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
}) {
  const document = useMemo(() => createTsxDocument(code, page, background, templateKey, `${sectionId}:${page}`, isAdmin, practiceAllowed, practiceAssignmentKey), [code, page, background, templateKey, sectionId, isAdmin, practiceAllowed, practiceAssignmentKey]);
  return <iframe ref={frameRef} className={styles.tsxFrame} data-request-id={`${sectionId}:${page}`}
    sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox"
    title={`${title} · slide ${page}`} srcDoc={document} />;
});

export default function UploadedSectionDeck({ sectionId, uploadedContent, contentType, slideCount, courseTitle, sectionTitle, templateKey, isAdmin = false }: Props) {
  const compiled = contentType === "tsx" && !uploadedContent ? getCompiledSectionMetadata(sectionId) : undefined;
  const compiledCount = compiled ? isAdmin ? compiled.teachingSlides : compiled.learnerSlides : undefined;
  const needsTemplate = Boolean(templateKey && !(templateKey === "eiu-business-v1" && compiled?.preservesBusinessTemplate));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const practiceAccess = useLessonPracticeBridge(sectionId, iframeRef);
  const practiceAllowed = sectionId !== MIS301_SECTION_ID || isAdmin || Boolean(practiceAccess?.assignment);
  const practiceAssignmentKey = `${practiceAccess?.practiceSession || ""}:${practiceAccess?.assignment?.drawId || ""}:${practiceAccess?.assignment?.subject || ""}:${practiceAccess?.assignment?.part || ""}`;
  useMis301NotebookBridge(sectionId, iframeRef);
  const contentUrl = `/api/sections/${encodeURIComponent(sectionId)}/content`;
  const [totalSlides, setTotalSlides] = useState(compiledCount ?? slideCount ?? 1);
  const [tsxCode, setTsxCode] = useState("");
  const [resolvedRequest, setResolvedRequest] = useState("");
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
    fetch(`/api/templates?id=${encodeURIComponent(templateKey!)}`, { cache: "no-store", signal }).then(async response => {
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
        if (!response.ok) throw new Error("Unable to load interactive JS section content.");
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
      const payload = event.data as { type?: string; slides?: number; page?: number; interaction?: string; requestId?: string };
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (payload?.type === "eiu-tsx-error" && typeof payload.requestId === "string" && payload.requestId.startsWith(`${sectionId}:`)) {
        setError("Unable to display this lesson. Please reload the section.");
      }
      if (payload?.type === "eiu-slide-interaction" && Number.isSafeInteger(payload.page) && payload.requestId === `${sectionId}:${payload.page}`) {
        setResolvedRequest(payload.requestId);
        setShowcasePage(payload.interaction === "showcase" ? Number(payload.page) : null);
        setQuizPage(payload.interaction === "quiz" && sectionId === WEB_DEVELOPMENT_SECTION_ID ? Number(payload.page) : null);
      }
      if (payload?.type === "eiu-tsx-ready" && Number.isSafeInteger(payload.slides) && Number(payload.slides) > 0) {
        setTotalSlides(Number(payload.slides));
        setSlideCountReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contentType, sectionId]);

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
      totalSlides={sectionId === MIS301_SECTION_ID && !isAdmin ? practiceAllowed ? 6 : 5 : totalSlides}
      requestedPage={sectionId === MIS301_SECTION_ID && !isAdmin && practiceAccess?.assignment ? { page: 6, key: practiceAccess.assignment.drawId } : undefined}
      navigationReady={slideCountReady}
      frameClassName={styles.frame}
      transitionClassName={styles.slide}
      slideTransitions={sectionId === WEB_DEVELOPMENT_SECTION_ID && Boolean(compiled)}
      renderSlide={(pageNumber, renderWidth) => {
        if (error) return <div className={styles.message}>{error}</div>;
        const native = compiled?.nativeSlides?.[isAdmin ? "teaching" : "learner"]?.[String(pageNumber)];
        const showcase = native === "showcase" || (!native && showcasePage === pageNumber);
        const quiz = native === "quiz" || (!native && quizPage === pageNumber);
        const ready = Boolean(native || resolvedRequest === `${sectionId}:${pageNumber}`);
        if ((!tsxCode && !native) || (useTemplate && !templateImage)) return <HairlineLoading contained />;
        return (
          <SlideSurface key={`${sectionId}:${pageNumber}`} ready={ready} native={showcase || quiz} onError={setError}>
          {!native && <div className={showcase || quiz ? styles.inactiveSource : styles.sourceLayer} aria-hidden={showcase || quiz || undefined}>
          <TsxSlide isAdmin={isAdmin} frameRef={iframeRef} sectionId={sectionId} code={tsxCode} page={pageNumber} background={useTemplate ? templateImage : ""}
            practiceAllowed={practiceAllowed} practiceAssignmentKey={practiceAssignmentKey} templateKey={templateKey} title={sectionTitle} />
          </div>}
          {showcase && <ShowcaseSlide scale={renderWidth / 960} isAdmin={isAdmin} sectionId={sectionId} courseTitle={courseTitle} sectionTitle={sectionTitle} guide={compiled?.showcaseGuide} />}
          {showcase && sectionId === WEB_DEVELOPMENT_SECTION_ID && <QuizPrefetch />}
          {quiz && <QuizSlide key={sectionId} scale={renderWidth / 960} isAdmin={isAdmin} sectionId={sectionId} courseTitle={courseTitle} />}
          </SlideSurface>
        );
      }}
    />
  );
}
