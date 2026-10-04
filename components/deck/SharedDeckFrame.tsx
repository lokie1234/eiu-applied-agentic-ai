"use client";

import Image from "next/image";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckSideAmbient from "@/components/DeckSideAmbient";
import WorkshopLaunchButton from "@/components/WorkshopLaunchButton";

const SLIDE_ASPECT_RATIO = 16 / 9;

type Props = {
  courseTitle: string;
  sectionTitle: string;
  totalSlides: number;
  renderSlide: (pageNumber: number, renderWidth: number) => ReactNode;
  frameClassName?: string;
  transitionClassName?: string;
  showWorkshopApps?: boolean;
  showDemoApp?: boolean;
  aspectRatio?: number;
};

export default function SharedDeckFrame({
  courseTitle,
  sectionTitle,
  totalSlides,
  renderSlide,
  frameClassName = "slide-frame",
  transitionClassName = "section-one-slide-transition",
  showWorkshopApps = false,
  showDemoApp = false,
  aspectRatio = SLIDE_ASPECT_RATIO,
}: Props) {
  const safeTotal = Math.max(1, totalSlides);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [viewerWidth, setViewerWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(1);
  const totalRef = useRef(safeTotal);
  const wheelAccumulatorRef = useRef(0);
  const wheelDirectionRef = useRef(0);
  const lastWheelNavigationRef = useRef(0);
  const wheelResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    totalRef.current = safeTotal;
    if (pageRef.current > safeTotal) {
      pageRef.current = safeTotal;
      setPageNumber(safeTotal);
      setPageInput(String(safeTotal));
    }
  }, [safeTotal]);

  const renderWidth = useMemo(
    () => (viewerWidth > 0 ? Math.round(viewerWidth * zoom) : 0),
    [viewerWidth, zoom],
  );

  const goToPage = useCallback((page: number) => {
    const next = Math.min(Math.max(Math.round(page), 1), totalRef.current);
    pageRef.current = next;
    setPageNumber(next);
    setPageInput(String(next));
  }, []);

  const nextPage = useCallback(() => goToPage(pageRef.current + 1), [goToPage]);
  const previousPage = useCallback(() => goToPage(pageRef.current - 1), [goToPage]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === " " && target.closest("button, a, [data-interactive='true']")) return;
      if (["ArrowRight", "ArrowUp", "PageUp", " "].includes(event.key)) {
        event.preventDefault();
        nextPage();
      } else if (["ArrowLeft", "ArrowDown", "PageDown"].includes(event.key)) {
        event.preventDefault();
        previousPage();
      } else if (event.key === "Home") {
        event.preventDefault();
        goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        goToPage(totalRef.current);
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
      const direction = event.deltaY < 0 ? -1 : 1;
      if (wheelDirectionRef.current && wheelDirectionRef.current !== direction) wheelAccumulatorRef.current = 0;
      wheelDirectionRef.current = direction;
      wheelAccumulatorRef.current += event.deltaY;
      if (wheelResetTimerRef.current !== null) window.clearTimeout(wheelResetTimerRef.current);
      wheelResetTimerRef.current = window.setTimeout(() => {
        wheelAccumulatorRef.current = 0;
        wheelDirectionRef.current = 0;
      }, 140);
      if (Math.abs(wheelAccumulatorRef.current) < 32) return;
      const now = performance.now();
      if (now - lastWheelNavigationRef.current < 360) return;
      lastWheelNavigationRef.current = now;
      if (wheelAccumulatorRef.current < 0) nextPage();
      else previousPage();
      wheelAccumulatorRef.current = 0;
    }
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
      if (wheelResetTimerRef.current !== null) window.clearTimeout(wheelResetTimerRef.current);
    };
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
        setViewerWidth(Math.max(1, Math.min(availableWidth, availableHeight * aspectRatio, 1920)));
      });
    }
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [aspectRatio]);

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
            <Image src="/branding/EIU-logo-white.png" alt="EIU" width={2048} height={2048} priority unoptimized className="eiu-original-logo" />
          </div>
          <div className="deck-brand-line" />
          <div className="deck-brand-copy">
            <strong title={courseTitle}>{courseTitle}</strong>
            <span title={sectionTitle}>{sectionTitle}</span>
          </div>
        </div>

        <nav className="header-navigation" aria-label="Slide navigation">
          <button type="button" className="header-nav-button" onClick={previousPage} disabled={pageNumber <= 1} title="Previous slide">
            <span className="header-nav-icon">←</span><span className="header-nav-text">Previous</span>
          </button>
          <div className="header-slide-jump">
            <input
              type="number"
              min={1}
              max={safeTotal}
              value={pageInput}
              aria-label="Go to slide"
              onChange={(event) => setPageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const value = Number(pageInput);
                  if (Number.isFinite(value)) goToPage(value);
                }
                if (event.key === "Escape") setPageInput(String(pageRef.current));
              }}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => setPageInput(String(pageRef.current))}
            />
            <span className="header-slide-divider">/</span>
            <span className="header-slide-total">{safeTotal}</span>
            <span className="header-enter-hint">ENTER ↵</span>
          </div>
          <button type="button" className="header-nav-button header-nav-button-next" onClick={nextPage} disabled={pageNumber >= safeTotal} title="Next slide">
            <span className="header-nav-text">Next</span><span className="header-nav-icon">→</span>
          </button>
        </nav>

        <div className="header-controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.1).toFixed(1)))} title="Zoom out">−</button>
          <button type="button" className="zoom-label" onClick={() => setZoom(1)} title="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, +(value + 0.1).toFixed(1)))} title="Zoom in">+</button>
          <button type="button" className="fullscreen-button" onClick={toggleFullscreen}><span>⛶</span><span className="fullscreen-label">Fullscreen</span></button>
        </div>
      </header>

      <div className="deck-progress-line" aria-hidden="true"><div className="deck-progress-value" style={{ width: `${(pageNumber / safeTotal) * 100}%` }} /></div>
      <div className="deck-body">
        <main className="slide-stage" ref={stageRef}>
          <div className="stage-data-grid" />
          {renderWidth > 0 && <DeckSideAmbient slideWidth={renderWidth} />}
          {renderWidth > 0 ? (
            <>
              <div className={frameClassName} style={{ width: renderWidth, aspectRatio: `${aspectRatio}` }}>
                <div key={pageNumber} className={transitionClassName}>{renderSlide(pageNumber, renderWidth)}</div>
              </div>
              {showWorkshopApps && <WorkshopLaunchButton slideWidth={renderWidth} showDemoApp={showDemoApp} />}
            </>
          ) : <div className="viewer-measuring"><div className="loading-spinner" /></div>}
        </main>
      </div>
    </div>
  );
}
