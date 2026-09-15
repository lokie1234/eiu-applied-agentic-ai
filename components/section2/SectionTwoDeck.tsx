"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckSideAmbient from "@/components/DeckSideAmbient";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";
import SectionTwoSlide from "./SectionTwoSlide";
import styles from "./SectionTwoDeck.module.css";

const TOTAL_SLIDES = 39;
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

export default function SectionTwoDeck({ onChooseSection, isAdmin = false }: { onChooseSection?: () => void; isAdmin?: boolean }) {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(1);
  const wheelAccumulatorRef = useRef(0);
  const lastWheelNavigationRef = useRef(0);

  const renderWidth = useMemo(
    () => (viewerWidth > 0 ? Math.round(viewerWidth * zoom) : 0),
    [viewerWidth, zoom]
  );

  const goToPage = useCallback((page: number) => {
    const safePage = Math.min(Math.max(Math.round(page), 1), TOTAL_SLIDES);
    pageRef.current = safePage;
    setPageNumber(safePage);
    setPageInput(String(safePage));
  }, []);

  const previousPage = useCallback(() => {
    if (pageRef.current > 1) goToPage(pageRef.current - 1);
  }, [goToPage]);

  const nextPage = useCallback(() => {
    if (pageRef.current < TOTAL_SLIDES) goToPage(pageRef.current + 1);
  }, [goToPage]);

  function commitPageInput() {
    const value = Number(pageInput);
    if (Number.isFinite(value)) goToPage(value);
    else setPageInput(String(pageRef.current));
  }

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, [data-interactive='true']")) return;

      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        nextPage();
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        previousPage();
      } else if (event.key === "Home") {
        event.preventDefault();
        goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        goToPage(TOTAL_SLIDES);
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [goToPage, nextPage, previousPage]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function handleWheel(event: WheelEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [data-interactive='true']")) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || Math.abs(event.deltaY) < 0.5) return;
      event.preventDefault();
      wheelAccumulatorRef.current += event.deltaY;
      if (Math.abs(wheelAccumulatorRef.current) < 32) return;
      const now = performance.now();
      if (now - lastWheelNavigationRef.current < 360) return;
      lastWheelNavigationRef.current = now;
      if (wheelAccumulatorRef.current < 0) nextPage();
      else previousPage();
      wheelAccumulatorRef.current = 0;
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [nextPage, previousPage]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frameId = 0;

    function updateSize() {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (!stageRef.current) return;
        const availableWidth = Math.max(stageRef.current.clientWidth - 18, 280);
        const availableHeight = Math.max(stageRef.current.clientHeight - 18, 180);
        setViewerWidth(Math.max(280, Math.min(availableWidth, availableHeight * (16 / 9), 1920)));
      });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
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
            <strong>Applied Agentic AI · Section 2</strong>
            <span>AI Business Framework</span>
          </div>
        </div>

        <nav className="header-navigation" aria-label="Slide navigation">
          <button type="button" className="header-nav-button" onClick={previousPage} disabled={pageNumber <= 1}>
            <span className="header-nav-icon">←</span>
            <span className="header-nav-text">Previous</span>
          </button>
          <div className="header-slide-jump">
            <input
              type="number"
              min={1}
              max={TOTAL_SLIDES}
              value={pageInput}
              aria-label="Go to slide"
              onChange={(event) => setPageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitPageInput();
                if (event.key === "Escape") setPageInput(String(pageRef.current));
              }}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => setPageInput(String(pageRef.current))}
            />
            <span className="header-slide-divider">/</span>
            <span className="header-slide-total">{TOTAL_SLIDES}</span>
            <span className="header-enter-hint">ENTER ↵</span>
          </div>
          <button type="button" className="header-nav-button header-nav-button-next" onClick={nextPage} disabled={pageNumber >= TOTAL_SLIDES}>
            <span className="header-nav-text">Next</span>
            <span className="header-nav-icon">→</span>
          </button>
        </nav>

        <div className="header-controls">
          {onChooseSection && <button type="button" onClick={onChooseSection}>Sections</button>}
          <button type="button" onClick={() => setZoom((value) => Math.max(.5, +(value - .1).toFixed(1)))}>−</button>
          <button type="button" className="zoom-label" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, +(value + .1).toFixed(1)))}>+</button>
          <button type="button" className="fullscreen-button" onClick={toggleFullscreen}>
            <span>⛶</span><span className="fullscreen-label">Fullscreen</span>
          </button>
        </div>
      </header>

      <div className="deck-progress-line" aria-hidden="true">
        <div className="deck-progress-value" style={{ width: `${(pageNumber / TOTAL_SLIDES) * 100}%` }} />
      </div>

      <div className="deck-body">
        <main className="slide-stage" ref={stageRef}>
          <div className="stage-data-grid" />
          {renderWidth > 0 && <DeckSideAmbient slideWidth={renderWidth} />}
          {renderWidth > 0 ? (
            <div
              className={styles.frame}
              style={{ width: renderWidth, height: renderWidth * (SLIDE_HEIGHT / SLIDE_WIDTH) }}
            >
              {pageNumber === 38 ? (
                <ShowcaseSlide scale={renderWidth / SLIDE_WIDTH} isAdmin={isAdmin} section="section2" />
              ) : pageNumber === 39 ? (
                <QuizSlide scale={renderWidth / SLIDE_WIDTH} variant="section2" />
              ) : (
                <div
                  className={styles.canvas}
                  style={{ transform: `scale(${renderWidth / SLIDE_WIDTH})` }}
                >
                  <SectionTwoSlide pageNumber={pageNumber} />
                </div>
              )}
            </div>
          ) : (
            <div className="viewer-measuring"><div className="loading-spinner" /></div>
          )}
        </main>
      </div>
    </div>
  );
}
