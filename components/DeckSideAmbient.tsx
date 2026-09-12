"use client";

import { useState, type CSSProperties } from "react";
import styles from "./DeckSideAmbient.module.css";

type Props = {
  slideWidth: number;
};

const ROBOT_SPOTS = [
  { side: "left", top: "70%" },
  { side: "right", top: "18%" },
  { side: "left", top: "24%" },
  { side: "right", top: "72%" },
  { side: "left", top: "48%" },
  { side: "right", top: "45%" },
] as const;

function Circuit({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg className={styles.circuit} viewBox="0 0 120 720" preserveAspectRatio="none" aria-hidden="true">
      <g transform={mirrored ? "translate(120 0) scale(-1 1)" : undefined}>
        <path className={styles.circuitLine} d="M8 82 H54 V154 H102" />
        <path className={styles.circuitLineSlow} d="M22 300 H84 V372 H112" />
        <path className={styles.circuitLine} d="M4 572 H46 V642 H96" />
        <circle className={styles.circuitNode} cx="54" cy="154" r="4" />
        <circle className={styles.circuitNodeDelay} cx="84" cy="372" r="5" />
        <circle className={styles.circuitNode} cx="46" cy="642" r="3" />
        <circle className={styles.orbit} cx="58" cy="236" r="28" />
        <circle className={styles.orbitDot} cx="58" cy="208" r="4" />
      </g>
    </svg>
  );
}

export default function DeckSideAmbient({ slideWidth }: Props) {
  const [spotIndex, setSpotIndex] = useState(0);
  const spot = ROBOT_SPOTS[spotIndex];
  const rootStyle = { "--slide-width": `${slideWidth}px` } as CSSProperties;

  return (
    <div className={styles.root} style={rootStyle}>
      <div className={`${styles.gutter} ${styles.left}`}>
        <Circuit />
        <span className={`${styles.dataParticle} ${styles.particleA}`} />
        <span className={`${styles.dataParticle} ${styles.particleB}`} />
      </div>

      <div className={`${styles.gutter} ${styles.right}`}>
        <Circuit mirrored />
        <span className={`${styles.dataParticle} ${styles.particleC}`} />
        <span className={`${styles.dataParticle} ${styles.particleD}`} />
      </div>

      <button
        type="button"
        className={`${styles.robotButton} ${spot.side === "right" ? styles.robotRight : styles.robotLeft}`}
        style={{ top: spot.top }}
        onClick={() => setSpotIndex((current) => (current + 1) % ROBOT_SPOTS.length)}
        aria-label="Click me — robot sẽ chạy sang vị trí khác"
        data-interactive="true"
      >
        <span className={styles.robotLabel}>Click me</span>
        <span className={styles.robotFace}>🤖</span>
      </button>
    </div>
  );
}
