"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import DeckSideAmbient from "@/components/DeckSideAmbient";
import InteractionLayer from "@/components/interactions/InteractionLayer";
import SlideOneAIHero from "@/components/interactions/SlideOneAIHero";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PDF_URL = process.env.NEXT_PUBLIC_PDF_URL ?? "";

export default function PdfDeck() {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [numPages, setNumPages] = useState(0);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(0);
  const [pageAspectRatio, setPageAspectRatio] = useState(16 / 9);
  const [pdfError, setPdfError] = useState("");

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

  const isIntroHeroSlide = pageNumber === 1;
  const isShowcaseSlide = pageNumber === 38;
  const isQuizSlide = pdfPageCount > 0 && pageNumber === pdfPageCount + 1;

  useEffect(() => {
    pageNumberRef.current = pageNumber;
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  useEffect(() => {
    numPagesRef.current = numPages;
  }, [numPages]);

  function goToPage(page: number) {
    const total = numPagesRef.current;
    if (total <= 0) return;

    const safePage = Math.min(Math.max(Math.round(page), 1), total);
    pageNumberRef.current = safePage;
    setPageNumber(safePage);
    setPageInput(String(safePage));
  }

  function nextPage() {
    if (pageNumberRef.current < numPagesRef.current) {
      goToPage(pageNumberRef.current + 1);
    }
  }

  function previousPage() {
    if (pageNumberRef.current > 1) {
      goToPage(pageNumberRef.current - 1);
    }
  }

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

  async function handlePdfLoaded(pdf: PDFDocumentProxy) {
    const totalWithQuiz = pdf.numPages + 1;
    setPdfPageCount(pdf.numPages);
    setNumPages(totalWithQuiz);
    numPagesRef.current = totalWithQuiz;

    try {
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });

      if (viewport.height > 0) {
        setPageAspectRatio(viewport.width / viewport.height);
      }
    } catch (error) {
      console.error("Cannot detect PDF ratio:", error);
    }
  }

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;

      if (target.closest("input, textarea, select, [data-interactive='true']")) {
        return;
      }

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
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const WHEEL_THRESHOLD = 32;
    const WHEEL_COOLDOWN = 360;
    const WHEEL_IDLE_RESET = 140;

    function handleWheel(event: WheelEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest("input, textarea, select, [data-interactive='true']")) {
        return;
      }

      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (Math.abs(event.deltaY) < 0.5) return;

      event.preventDefault();

      const direction = event.deltaY < 0 ? -1 : 1;

      if (
        wheelDirectionRef.current !== 0 &&
        wheelDirectionRef.current !== direction
      ) {
        wheelAccumulatorRef.current = 0;
      }

      wheelDirectionRef.current = direction;
      wheelAccumulatorRef.current += event.deltaY;

      if (wheelResetTimerRef.current !== null) {
        window.clearTimeout(wheelResetTimerRef.current);
      }

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

      // Giữ đúng interaction đã test: cuộn lên = slide tiếp,
      // cuộn xuống = slide trước.
      if (
        wheelAccumulatorRef.current < 0 &&
        current < numPagesRef.current
      ) {
        targetPage = current + 1;
      } else if (wheelAccumulatorRef.current > 0 && current > 1) {
        targetPage = current - 1;
      }

      wheelAccumulatorRef.current = 0;
      wheelDirectionRef.current = 0;

      if (targetPage === current) return;

      lastWheelNavigationRef.current = now;
      goToPage(targetPage);
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      stage.removeEventListener("wheel", handleWheel);

      if (wheelResetTimerRef.current !== null) {
        window.clearTimeout(wheelResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frameId: number | null = null;

    function updateSize() {
      if (!stageRef.current) return;

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const currentStage = stageRef.current;
        if (!currentStage) return;

        const availableWidth = Math.max(currentStage.clientWidth - 18, 280);
        const availableHeight = Math.max(currentStage.clientHeight - 18, 180);
        const widthFromHeight = availableHeight * pageAspectRatio;
        const width = Math.max(
          280,
          Math.min(availableWidth, widthFromHeight, 1920)
        );

        setViewerWidth(width);
      });
    }

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);

    return () => {
      observer.disconnect();

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [pageAspectRatio]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }

  if (!PDF_URL) {
    return (
      <main className="fatal-error">
        <div>
          <h2>PDF URL chưa được cấu hình</h2>
          <p>Kiểm tra NEXT_PUBLIC_PDF_URL trong Environment Variables.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="deck-app">
      <header className="deck-header">
        <div className="deck-brand">
          <div className="header-logo-window">
            <Image
              src="/branding/EIU-logo-white.png"
              alt="EIU"
              width={2048}
              height={2048}
              priority
              unoptimized
              className="eiu-original-logo"
            />
          </div>

          <div className="deck-brand-line" />

          <div className="deck-brand-copy">
            <strong>Applied Agentic AI</strong>
            <span>Interactive Learning Deck</span>
          </div>
        </div>

        <nav className="header-navigation" aria-label="Slide navigation">
          <button
            type="button"
            className="header-nav-button"
            onClick={previousPage}
            disabled={pageNumber <= 1}
            title="Previous slide"
          >
            <span className="header-nav-icon">←</span>
            <span className="header-nav-text">Previous</span>
          </button>

          <div className="header-slide-jump">
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageInput}
              aria-label="Go to slide"
              onChange={(event) => setPageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitPageInput();
                }

                if (event.key === "Escape") {
                  setPageInput(String(pageNumberRef.current));
                }
              }}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => setPageInput(String(pageNumberRef.current))}
            />

            <span className="header-slide-divider">/</span>
            <span className="header-slide-total">{numPages || "—"}</span>
            <span className="header-enter-hint">ENTER ↵</span>
          </div>

          <button
            type="button"
            className="header-nav-button header-nav-button-next"
            onClick={nextPage}
            disabled={numPages === 0 || pageNumber >= numPages}
            title="Next slide"
          >
            <span className="header-nav-text">Next</span>
            <span className="header-nav-icon">→</span>
          </button>
        </nav>

        <div className="header-controls">
          <button type="button" onClick={zoomOut} title="Zoom out">
            −
          </button>

          <button
            type="button"
            className="zoom-label"
            onClick={resetZoom}
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button type="button" onClick={zoomIn} title="Zoom in">
            +
          </button>

          <button
            type="button"
            className="fullscreen-button"
            onClick={toggleFullscreen}
          >
            <span>⛶</span>
            <span className="fullscreen-label">Fullscreen</span>
          </button>
        </div>
      </header>

      <div className="deck-progress-line" aria-hidden="true">
        <div
          className="deck-progress-value"
          style={{
            width: numPages > 0 ? `${(pageNumber / numPages) * 100}%` : "0%",
          }}
        />
      </div>

      <div className="deck-body">
        <main className="slide-stage" ref={stageRef}>
          <div className="stage-data-grid" />
          {renderWidth > 0 && <DeckSideAmbient slideWidth={renderWidth} />}

          {pdfError ? (
            <div className="pdf-error">
              <div className="pdf-error-symbol">!</div>
              <h2>Cannot load PDF</h2>
              <p>{pdfError}</p>
            </div>
          ) : (
            <Document
              file={PDF_URL}
              onLoadSuccess={handlePdfLoaded}
              onLoadError={(error) => setPdfError(error.message)}
              externalLinkTarget="_blank"
              externalLinkRel="noopener noreferrer"
              loading={
                <div className="pdf-loading">
                  <div className="loading-spinner" />
                  <strong>Loading presentation</strong>
                  <span>Preparing your deck...</span>
                </div>
              }
            >
              {renderWidth > 0 ? (
                <div
                  className={isIntroHeroSlide ? "slide-frame slide-frame-hero" : "slide-frame"}
                  style={{
                    width: `${renderWidth}px`,
                    aspectRatio: `${pageAspectRatio}`,
                  }}
                >
                  {isShowcaseSlide ? (
                    <ShowcaseSlide scale={renderWidth / 960} />
                  ) : isQuizSlide ? (
                    <QuizSlide scale={renderWidth / 960} />
                  ) : (
                    <>
                      <Page
                        pageNumber={pageNumber}
                        width={renderWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer
                        loading={
                          <div className="page-loading-shell">
                            <div className="loading-spinner" />
                          </div>
                        }
                      />

                      {isIntroHeroSlide && <SlideOneAIHero />}
                      <InteractionLayer pageNumber={pageNumber} />
                    </>
                  )}
                </div>
              ) : (
                <div className="viewer-measuring">
                  <div className="loading-spinner" />
                </div>
              )}
            </Document>
          )}
        </main>
      </div>


    </div>
  );
}
