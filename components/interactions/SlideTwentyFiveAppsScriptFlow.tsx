"use client";

import styles from "./SlideTwentyFiveAppsScriptFlow.module.css";

export default function SlideTwentyFiveAppsScriptFlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g25" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".14" />
            <stop offset="68%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path className={styles.path} pathLength="1" d="M480 313.46 C480 326.5, 480 340.5, 480 353.45" />

        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.2s" repeatCount="indefinite" path="M480 313.46 C480 326.5, 480 340.5, 480 353.45" />
        </circle>

        <g className={styles.head}>
          <path d="M480 353.45 l-10 -18 l20 0 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.topBox}`} />
      <span className={`${styles.hotspot} ${styles.bottomBox}`} />
    </div>
  );
}
