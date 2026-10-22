"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./EntranceBootOverlay.module.css";

interface EntranceBootOverlayProps {
  onComplete: () => void;
  onStartExit?: () => void;
  prefersReduced?: boolean | null;
  ready?: boolean;
}

export default function EntranceBootOverlay({
  onComplete,
  onStartExit,
  prefersReduced = false,
  ready = true,
}: EntranceBootOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const exitAtRef = useRef<number | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      // Preparation progress, capped until the scene is ready or its fallback opens.
      const elapsed = performance.now() - start;
      const target = prefersReduced ? 90 : Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 850))));
      setProgress(previous => Math.max(previous, target));
    };
    progressTimer.current = setInterval(tick, 60);
    return () => {
      if (progressTimer.current !== null) clearInterval(progressTimer.current);
      progressTimer.current = null;
    };
  }, [prefersReduced]);

  useEffect(() => {
    const now = performance.now();
    startedAtRef.current ??= now;
    const elapsed = now - startedAtRef.current;
    // Keep the logo's minimum duration, but wait for GPU preparation on cold loads.
    // The deadline always releases the sign-in form, even if WebGL never becomes ready.
    const minimum = prefersReduced ? 150 : 1080;
    const exitDelay = exitAtRef.current !== null ? 0 : Math.max(0, (ready || prefersReduced ? minimum : 4500) - elapsed);
    const fadeDuration = prefersReduced ? 250 : 480;
    let completeTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const exitTimer = setTimeout(() => {
      if (progressTimer.current !== null) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setProgress(100);
      fadeTimer = setTimeout(() => {
        if (exitAtRef.current === null) {
          exitAtRef.current = performance.now();
          setIsExiting(true);
          onStartExit?.();
        }
        // Start the fade's timer after the exit actually runs. GPU preparation
        // can delay timers on a cold load.
        completeTimer = setTimeout(onComplete, Math.max(0, fadeDuration - (performance.now() - exitAtRef.current)));
      }, prefersReduced ? 0 : 220);
    }, exitDelay);

    return () => {
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
      clearTimeout(exitTimer);
      if (completeTimer !== undefined) clearTimeout(completeTimer);
    };
  }, [onComplete, onStartExit, prefersReduced, ready]);

  return (
    <div
      className={`${styles.overlay} ${isExiting ? styles.exiting : ""}`}
      aria-label="EIU Interactive Learning Space"
    >
      {/* ── Soft EIU Brand Radial Glows ── */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      {/* ── Official EIU Logo Stage ── */}
      <div className={styles.logoStage}>
        <div className={styles.logoContainer}>
          <Image
            src="/branding/EIU-logo-white.png"
            alt="Eastern International University"
            width={2048}
            height={2048}
            preload
            unoptimized
            className={styles.logoImage}
          />
        </div>

        {/* "Interactive Learning Space" Subtitle */}
        <div className={styles.subtitleWrap}>
          <span className={styles.subtitleGold}>INTERACTIVE</span>
          <span className={styles.subtitleDivider} />
          <span className={styles.subtitleWhite}>LEARNING SPACE</span>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.systemBar} role="progressbar" aria-label="Loading learning space" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span className={styles.progressFill} style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <span className={styles.progressValue} aria-hidden="true">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
