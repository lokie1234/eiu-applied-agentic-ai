"use client";

import styles from "./SlideNineteenBusinessFirst.module.css";

const chips = ["Business Requirement", "Workflow", "Approval", "User Need", "AI Brief", "System Goal"];

export default function SlideNineteenBusinessFirst() {
  const loop = [...chips, ...chips];
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.leftGlow} />
      <div className={styles.centerGlow} />
      <svg className={styles.network} viewBox="0 0 340 340">
        <g className={styles.rings}><circle cx="170" cy="170" r="120"/><circle cx="170" cy="170" r="84"/></g>
        <g className={styles.links}><path d="M170 170 L112 108 L226 96 L262 174 L212 252 L128 236 Z"/><path d="M112 108 L212 252"/><path d="M226 96 L128 236"/></g>
        <g className={styles.nodes}><circle cx="112" cy="108" r="5"/><circle cx="226" cy="96" r="5"/><circle cx="262" cy="174" r="5"/><circle cx="212" cy="252" r="5"/><circle cx="128" cy="236" r="5"/><circle cx="170" cy="170" r="7"/></g>
      </svg>
      <div className={styles.ticker}><div className={styles.track}>{loop.map((c,i)=><span key={`${c}-${i}`} className={styles.chip}><i/>{c}</span>)}</div></div>
    </div>
  );
}
