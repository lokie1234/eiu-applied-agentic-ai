"use client";

import styles from "./SlideSixteenLabHero.module.css";

const tickerItems = [
  "Workflow",
  "Approvals",
  "Google Script",
  "No Server",
  "Business App",
  "Automation",
  "Drive",
  "Forms",
];

export default function SlideSixteenLabHero() {
  const loopItems = [...tickerItems, ...tickerItems];

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.vignette} />

      {/* Safe-zone visual: top-right only, away from Lab 1 and headline text. */}
      <svg
        className={styles.growthArrow}
        viewBox="0 0 440 170"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="slide16GrowthGradient"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#2d7fb4" stopOpacity="0.12" />
            <stop offset="45%" stopColor="#e9ca8b" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#f4dfb0" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <path
          className={styles.growthPath}
          d="M18 142 L92 126 L148 135 L224 94 L286 104 L352 58 L418 20"
        />

        <circle className={styles.growthSignal} r="4.6">
          <animateMotion
            dur="3.5s"
            repeatCount="indefinite"
            path="M18 142 L92 126 L148 135 L224 94 L286 104 L352 58 L418 20"
          />
        </circle>

        <g className={styles.growthNodes}>
          <circle cx="92" cy="126" r="3.6" />
          <circle cx="148" cy="135" r="3.6" />
          <circle cx="224" cy="94" r="3.6" />
          <circle cx="286" cy="104" r="3.6" />
          <circle cx="352" cy="58" r="3.6" />
        </g>

        <g className={styles.growthHead} transform="translate(418 20) rotate(-35)">
          <path d="M0 0 L-18 -9 L-13 0 L-18 9 Z" />
        </g>
      </svg>

      {/* Compact AI network starts after the headline's real right edge (~79.2% of slide). */}
      <svg
        className={styles.orchestrator}
        viewBox="0 0 420 420"
        preserveAspectRatio="xMidYMid meet"
      >
        <g className={styles.orbitShells}>
          <circle cx="210" cy="210" r="150" />
          <circle cx="210" cy="210" r="108" />
          <circle cx="210" cy="210" r="70" />
        </g>

        <g className={styles.web}>
          <path d="M210 210 L136 126 L278 116 L340 208 L276 308 L142 294 Z" />
          <path d="M136 126 L276 308" />
          <path d="M278 116 L142 294" />
          <path d="M210 210 L340 208" />
          <path d="M210 210 L278 116" />
        </g>

        <g className={styles.nodes}>
          <g transform="translate(136 126)">
            <circle className={styles.nodeHalo} r="16" />
            <circle className={styles.nodeDot} r="5" />
          </g>
          <g transform="translate(278 116)">
            <circle className={styles.nodeHalo} r="16" />
            <circle className={styles.nodeDot} r="5" />
          </g>
          <g transform="translate(340 208)">
            <circle className={styles.nodeHalo} r="16" />
            <circle className={styles.nodeDot} r="5" />
          </g>
          <g transform="translate(276 308)">
            <circle className={styles.nodeHalo} r="16" />
            <circle className={styles.nodeDot} r="5" />
          </g>
          <g transform="translate(142 294)">
            <circle className={styles.nodeHalo} r="16" />
            <circle className={styles.nodeDot} r="5" />
          </g>
        </g>

        <g className={styles.pulses}>
          <circle className={styles.pulse} r="4">
            <animateMotion dur="2.9s" repeatCount="indefinite" path="M210 210 L136 126" />
          </circle>
          <circle className={styles.pulse} r="4">
            <animateMotion dur="3.3s" repeatCount="indefinite" path="M136 126 L278 116" />
          </circle>
          <circle className={styles.pulse} r="4">
            <animateMotion dur="2.7s" repeatCount="indefinite" path="M278 116 L340 208" />
          </circle>
        </g>

        <g className={styles.core}>
          <circle className={styles.coreWaveA} cx="210" cy="210" r="48" />
          <circle className={styles.coreWaveB} cx="210" cy="210" r="34" />
          <circle className={styles.coreMain} cx="210" cy="210" r="25" />
          <circle className={styles.coreDot} cx="210" cy="210" r="8" />
        </g>
      </svg>

      {/* Subtle pulse aligned to the existing four gold bullet squares only. */}
      <span className={`${styles.bulletPulse} ${styles.bulletOne}`} />
      <span className={`${styles.bulletPulse} ${styles.bulletTwo}`} />
      <span className={`${styles.bulletPulse} ${styles.bulletThree}`} />
      <span className={`${styles.bulletPulse} ${styles.bulletFour}`} />

      {/* Bottom safe zone: continuous AI/business concepts, below all bullet text. */}
      <div className={styles.ticker}>
        <div className={styles.tickerTrack}>
          {loopItems.map((item, index) => (
            <span className={styles.tickerChip} key={`${item}-${index}`}>
              <i />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
