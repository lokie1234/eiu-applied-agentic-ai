"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanionEmotion, CompanionGaze } from "./CourseCompanion3D";
import styles from "./CourseDiscoveryHeading.module.css";

const CourseCompanion3D = memo(dynamic(() => import("./CourseCompanion3D"), { ssr: false }));

const OnlineCounter3D = memo(function OnlineCounter3D({ count }: { count: number }) {
  return <span className={styles.onlineCounter} role="status" aria-live="polite" aria-atomic="true" aria-label={`${count} learners online`}>
    <i aria-hidden="true" /><strong>{count}</strong>{" "}<span>online</span>
  </span>;
});

export default function CourseDiscoveryHeading({ onlineCount }: { onlineCount?: number }) {
  const [emotion, setEmotion] = useState<CompanionEmotion>("normal");
  const [emotionOpen, setEmotionOpen] = useState(false);
  const emotionPanelId = useId();
  const clusterRef = useRef<HTMLDivElement>(null);
  const emotionTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!emotionOpen) return;
    const outside = (event: PointerEvent) => {
      if (!clusterRef.current?.contains(event.target as Node)) setEmotionOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setEmotionOpen(false); emotionTriggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [emotionOpen]);
  const [energized, setEnergized] = useState(false);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const rendererReady = useCallback((value: boolean) => { setReady(value); setFallback(!value); }, []);
  useEffect(() => {
    if (ready) return;
    const pending = window.setTimeout(() => setFallback(true), 4000);
    return () => window.clearTimeout(pending);
  }, [ready]);
  const headingRef = useRef<HTMLDivElement>(null);
  const companionRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const chinRef = useRef<HTMLDivElement>(null);
  const gazeRef = useRef<CompanionGaze>({ x: 0, y: 0, reducedMotion: false, suspended: false });
  const wakeRef = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const heading = headingRef.current;
    const companion = companionRef.current;
    if (!heading || !companion) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    let pointer: { x: number; y: number } | null = null;
    let visible = true, modalOpen = false;
    let geometryDirty = true;
    let width = 1, height = 1, originX = 0, originY = 0;

    function direction(position: number, origin: number, size: number) {
      const offset = position - origin;
      const range = offset < 0 ? origin : size - origin;
      const normalized = Math.min(1, Math.abs(offset) / Math.max(1, range));
      return Math.sign(offset) * Math.pow(normalized, .7);
    }
    function updateGaze() {
      const x = pointer && !media.matches ? direction(pointer.x, originX, width) : 0;
      const y = pointer && !media.matches ? direction(pointer.y, originY, height) : 0;
      if (Math.abs(gazeRef.current.x - x) > .0005 || Math.abs(gazeRef.current.y - y) > .0005) {
        gazeRef.current.x = x;
        gazeRef.current.y = y;
        wakeRef.current?.();
      }
    }

    function commit() {
      frame = null;
      if (gazeRef.current.suspended) return;
      if (geometryDirty) {
        const bounds = companion!.getBoundingClientRect();
        originX = bounds.left + bounds.width / 2;
        originY = bounds.top + bounds.height / 2;
        width = window.innerWidth;
        height = window.innerHeight;
        geometryDirty = false;
      }
      // Normalize around the robot, with sensitivity across the entire viewport.
      // Bounds are cached: pointer events never cause a layout measurement.
      updateGaze();
      const { x, y } = gazeRef.current;
      if (!companion!.hasAttribute("data-ready")) {
        heading!.style.setProperty("--robot-look-x", `${x * 25}deg`);
        heading!.style.setProperty("--robot-look-y", `${-y * 18}deg`);
        heading!.style.setProperty("--eye-x", `${x * 3}px`);
      }
    }
    function schedule() {
      if (frame === null && !gazeRef.current.suspended) frame = requestAnimationFrame(commit);
    }
    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse" || media.matches || gazeRef.current.suspended) return;
      pointer = { x: event.clientX, y: event.clientY };
      // Feed WebGL immediately from cached coordinates; batch only the CSS work.
      if (!geometryDirty) updateGaze();
      if (geometryDirty || !companion!.hasAttribute("data-ready")) schedule();
    }
    function reset() { pointer = null; schedule(); }
    function leave(event: PointerEvent) { if (!event.relatedTarget) reset(); }
    function remeasure() { geometryDirty = true; schedule(); }
    function updateAvailability() {
      gazeRef.current.reducedMotion = media.matches;
      gazeRef.current.suspended = document.hidden || !visible || modalOpen;
      if (gazeRef.current.suspended) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        pointer = null;
      } else {
        geometryDirty = true;
        schedule();
        wakeRef.current?.();
      }
    }
    const resize = new ResizeObserver(remeasure);
    resize.observe(heading);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      updateAvailability();
    });
    intersection.observe(companion);
    const modalObserver = new MutationObserver(() => {
      const next = Boolean(heading!.closest("main")?.querySelector('[aria-modal="true"]'));
      if (next !== modalOpen) { modalOpen = next; updateAvailability(); }
    });
    const host = heading.closest("main");
    if (host) modalObserver.observe(host, { childList: true, subtree: true });
    updateAvailability();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true });
    window.addEventListener("blur", reset);
    window.addEventListener("resize", remeasure, { passive: true });
    document.addEventListener("scroll", remeasure, { capture: true, passive: true });
    document.addEventListener("visibilitychange", updateAvailability);
    media.addEventListener("change", updateAvailability);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      modalObserver.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", remeasure);
      document.removeEventListener("scroll", remeasure, true);
      document.removeEventListener("visibilitychange", updateAvailability);
      media.removeEventListener("change", updateAvailability);
    };
  }, []);

  function energize() {
    if (timer.current) clearTimeout(timer.current);
    setEnergized(true);
    timer.current = setTimeout(() => setEnergized(false), 1400);
  }

  return <div ref={headingRef} className={styles.heading} data-energized={energized || undefined} data-emotion={emotion} data-emotion-open={emotionOpen || undefined}>
    <div ref={clusterRef} className={styles.companionCluster}>
    <div ref={companionRef} className={styles.companion} data-ready={ready || undefined} data-fallback={fallback || undefined}>
    <button type="button" className={styles.greetButton} onClick={energize} aria-label="Activate AI companion animation" />
    <div className={styles.faceControls}>
    <button ref={emotionTriggerRef} type="button" className={styles.emotionTrigger} aria-label="Choose robot emotion" aria-expanded={emotionOpen} aria-controls={emotionPanelId} onClick={() => setEmotionOpen(open => !open)}><span className={styles.antennaBeacon} aria-hidden="true" /></button>
    <div ref={screenRef} className={styles.faceScreen} data-open={emotionOpen || undefined}>
    {emotionOpen && <div id={emotionPanelId} className={styles.emotionRail} role="group" aria-label="Robot emotion">
      {([{ value: "normal", label: "Vui vẻ" }, { value: "angry", label: "Tập trung" }, { value: "surprised", label: "Ngạc nhiên" }] as const).map(option =>
        <button key={option.value} type="button" className={styles.emotionButton} aria-label={option.label} data-emotion-choice={option.value} aria-pressed={emotion === option.value} onClick={() => { setEmotion(option.value); setEmotionOpen(false); emotionTriggerRef.current?.focus(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="5" />
            {option.value === "normal" ? <><path d="M8 9v2m8-2v2m-7 3q3 4 6 0" /></>
              : option.value === "angry" ? <><path d="m7 9 3 1m7-1-3 1m-5 5q3-3 6 0" /></>
              : <><circle cx="8" cy="10" r="1" /><circle cx="16" cy="10" r="1" /><ellipse cx="12" cy="15" rx="2" ry="2.5" /></>}
          </svg>
        </button>)}
    </div>}
    </div><div ref={chinRef} className={styles.chinSignals} aria-hidden="true"><i /><i /><i /></div></div>
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.robot} aria-hidden="true">
        <span className={styles.antenna} />
        <span className={styles.earLeft} /><span className={styles.earRight} />
        <span className={styles.shell}>
          <span className={styles.visor}><span className={styles.eyes}><i /><i /></span><span className={styles.smile} /></span>
          <span className={styles.chin}><i /><i /><i /></span>
        </span>
      </span>
      <span className={styles.shadow} aria-hidden="true" />
      <span className={styles.spark} aria-hidden="true">✦</span>
      <span className={styles.webgl} aria-hidden="true"><CourseCompanion3D gazeRef={gazeRef} wakeRef={wakeRef} energized={energized} emotion={emotion} emotionOpen={emotionOpen} screenRef={screenRef} antennaRef={emotionTriggerRef} chinRef={chinRef} onReady={rendererReady} /></span>
    </div>
    </div>
    <div className={styles.copy}>
      <div className={styles.eyebrowLine}><span className={styles.eyebrow} aria-hidden="true"><i /> YOUR NEXT DISCOVERY</span>{onlineCount !== undefined && <OnlineCounter3D count={onlineCount} />}</div>
      <h1 className={styles.title}>Choose a <span className={styles.word}>course<span className={styles.signal} aria-hidden="true" /></span></h1>
    </div>
  </div>;
}
