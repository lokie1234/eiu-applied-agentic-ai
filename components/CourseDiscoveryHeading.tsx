"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanionGaze } from "./CourseCompanion3D";
import styles from "./CourseDiscoveryHeading.module.css";

const CourseCompanion3D = dynamic(() => import("./CourseCompanion3D"), { ssr: false });

export default function CourseDiscoveryHeading() {
  const [energized, setEnergized] = useState(false);
  const [ready, setReady] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const companionRef = useRef<HTMLButtonElement>(null);
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

  return <div ref={headingRef} className={styles.heading} data-energized={energized || undefined}>
    <button ref={companionRef} className={styles.companion} type="button" onClick={energize} data-ready={ready || undefined}
      aria-label="Activate AI companion animation" title="Say hello to your AI companion">
      <span className={styles.orbit} aria-hidden="true" />
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
      <span className={styles.webgl} aria-hidden="true"><CourseCompanion3D gazeRef={gazeRef} wakeRef={wakeRef} energized={energized} onReady={setReady} /></span>
    </button>
    <div className={styles.copy}>
      <span className={styles.eyebrow} aria-hidden="true"><i /> YOUR NEXT DISCOVERY</span>
      <h1 className={styles.title}>Choose a <span className={styles.word}>course<span className={styles.signal} aria-hidden="true" /></span></h1>
    </div>
  </div>;
}
