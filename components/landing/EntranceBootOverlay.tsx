"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./EntranceBootOverlay.module.css";

interface EntranceBootOverlayProps {
  onComplete: () => void;
  onStartExit?: () => void;
  prefersReduced?: boolean | null;
}

export default function EntranceBootOverlay({
  onComplete,
  onStartExit,
  prefersReduced = false,
}: EntranceBootOverlayProps) {
  const [shimmerActive, setShimmerActive] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (prefersReduced) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
        onStartExit?.();
      }, 150);
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 400);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(completeTimer);
      };
    }

    // Sequence for standard entrance (Total ~1.55 seconds):
    // 0ms - 200ms: Environment awake, ambient glow fades in
    // 200ms - 680ms: EIU logo emerges (opacity + subtle scale + blur clear)
    // 680ms - 1100ms: Single photonic light sweep across EIU logo
    // 1080ms: Underlying page ready -> overlay starts smooth dissolve
    // 1560ms: Complete reveal, overlay unmounts
    const shimmerTimer = setTimeout(() => {
      setShimmerActive(true);
    }, 680);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      onStartExit?.();
    }, 1080);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1560);

    return () => {
      clearTimeout(shimmerTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, onStartExit, prefersReduced]);

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
            priority
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
