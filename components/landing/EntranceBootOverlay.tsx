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
  const [shimmerActive, setShimmerActive] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const exitAtRef = useRef<number | null>(null);

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
    const shimmerTimer = setTimeout(() => {
      setShimmerActive(true);
    }, Math.max(0, 680 - elapsed));

    const exitTimer = setTimeout(() => {
      if (exitAtRef.current === null) {
        exitAtRef.current = performance.now();
        setIsExiting(true);
        onStartExit?.();
      }
      // Start the fade's timer after the exit actually runs. GPU work can delay
      // timers on a cold load; two absolute deadlines could otherwise fire together.
      completeTimer = setTimeout(onComplete, Math.max(0, fadeDuration - (performance.now() - exitAtRef.current)));
    }, exitDelay);

    return () => {
      clearTimeout(shimmerTimer);
      clearTimeout(exitTimer);
      if (completeTimer !== undefined) clearTimeout(completeTimer);
    };
  }, [onComplete, onStartExit, prefersReduced, ready]);

  return (
    <div
      className={`${styles.overlay} ${isExiting ? styles.exiting : ""}`}
      aria-hidden="true"
    >
      {/* ── Soft EIU Brand Radial Glows ── */}
      <div className={styles.ambientGlow} />
      <div className={styles.subtleGoldAura} />

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
          {/* Single Subtle Light Sweep / Scan */}
          <div
            className={`${styles.shimmerBeam} ${
              shimmerActive ? styles.shimmerActive : ""
            }`}
          />
        </div>

        {/* "Interactive Learning Space" Subtitle */}
        <div className={styles.subtitleWrap}>
          <span className={styles.subtitleGold}>INTERACTIVE</span>
          <span className={styles.subtitleDivider} />
          <span className={styles.subtitleWhite}>LEARNING SPACE</span>
        </div>

        {/* Minimal System Hairline Indicator */}
        <div className={styles.systemBar} />
      </div>
    </div>
  );
}
