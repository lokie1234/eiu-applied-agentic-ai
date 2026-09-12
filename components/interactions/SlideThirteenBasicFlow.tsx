"use client";

import styles from "./SlideThirteenBasicFlow.module.css";

const chips = ["AI FLOW", "GEMINI", "SHEETS", "APP SCRIPT", "WEB APP", "AUTOMATION"];

export default function SlideThirteenBasicFlow() {
  const loop = [...chips, ...chips];

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.scanGlow} />
      <div className={styles.bandGlow} />

      <svg className={styles.network} viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet">
        <g className={styles.orbits}>
          <circle cx="120" cy="120" r="86" />
          <circle cx="120" cy="120" r="58" />
        </g>
        <g className={styles.links}>
          <path d="M120 120 L56 74 L166 55 L197 126 L144 188 L76 173 Z" />
          <path d="M56 74 L144 188" />
          <path d="M166 55 L76 173" />
        </g>
        <g className={styles.nodes}>
          <circle cx="56" cy="74" r="4" />
          <circle cx="166" cy="55" r="4" />
          <circle cx="197" cy="126" r="4" />
          <circle cx="144" cy="188" r="4" />
          <circle cx="76" cy="173" r="4" />
          <circle cx="120" cy="120" r="6" />
        </g>
      </svg>

      <svg className={styles.growth} viewBox="0 0 260 110" preserveAspectRatio="none">
        <path className={styles.growthTrail} d="M10 86 L56 66 L92 74 L138 46 L174 56 L220 23 L250 10" />
        <path className={styles.growthMain} d="M10 86 L56 66 L92 74 L138 46 L174 56 L220 23 L250 10" />
        <g className={styles.growthNodes}>
          <circle cx="56" cy="66" r="3.6" />
          <circle cx="92" cy="74" r="3.6" />
          <circle cx="138" cy="46" r="3.6" />
          <circle cx="174" cy="56" r="3.6" />
          <circle cx="220" cy="23" r="3.6" />
        </g>
        <circle className={styles.signal} r="4.2">
          <animateMotion dur="3.2s" repeatCount="indefinite" path="M10 86 L56 66 L92 74 L138 46 L174 56 L220 23 L250 10" />
        </circle>
        <path className={styles.arrowHead} d="M250 10 l-14 -6 l4 6 l-4 6 z" />
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
