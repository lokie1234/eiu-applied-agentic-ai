"use client";

import styles from "./SlideThirteenBasicFlow.module.css";

const chips = ["Gemini", "Sheets", "App Script", "Web App", "Automation", "AI Flow"];

export default function SlideThirteenBasicFlow() {
  const loop = [...chips, ...chips];

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.scanGlow} />

      <div className={`${styles.connector} ${styles.c1}`} />
      <div className={`${styles.connector} ${styles.c2}`} />
      <div className={`${styles.connector} ${styles.c3}`} />
      <span className={`${styles.stepPulse} ${styles.step1}`} />
      <span className={`${styles.stepPulse} ${styles.step2}`} />
      <span className={`${styles.stepPulse} ${styles.step3}`} />

      <svg className={styles.particles} viewBox="0 0 960 540" preserveAspectRatio="none">
        <circle className={styles.spark} cx="474" cy="230" r="4" />
        <circle className={styles.spark} cx="474" cy="326" r="4" />
        <circle className={styles.spark} cx="474" cy="422" r="4" />
      </svg>

      <svg className={styles.network} viewBox="0 0 240 240">
        <g className={styles.orbits}>
          <circle cx="120" cy="120" r="84" />
          <circle cx="120" cy="120" r="56" />
        </g>
        <g className={styles.links}>
          <path d="M120 120 L62 76 L165 58 L192 126 L142 184 L77 165 Z" />
          <path d="M62 76 L142 184" />
          <path d="M165 58 L77 165" />
        </g>
        <g className={styles.nodes}>
          <circle cx="62" cy="76" r="4" />
          <circle cx="165" cy="58" r="4" />
          <circle cx="192" cy="126" r="4" />
          <circle cx="142" cy="184" r="4" />
          <circle cx="77" cy="165" r="4" />
          <circle cx="120" cy="120" r="6" />
        </g>
      </svg>

      <div className={styles.ticker}>
        <div className={styles.track}>
          {loop.map((item, index) => (
            <span key={`${item}-${index}`} className={styles.chip}>
              <i />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
