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
        <path className={styles.arrow} d="M186 250 C220 250, 256 250, 291 250" />
        <path className={styles.arrow} d="M530 250 C570 250, 606 250, 637 250" style={{ animationDelay: '.25s' }} />
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.25s" repeatCount="indefinite" path="M186 250 C220 250, 256 250, 291 250" />
        </circle>
        <circle className={styles.signal} r="4.8">
          <animateMotion dur="2.25s" begin="0.45s" repeatCount="indefinite" path="M530 250 C570 250, 606 250, 637 250" />
        </circle>
        <g className={styles.arrowHeads}>
          <path d="M291 250 l-16 -10 l0 20 z" />
          <path d="M637 250 l-16 -10 l0 20 z" />
        </g>
      </svg>

      <span className={`${styles.hotspot} ${styles.box1}`} />
      <span className={`${styles.hotspot} ${styles.box2}`} />
      <span className={`${styles.hotspot} ${styles.box3}`} />
      <span className={`${styles.spark} ${styles.spark1}`} />
      <span className={`${styles.spark} ${styles.spark2}`} />
      <span className={`${styles.spark} ${styles.spark3}`} />
      <div className={styles.pill}>NEW FOLDER FLOW</div>
    </div>
  );
}
