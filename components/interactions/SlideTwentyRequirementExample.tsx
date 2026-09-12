"use client";

import styles from "./SlideTwentyRequirementExample.module.css";

export default function SlideTwentyRequirementExample() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.band} />
      <span className={`${styles.dotPulse} ${styles.d1}`} />
      <span className={`${styles.dotPulse} ${styles.d2}`} />
      <span className={`${styles.dotPulse} ${styles.d3}`} />
      <span className={`${styles.dotPulse} ${styles.d4}`} />
      <span className={`${styles.dotPulse} ${styles.d5}`} />
      <span className={`${styles.dotPulse} ${styles.d6}`} />
      <span className={`${styles.dotPulse} ${styles.d7}`} />
      <svg className={styles.connector} viewBox="0 0 960 540" preserveAspectRatio="none">
        <path d="M140 198 C264 212, 364 220, 470 236 C564 250, 660 270, 788 258" />
      </svg>
    </div>
  );
}
