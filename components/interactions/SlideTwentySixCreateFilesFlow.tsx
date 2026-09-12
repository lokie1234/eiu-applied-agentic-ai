"use client";

import styles from "./SlideTwentySixCreateFilesFlow.module.css";

export default function SlideTwentySixCreateFilesFlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g26" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="68%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path className={styles.path} pathLength="1" d="M801 237.55 C801 249.5, 801 263.5, 801 275.55" />

        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.25s" repeatCount="indefinite" path="M801 237.55 C801 249.5, 801 263.5, 801 275.55" />
        </circle>

        <g className={styles.head}>
          <path d="M801 275.55 l-10 -18 l20 0 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.topBox}`} />
      <span className={`${styles.hotspot} ${styles.bottomBox}`} />
    </div>
  );
}
