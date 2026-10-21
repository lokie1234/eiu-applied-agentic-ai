"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
import styles from "./HairlineLoading.module.css";

const subscribeTarget = () => () => {};
const clientTarget = () => document.body;
const serverTarget = () => null;

/** CSS-only rocket launch, shared by the section-loading paths. */
export default function HairlineLoading({ label = "Loading section", compact = false }: { label?: string; compact?: boolean }) {
  const portalTarget = useSyncExternalStore(subscribeTarget, clientTarget, serverTarget);

  const loader = <span className={`${styles.loading} ${compact ? styles.compact : ""}`} role="status" aria-live="polite" aria-label={label}>
    <svg className={styles.artwork} viewBox="0 0 180 180" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="90" cy="81" r="64" stroke="#244e70" strokeDasharray="2 7" />
      <path d="m27 43 2-5 2 5 5 2-5 2-2 5-2-5-5-2Zm121 25 2-4 2 4 4 2-4 2-2 4-2-4-4-2Z" fill="#79e3ff" opacity=".65" />
      <path d="M141 24v8m-4-4h8M36 100v6m-3-3h6" stroke="#e9ca8b" opacity=".7" />
      <g className={styles.speedLines} stroke="#79e3ff"><path d="M59 39v28m62-16v29M48 84v23m84-13v22" /></g>
      <ellipse cx="90" cy="149" rx="53" ry="12" fill="#041c31" />
      <path d="M44 141h92l10 8H34Z" fill="#16466b" stroke="#51c9ef" />
      <path d="M53 151h74m-62 6h50" stroke="#355c7c" strokeWidth="3" />
      <g className={styles.gantry} stroke="#517d99" strokeWidth="2"><path d="M53 137V70h11m-11 15 10 10-10 10 10 10-10 10m0-40h20" /><path d="M53 70h8v15" stroke="#e9ca8b" /></g>
      <g className={styles.smoke} fill="#a8d9e8"><ellipse cx="76" cy="135" rx="14" ry="7" /><ellipse cx="104" cy="136" rx="15" ry="8" /><ellipse cx="60" cy="139" rx="12" ry="6" /><ellipse cx="122" cy="140" rx="13" ry="6" /></g>
      <g className={styles.rocket}>
        <g className={styles.flame}><path d="M82 116q-5 15 8 31 13-16 8-31" fill="#e9a64e" /><path d="M86 117q-2 10 4 21 6-11 4-21" fill="#fff0c5" /></g>
        <path d="M78 91 68 108v13l15-9m19-21 10 17v13l-15-9" fill="#1b86b2" stroke="#79e3ff" strokeWidth="1.5" />
        <path d="M90 48c-14 12-17 31-14 51l6 17h16l6-17c3-20 0-39-14-51Z" fill="#dfedf5" stroke="#79e3ff" strokeWidth="1.5" />
        <path d="M90 48c11 13 13 35 9 52l-5 16h4l6-17c3-20 0-39-14-51Z" fill="#8db8d1" />
        <path d="M79 65q11-5 22 0c-2-6-5-12-11-17-6 5-9 11-11 17Z" fill="#e9ca8b" />
        <circle cx="90" cy="81" r="8" fill="#082945" stroke="#458caf" strokeWidth="2" /><path d="m87 82 3-5 3 5m-4 0h3" stroke="#79e3ff" strokeWidth="1.3" />
        <path d="M80 104h20m-16 12v4h12v-4" stroke="#315f7c" strokeWidth="2" />
        <path d="M81 72v19" stroke="#fff" strokeWidth="2" opacity=".8" />
      </g>
      <g className={styles.launchLights}><circle cx="71" cy="160" r="2.5" /><circle cx="90" cy="160" r="2.5" /><circle cx="109" cy="160" r="2.5" /></g>
    </svg>
    <span className={styles.label}>{label}</span>
    <span className={styles.signal} aria-hidden="true"><i /><i /><i /></span>
  </span>;

  return portalTarget && !compact ? createPortal(loader, portalTarget) : loader;
}
