"use client";

import styles from "./AgentHud.module.css";

interface AgentHudProps {
  showCards: boolean;
}

export default function AgentHud({ showCards }: AgentHudProps) {
  if (!showCards) return null;

  return (
    <div className={styles.hudOverlay} aria-hidden="true">
      {/* INPUT card — left */}
      <div className={`${styles.hudCard} ${styles.cardInput}`}>
        <i className={styles.dot} />
        <span className={styles.label}>INPUT</span>
        <strong className={styles.value}>Intent detected</strong>
      </div>

      {/* PROCESS card — right top */}
      <div className={`${styles.hudCard} ${styles.cardProcess}`}>
        <i className={styles.dot} />
        <span className={styles.label}>PROCESS</span>
        <strong className={styles.value}>Workflow running</strong>
      </div>

      {/* OUTPUT card — right bottom */}
      <div className={`${styles.hudCard} ${styles.cardOutput}`}>
        <i className={styles.dot} />
        <span className={styles.label}>OUTPUT</span>
        <strong className={styles.value}>Action complete</strong>
      </div>
    </div>
  );
}
