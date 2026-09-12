"use client";

import styles from "./SlideThirtyFiveCycleFlow.module.css";

export default function SlideThirtyFiveCycleFlow() {
  return (
    <div className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g35" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b39159" stopOpacity=".38" />
            <stop offset="62%" stopColor="#e9ca8b" stopOpacity=".96" />
            <stop offset="100%" stopColor="#f7e7bf" stopOpacity="1" />
          </linearGradient>
        </defs>

        <path className={styles.path} pathLength="100" d="M577.08 180 C634 182, 690 220, 627.48 275.76" />
        <path className={styles.path} pathLength="100" d="M627.48 336.24 C690 366, 638 430, 577.08 432" style={{ animationDelay: ".2s" }} />
        <path className={styles.path} pathLength="100" d="M382.68 432 C320 430, 270 370, 332.28 336.24" style={{ animationDelay: ".4s" }} />
        <path className={styles.path} pathLength="100" d="M332.28 275.76 C270 242, 320 181, 382.68 180" style={{ animationDelay: ".6s" }} />

        <circle className={styles.signal} r="5">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M577.08 180 C634 182, 690 220, 627.48 275.76" />
        </circle>
        <circle className={styles.signal} r="5">
          <animateMotion dur="2.6s" begin=".65s" repeatCount="indefinite" path="M627.48 336.24 C690 366, 638 430, 577.08 432" />
        </circle>
        <circle className={styles.signal} r="5">
          <animateMotion dur="2.6s" begin="1.3s" repeatCount="indefinite" path="M382.68 432 C320 430, 270 370, 332.28 336.24" />
        </circle>
        <circle className={styles.signal} r="5">
          <animateMotion dur="2.6s" begin="1.95s" repeatCount="indefinite" path="M332.28 275.76 C270 242, 320 181, 382.68 180" />
        </circle>

        <g className={styles.heads}>
          <path d="M627.48 275.76 L635.2 258.1 L645.8 270.1 Z" />
          <path d="M577.08 432 L596 421 L596 442 Z" />
          <path d="M332.28 336.24 L315 337 L323 351 Z" />
          <path d="M382.68 180 L364.68 170 L364.68 190 Z" />
        </g>
      </svg>
    </div>
  );
}
