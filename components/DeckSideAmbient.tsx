"use client";

import { type CSSProperties } from "react";
import styles from "./DeckSideAmbient.module.css";

type Props = {
  slideWidth: number;
};

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

    </div>
  );
}
