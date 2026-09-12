"use client";

import styles from "./SlideFifteenDriveFolder.module.css";

export default function SlideFifteenDriveFolder() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g15" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".12" />
            <stop offset="72%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f6e6be" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path className={styles.arrow} pathLength="1" d="M189.44 250 C224 250, 262 250, 296.39 250" />
        <path className={styles.arrow} pathLength="1" d="M513.14 250 C548 250, 585 250, 620.09 250" style={{ animationDelay: ".25s" }} />
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.2s" repeatCount="indefinite" path="M189.44 250 C224 250, 262 250, 296.39 250" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.2s" begin=".35s" repeatCount="indefinite" path="M513.14 250 C548 250, 585 250, 620.09 250" />
        </circle>
        <g className={styles.arrowHeads}>
          <path d="M296.39 250 l-16 -10 l0 20 z" />
          <path d="M620.09 250 l-16 -10 l0 20 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.box1}`} />
      <span className={`${styles.hotspot} ${styles.box2}`} />
      <span className={`${styles.hotspot} ${styles.box3}`} />
    </div>
  );
}
