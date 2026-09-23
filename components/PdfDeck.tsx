"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckSideAmbient from "@/components/DeckSideAmbient";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";
import WorkshopLaunchButton from "@/components/WorkshopLaunchButton";
import SectionOneHtmlSlide, { type SectionOneHtmlKind } from "@/components/section1/SectionOneHtmlSlide";
import SectionOneNativeSlide from "@/components/section1/SectionOneNativeSlide";
import SectionOneSlide14 from "@/components/section1/SectionOneSlide14";

const SECTION_ONE_PAGE_COUNT = 38;
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const SLIDE_ASPECT_RATIO = SLIDE_WIDTH / SLIDE_HEIGHT;

type Props = { isAdmin: boolean };

type DeckItem =
  | { kind: "native"; pdfPage: number }
  | { kind: "slide14"; slide: "gemini-model" }
  | { kind: "html"; slide: SectionOneHtmlKind }
  | { kind: "showcase" }
  | { kind: "quiz" };

function buildDeckItems(isAdmin: boolean): DeckItem[] {
  const items: DeckItem[] = [];

  for (let pdfPage = 1; pdfPage <= SECTION_ONE_PAGE_COUNT; pdfPage += 1) {
    if (pdfPage === 10) {
      continue;
    }

    if (pdfPage === 3) {
      items.push({ kind: "html", slide: "slide3" });
    } else if (pdfPage === 4) {
      items.push({ kind: "html", slide: "slide4" });
    } else if (pdfPage === 14) {
      items.push({ kind: "slide14", slide: "gemini-model" });
    } else if (pdfPage === 38) {
      items.push({ kind: "showcase" });
      items.push({ kind: "html", slide: "realtime-dashboard" });
    } else {
      items.push({ kind: "native", pdfPage });
    }

    if (pdfPage === 4 && isAdmin) {
      items.push({ kind: "html", slide: "idea-results" });
    }

    if (pdfPage === 34) {
      items.push({ kind: "html", slide: "deployment" });
    }

    if (pdfPage === 37) {
      items.push({ kind: "html", slide: "apply-idea" });
    }
  }

  items.push({ kind: "quiz" });
  return items;
}

export default function PdfDeck({ isAdmin }: Props) {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(0);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageNumberRef = useRef(1);
  const numPagesRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const wheelDirectionRef = useRef(0);
  const lastWheelNavigationRef = useRef(0);
  const wheelResetTimerRef = useRef<number | null>(null);

  const renderWidth = useMemo(() => {
    if (viewerWidth <= 0) return 0;
    return Math.round(viewerWidth * zoom);
  }, [viewerWidth, zoom]);

  const deckItems = useMemo(() => buildDeckItems(isAdmin), [isAdmin]);
  const numPages = deckItems.length;
  const currentItem = deckItems[pageNumber - 1];

  useEffect(() => {
    numPagesRef.current = numPages;
  }, [numPages]);

  const goToPage = useCallback((page: number) => {
    const total = numPagesRef.current;
    if (total <= 0) return;
    const safePage = Math.min(Math.max(Math.round(page), 1), total);
    pageNumberRef.current = safePage;
    setPageNumber(safePage);
    setPageInput(String(safePage));
  }, []);

  const nextPage = useCallback(() => {
    if (pageNumberRef.current < numPagesRef.current) {
      goToPage(pageNumberRef.current + 1);
    }
  }, [goToPage]);

  const previousPage = useCallback(() => {
    if (pageNumberRef.current > 1) {
      goToPage(pageNumberRef.current - 1);
    }
  }, [goToPage]);

  function commitPageInput() {
    const value = Number(pageInput);
    if (!Number.isFinite(value)) {
      setPageInput(String(pageNumberRef.current));
      return;
    }
    goToPage(value);
  }

  function zoomIn() {
    setZoom((current) => Math.min(Number((current + 0.1).toFixed(1)), 2));
  }

  function zoomOut() {
    setZoom((current) => Math.max(Number((current - 0.1).toFixed(1)), 0.5));
  }

  function resetZoom() {
    setZoom(1);
  }

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, [data-interactive='true']")) return;

      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          nextPage();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          previousPage();
          break;
        case "Home":
          event.preventDefault();
          goToPage(1);
          break;
        case "End":
          event.preventDefault();
          goToPage(numPagesRef.current);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [goToPage, nextPage, previousPage]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const WHEEL_THRESHOLD = 32;
    const WHEEL_COOLDOWN = 360;
    const WHEEL_IDLE_RESET = 140;

    function handleWheel(event: WheelEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [data-interactive='true']")) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (Math.abs(event.deltaY) < 0.5) return;

      event.preventDefault();
      const direction = event.deltaY < 0 ? -1 : 1;

      if (wheelDirectionRef.current !== 0 && wheelDirectionRef.current !== direction) {
        wheelAccumulatorRef.current = 0;
      }

      wheelDirectionRef.current = direction;
      wheelAccumulatorRef.current += event.deltaY;

      if (wheelResetTimerRef.current !== null) window.clearTimeout(wheelResetTimerRef.current);
      wheelResetTimerRef.current = window.setTimeout(() => {
        wheelAccumulatorRef.current = 0;
        wheelDirectionRef.current = 0;
        wheelResetTimerRef.current = null;
      }, WHEEL_IDLE_RESET);

      if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) return;
      const now = performance.now();
      if (now - lastWheelNavigationRef.current < WHEEL_COOLDOWN) return;

      const current = pageNumberRef.current;
      let targetPage = current;
      if (wheelAccumulatorRef.current < 0 && current < numPagesRef.current) targetPage = current + 1;
      else if (wheelAccumulatorRef.current > 0 && current > 1) targetPage = current - 1;

      wheelAccumulatorRef.current = 0;
      wheelDirectionRef.current = 0;
      if (targetPage === current) return;

      lastWheelNavigationRef.current = now;
      goToPage(targetPage);
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
      if (wheelResetTimerRef.current !== null) window.clearTimeout(wheelResetTimerRef.current);
    };
  }, [goToPage]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frameId: number | null = null;

    function updateSize() {
      if (!stageRef.current) return;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const currentStage = stageRef.current;
        if (!currentStage) return;
        const availableWidth = Math.max(currentStage.clientWidth - 18, 280);
        const availableHeight = Math.max(currentStage.clientHeight - 18, 180);
        const widthFromHeight = availableHeight * SLIDE_ASPECT_RATIO;
        setViewerWidth(Math.max(280, Math.min(availableWidth, widthFromHeight, 1920)));
      });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }

  function renderCurrentSlide() {
    if (!currentItem) return <div className="page-loading-shell"><div className="loading-spinner" /></div>;
    const scale = renderWidth / SLIDE_WIDTH;

    if (currentItem.kind === "slide14") return <SectionOneSlide14 scale={scale} />;
    if (currentItem.kind === "showcase") return <ShowcaseSlide scale={scale} isAdmin={isAdmin} />;
    if (currentItem.kind === "quiz") return <QuizSlide scale={scale} isAdmin={isAdmin} />;
    if (currentItem.kind === "html") {
      return <SectionOneHtmlSlide kind={currentItem.slide} scale={scale} isAdmin={isAdmin} />;
    }

    return <SectionOneNativeSlide page={currentItem.pdfPage} scale={scale} />;
  }

  return (
    <div className="deck-app">
      <header className="deck-header">
        <div className="deck-brand">
          <div className="header-logo-window">
            <Image src="/branding/EIU-logo-white.png" alt="EIU" width={2048} height={2048} priority unoptimized className="eiu-original-logo" />
          </div>
          <div className="deck-brand-line" />
          <div className="deck-brand-copy"><strong>Applied Agentic AI</strong><span>Interactive Learning Deck</span></div>
        </div>

        <nav className="header-navigation" aria-label="Slide navigation">
          <button type="button" className="header-nav-button" onClick={previousPage} disabled={pageNumber <= 1} title="Previous slide"><span className="header-nav-icon">←</span><span className="header-nav-text">Previous</span></button>
          <div className="header-slide-jump">
            <input type="number" min={1} max={numPages || 1} value={pageInput} aria-label="Go to slide" onChange={(event) => setPageInput(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); commitPageInput(); }
              if (event.key === "Escape") setPageInput(String(pageNumberRef.current));
            }} onFocus={(event) => event.currentTarget.select()} onBlur={() => setPageInput(String(pageNumberRef.current))} />
            <span className="header-slide-divider">/</span><span className="header-slide-total">{numPages}</span><span className="header-enter-hint">ENTER ↵</span>
          </div>
          <button type="button" className="header-nav-button header-nav-button-next" onClick={nextPage} disabled={pageNumber >= numPages} title="Next slide"><span className="header-nav-text">Next</span><span className="header-nav-icon">→</span></button>
        </nav>

        <div className="header-controls">
          <button type="button" onClick={zoomOut} title="Zoom out">−</button>
          <button type="button" className="zoom-label" onClick={resetZoom} title="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={zoomIn} title="Zoom in">+</button>
          <button type="button" className="fullscreen-button" onClick={toggleFullscreen}><span>⛶</span><span className="fullscreen-label">Fullscreen</span></button>
        </div>
      </header>

      <div className="deck-progress-line" aria-hidden="true"><div className="deck-progress-value" style={{ width: `${(pageNumber / numPages) * 100}%` }} /></div>

      <div className="deck-body">
        <main className="slide-stage" ref={stageRef}>
          <div className="stage-data-grid" />
          {renderWidth > 0 && <DeckSideAmbient slideWidth={renderWidth} />}
          {renderWidth > 0 ? (
            <>
              <div className="slide-frame" style={{ width: `${renderWidth}px`, aspectRatio: `${SLIDE_ASPECT_RATIO}` }}>
                <div key={`${pageNumber}-${currentItem?.kind ?? "empty"}`} className="section-one-slide-transition">
                  {renderCurrentSlide()}
                </div>
              </div>
              <WorkshopLaunchButton slideWidth={renderWidth} showDemoApp />
            </>
          ) : (
            <div className="viewer-measuring"><div className="loading-spinner" /></div>
          )}
        </main>
      </div>
    </div>
  );
}
