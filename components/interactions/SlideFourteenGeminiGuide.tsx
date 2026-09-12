"use client";

import styles from "./SlideFourteenGeminiGuide.module.css";

export default function SlideFourteenGeminiGuide() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g14" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="65%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path
          className={styles.arrow}
          pathLength="1"
          d="M241.7 289 C292 289, 352 289, 410.58 289"
        />

        <circle className={styles.signal} r="4.9">
          <animateMotion
            dur="2.1s"
            repeatCount="indefinite"
            path="M241.7 289 C292 289, 352 289, 410.58 289"
          />
        </circle>

        <g className={styles.arrowHead}>
          <path d="M410.58 289 l-18 -11 l0 22 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.signIn}`} />
      <span className={`${styles.hotspot} ${styles.modelCard}`} />
    </div>
  );
}
