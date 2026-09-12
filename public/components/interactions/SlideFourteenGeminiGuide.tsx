"use client";

import styles from "./SlideFourteenGeminiGuide.module.css";

export default function SlideFourteenGeminiGuide() {
  return (
    <div className={styles.root} aria-hidden="true">
      <span className={`${styles.hotspot} ${styles.signIn}`} />
      <span className={`${styles.hotspot} ${styles.modelCard}`} />
      <span className={`${styles.spark} ${styles.sparkA}`} />
      <span className={`${styles.spark} ${styles.sparkB}`} />
    </div>
  );
}
