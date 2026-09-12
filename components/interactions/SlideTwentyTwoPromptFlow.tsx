"use client";

import styles from "./SlideTwentyTwoPromptFlow.module.css";

const chips = ["YÊU CẦU", "PROMPT", "GEMINI", "WEB APP", "CLARITY", "OUTPUT"];

export default function SlideTwentyTwoPromptFlow() {
  const loop = [...chips, ...chips];

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.scanGlow} />
      <div className={styles.focusGlow} />

      <svg className={styles.network} viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet">
        <g className={styles.orbits}>
          <circle cx="120" cy="120" r="86" />
          <circle cx="120" cy="120" r="58" />
        </g>
        <g className={styles.links}>
          <path d="M120 120 L58 74 L164 56 L194 126 L143 186 L79 170 Z" />
          <path d="M58 74 L143 186" />
          <path d="M164 56 L79 170" />
        </g>
        <g className={styles.nodes}>
          <circle cx="58" cy="74" r="4" />
          <circle cx="164" cy="56" r="4" />
          <circle cx="194" cy="126" r="4" />
          <circle cx="143" cy="186" r="4" />
          <circle cx="79" cy="170" r="4" />
          <circle cx="120" cy="120" r="6" />
        </g>
      </svg>

      <svg className={styles.sparkWave} viewBox="0 0 280 90" preserveAspectRatio="none">
        <path className={styles.sparkTrail} d="M8 60 C40 54, 56 74, 84 50 S132 26, 160 46 S212 69, 236 41 S258 22, 272 10" />
        <path className={styles.sparkMain} d="M8 60 C40 54, 56 74, 84 50 S132 26, 160 46 S212 69, 236 41 S258 22, 272 10" />
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
