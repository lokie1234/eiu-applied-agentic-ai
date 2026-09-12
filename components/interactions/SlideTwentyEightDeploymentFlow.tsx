"use client";

import styles from "./SlideTwentyEightDeploymentFlow.module.css";

export default function SlideTwentyEightDeploymentFlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g28Down" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="68%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="g28Right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="68%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path className={`${styles.path} ${styles.downPath}`} pathLength="1" d="M280 257.85 C280 266, 280 276, 280 284.39" />
        <path className={`${styles.path} ${styles.rightPath}`} pathLength="1" d="M548.68 291.5 C565 291.5, 581 291.5, 597.77 291.5" style={{ animationDelay: ".45s" }} />

        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.15s" repeatCount="indefinite" path="M280 257.85 C280 266, 280 276, 280 284.39" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.15s" begin=".55s" repeatCount="indefinite" path="M548.68 291.5 C565 291.5, 581 291.5, 597.77 291.5" />
        </circle>

        <g className={styles.heads}>
          <path d="M280 284.39 l-10 -18 l20 0 z" />
          <path d="M597.77 291.5 l-18 -10 l0 20 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.h1}`} />
      <span className={`${styles.hotspot} ${styles.h2}`} />
      <span className={`${styles.hotspot} ${styles.h3}`} />
    </div>
  );
}
