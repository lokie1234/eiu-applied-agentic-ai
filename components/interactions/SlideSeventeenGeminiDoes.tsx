"use client";

import styles from "./SlideSeventeenGeminiDoes.module.css";

const chips = ["UI Design", "Business Logic", "Deployment", "Gemini", "Web App", "Automation"];

export default function SlideSeventeenGeminiDoes() {
  const loop = [...chips, ...chips];
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.glowBand} />
      <span className={`${styles.marker} ${styles.m1}`} />
      <span className={`${styles.marker} ${styles.m2}`} />
      <span className={`${styles.marker} ${styles.m3}`} />
      <svg className={styles.ribbon} viewBox="0 0 960 540" preserveAspectRatio="none">
        <path d="M136 332 C234 348, 372 360, 480 362 C607 364, 706 348, 844 316" />
      </svg>
      <div className={styles.ticker}><div className={styles.track}>{loop.map((i,n)=><span key={`${i}-${n}`} className={styles.chip}><b/>{i}</span>)}</div></div>
    </div>
  );
}
