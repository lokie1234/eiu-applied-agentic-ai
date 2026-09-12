"use client";

import styles from "./SlideTwentyThreePromptChecklist.module.css";

export default function SlideTwentyThreePromptChecklist() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.glow} />
      <span className={`${styles.pulse} ${styles.p1}`} />
      <span className={`${styles.pulse} ${styles.p2}`} />
      <span className={`${styles.pulse} ${styles.p3}`} />
      <span className={`${styles.pulse} ${styles.p4}`} />
      <span className={`${styles.pulse} ${styles.p5}`} />
      <span className={`${styles.pulse} ${styles.p6}`} />
      <svg className={styles.wave} viewBox="0 0 960 540" preserveAspectRatio="none"><path d="M118 360 C254 336, 338 356, 470 362 C598 368, 699 346, 840 316" /></svg>
    </div>
  );
}
