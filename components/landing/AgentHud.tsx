"use client";

import styles from "./AgentHud.module.css";

interface AgentHudProps {
  stage: number;
}

export default function AgentHud({ stage }: AgentHudProps) {
  const isInputActive = stage >= 5;
  const isProcessActive = stage >= 6;
  const isOutputActive = stage >= 7;

  return (
    <div className={styles.hudOverlay} aria-hidden="true">
      {/* ── Connecting Spatial Data Paths (SVG Light Traces) ── */}
      <svg className={styles.hudConnector} viewBox="0 0 800 600" preserveAspectRatio="none">
        <defs>
          <linearGradient id="traceGradInput" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2D7FB4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#E9CA8B" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="traceGradProcess" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#B39159" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2D7FB4" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="traceGradOutput" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2D7FB4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#69C5A3" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Trace 1: INPUT -> Robot Center */}
        <path
          d="M 195 240 C 290 240, 340 300, 400 310"
          className={`${styles.traceLine} ${isInputActive ? styles.traceActive : ""}`}
          stroke="url(#traceGradInput)"
        />

        {/* Trace 2: Robot Center -> PROCESS */}
        <path
          d="M 410 290 C 470 280, 520 180, 610 170"
          className={`${styles.traceLine} ${isProcessActive ? styles.traceActive : ""}`}
          stroke="url(#traceGradProcess)"
        />

        {/* Trace 3: Robot Center -> OUTPUT */}
        <path
          d="M 415 320 C 480 340, 530 430, 610 440"
          className={`${styles.traceLine} ${isOutputActive ? styles.traceActive : ""}`}
          stroke="url(#traceGradOutput)"
        />
      </svg>

      {/* ── CARD 1: INPUT (Intent detected) ── */}
      <div
        className={`${styles.hudCard} ${styles.cardInput} ${
          isInputActive ? styles.cardActive : ""
        }`}
      >
        <span className={styles.cornerBracketTL} />
        <span className={styles.cornerBracketBR} />
        <div className={styles.cardHeader}>
          <span className={styles.statusDot} />
          <span className={styles.label}>INPUT</span>
        </div>
        <strong className={styles.value}>Intent detected</strong>
        <span className={styles.subMeta}>Natural language query mapped</span>
      </div>

      {/* ── CARD 2: PROCESS (Workflow running) ── */}
      <div
        className={`${styles.hudCard} ${styles.cardProcess} ${
          isProcessActive ? styles.cardActive : ""
        }`}
      >
        <span className={styles.cornerBracketTL} />
        <span className={styles.cornerBracketBR} />
        <div className={styles.cardHeader}>
          <span className={styles.statusDotProcess} />
          <span className={styles.label}>PROCESS</span>
        </div>
        <strong className={styles.value}>Workflow running</strong>
        <span className={styles.subMeta}>Autonomous agent execution</span>
      </div>

      {/* ── CARD 3: OUTPUT (Action complete) ── */}
      <div
        className={`${styles.hudCard} ${styles.cardOutput} ${
          isOutputActive ? styles.cardActive : ""
        }`}
      >
        <span className={styles.cornerBracketTL} />
        <span className={styles.cornerBracketBR} />
        <div className={styles.cardHeader}>
          <span className={styles.statusDotOutput} />
          <span className={styles.label}>OUTPUT</span>
        </div>
        <strong className={styles.value}>Action complete</strong>
        <span className={styles.subMeta}>Synthesized lesson intelligence</span>
      </div>
    </div>
  );
}
