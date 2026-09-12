"use client";

import styles from "./SlideTwentyNineFirstRunFlow.module.css";

export default function SlideTwentyNineFirstRunFlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g29Left" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="68%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="g29Right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="68%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path className={`${styles.path} ${styles.leftPath}`} pathLength="1" d="M564.35 126.6 C515 126.8, 467 127, 417.96 127.24" />
        <path className={`${styles.path} ${styles.rightPath}`} pathLength="1" d="M417.96 230 C472 230, 525 230, 578.49 230" style={{ animationDelay: ".45s" }} />
        <path className={`${styles.path} ${styles.leftPath}`} pathLength="1" d="M578.49 352 C563 352, 548 352, 533.36 352" style={{ animationDelay: ".9s" }} />

        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.35s" repeatCount="indefinite" path="M564.35 126.6 C515 126.8, 467 127, 417.96 127.24" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.35s" begin=".55s" repeatCount="indefinite" path="M417.96 230 C472 230, 525 230, 578.49 230" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.35s" begin="1.1s" repeatCount="indefinite" path="M578.49 352 C563 352, 548 352, 533.36 352" />
        </circle>

        <g className={styles.heads}>
          <path d="M417.96 127.24 l18 -10 l0 20 z" />
          <path d="M578.49 230 l-18 -10 l0 20 z" />
          <path d="M533.36 352 l18 -10 l0 20 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.h1}`} />
      <span className={`${styles.hotspot} ${styles.h2}`} />
      <span className={`${styles.hotspot} ${styles.h3}`} />
      <span className={`${styles.hotspot} ${styles.h4}`} />
    </div>
  );
}
