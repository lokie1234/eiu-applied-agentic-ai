"use client";

import styles from "./SlideEighteenGarbageIn.module.css";

export default function SlideEighteenGarbageIn() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.coreGlow} />
      <svg className={styles.flow} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g18" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".24" />
            <stop offset="50%" stopColor="#e9ca8b" stopOpacity=".92" />
            <stop offset="100%" stopColor="#b39159" stopOpacity=".24" />
          </linearGradient>
        </defs>
        <path className={styles.path} d="M298 339 C384 342, 475 342, 653 339" />
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="3s" repeatCount="indefinite" path="M298 339 C384 342, 475 342, 653 339" />
        </circle>
      </svg>
      <svg className={styles.network} viewBox="0 0 250 220">
        <g className={styles.links}><path d="M48 144 L100 90 L155 125 L210 74"/><path d="M100 90 L132 154"/><path d="M155 125 L132 154"/></g>
        <g className={styles.nodes}><circle cx="48" cy="144" r="4"/><circle cx="100" cy="90" r="4"/><circle cx="155" cy="125" r="4"/><circle cx="210" cy="74" r="4"/><circle cx="132" cy="154" r="5"/></g>
      </svg>
    </div>
  );
}
