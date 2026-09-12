"use client";

import styles from "./SlideSixteenSheetsArrow.module.css";

export default function SlideSixteenSheetsArrow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g16" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="65%" stopColor="#e9ca8b" stopOpacity=".94" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity=".98" />
          </linearGradient>
        </defs>

        <path className={styles.path} pathLength="1" d="M374 229.93 C355 247, 331 270, 305 291.15" />
        <path className={styles.path} pathLength="1" d="M373.99 431 C423 431, 477 431, 525.97 431" style={{ animationDelay: ".3s" }} />

        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.45s" repeatCount="indefinite" path="M374 229.93 C355 247, 331 270, 305 291.15" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.45s" begin="0.55s" repeatCount="indefinite" path="M373.99 431 C423 431, 477 431, 525.97 431" />
        </circle>

        <g className={styles.heads}>
          <path d="M305 291.15 L313 275 L323 287 Z" />
          <path d="M525.97 431 l-18 -10 l0 20 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.h1}`} />
      <span className={`${styles.hotspot} ${styles.h2}`} />
      <span className={`${styles.hotspot} ${styles.h3}`} />
      <span className={`${styles.hotspot} ${styles.h4}`} />
    </div>
  );
}
