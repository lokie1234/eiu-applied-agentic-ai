"use client";

import styles from "./SlideTwentyTwoPromptFlow.module.css";

export default function SlideTwentyTwoPromptFlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.scanGlow} />
      <div className={`${styles.connector} ${styles.c1}`} />
      <div className={`${styles.connector} ${styles.c2}`} />
      <div className={`${styles.connector} ${styles.c3}`} />
      <span className={`${styles.ring} ${styles.r1}`} />
      <span className={`${styles.ring} ${styles.r2}`} />
      <span className={`${styles.ring} ${styles.r3}`} />
      <svg className={styles.particles} viewBox="0 0 960 540">
        <circle className={styles.dot} cx="458" cy="234" r="4" />
        <circle className={styles.dot} cx="458" cy="342" r="4" />
        <circle className={styles.dot} cx="458" cy="451" r="4" />
      </svg>
    </div>
  );
}
