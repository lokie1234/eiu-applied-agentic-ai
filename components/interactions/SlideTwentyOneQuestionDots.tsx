"use client";

import styles from "./SlideTwentyOneQuestionDots.module.css";

const BOXES = [
  { left: 4.8, top: 25.6, width: 42.6, height: 18.8 },
  { left: 51.2, top: 25.6, width: 42.6, height: 18.8 },
  { left: 4.8, top: 50.7, width: 42.6, height: 18.8 },
  { left: 51.2, top: 50.7, width: 42.6, height: 18.8 },
];

export default function SlideTwentyOneQuestionDots() {
  return (
    <div className={styles.root} aria-hidden="true">
      {BOXES.map((box, index) => (
        <div
          key={index}
          className={styles.box}
          style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
        >
          <span className={`${styles.q} ${styles.q1}`} style={{ animationDelay: `${index * 0.24}s` }}>?</span>
          <span className={`${styles.q} ${styles.q2}`} style={{ animationDelay: `${0.45 + index * 0.24}s` }}>?</span>
          <span className={`${styles.q} ${styles.q3}`} style={{ animationDelay: `${0.9 + index * 0.24}s` }}>?</span>
        </div>
      ))}
    </div>
  );
}
