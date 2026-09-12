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
        <path className={styles.path} d="M389 177 C341 208, 281 247, 173 325" />
        <path className={styles.path} d="M365 429 C430 429, 490 429, 572 423" style={{ animationDelay: '.28s' }} />
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.45s" repeatCount="indefinite" path="M389 177 C341 208, 281 247, 173 325" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.45s" begin="0.5s" repeatCount="indefinite" path="M365 429 C430 429, 490 429, 572 423" />
        </circle>
        <g className={styles.heads}>
          <path d="M173 325 l-20 -3 l10 18 z" />
          <path d="M572 423 l-18 -9 l5 19 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.h1}`} />
      <span className={`${styles.hotspot} ${styles.h2}`} />
      <span className={`${styles.hotspot} ${styles.h3}`} />
      <span className={`${styles.hotspot} ${styles.h4}`} />
      <div className={styles.badge}>CREATE SHEET → CONFIGURE → OPEN</div>
    </div>
  );
}
