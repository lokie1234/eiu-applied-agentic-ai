"use client";

import { useEffect, useId, useRef } from "react";
import { registerLearningIcon } from "./learningIconRegistry";
import styles from "./LearningInnovationIcon.module.css";

type Props = { kind: "folder" | "course" | "section" | "spark"; className?: string; active?: boolean; compact?: boolean; electric?: boolean };

function IdeaBulb({ className, fill }: { className?: string; fill: string }) {
  return <g className={className}>
    <path d="M45 48c-12-10-7-29 8-30 17-1 23 18 11 29-3 3-4 6-4 10H49c0-4-1-7-4-9Z" fill={fill} stroke="#fff0c9" />
    <path d="m48 35 7 6 7-7m-7 7v14m-6 7h11m-9 5h7" stroke="#9d7944" strokeWidth="2" />
    <path d="M45 29q3-6 9-6" stroke="#fffefa" strokeWidth="2.5" />
    <circle cx="48" cy="35" r="2" fill="#123f68" /><circle cx="62" cy="34" r="2" fill="#123f68" />
  </g>;
}

/** Shared materials and distinct silhouettes; cursor tilt is delegated by the portal. */
export default function LearningInnovationIcon({ kind, className = "", active = false, compact = false, electric = false }: Props) {
  const id = useId().replace(/:/g, "");
  const iconRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (compact || kind === "spark" || !iconRef.current) return;
    return registerLearningIcon({ element: iconRef.current, kind, active, electric });
  }, [kind, compact, active, electric]);
  const blue = `${id}-blue`, gold = `${id}-gold`, glass = `${id}-glass`;
  return <span ref={iconRef} className={`${styles.icon} ${className}`} data-kind={kind} data-active={active || undefined} aria-hidden="true">
    {compact ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {kind === "folder" ? <>
        <path d="M8 13a5.5 5.5 0 1 1 8 0c-1.3 1.2-1.5 2.2-1.5 3.5h-5C9.5 15.2 9.3 14.2 8 13Zm2 6h4m-3 2h2m-1-5v-5m-2-2 2 2 2-2" />
        <path className={styles.compactRays} d="M12 1V0M4 5 2.5 3.5M2 11H0m20-6 1.5-1.5M22 11h2" stroke="#e9ca8b" />
      </> : kind === "course" ? <>
        <g className={styles.compactRocket}>
          <path d="M9 15C8 9 13 3 21 2c0 8-5 13-11 13Zm0-5-5 2-1 5 6-2m5-1-2 6-5 1 3-6" />
          <circle cx="16" cy="7" r="2" />
          <path className={styles.compactFlame} d="m7 17-4 4m1-5-2 3m6 0-3 3" stroke="#e9ca8b" />
        </g>
      </> : <>
        <circle cx="12" cy="12" r="5" />
        <ellipse cx="12" cy="12" rx="11" ry="3.5" transform="rotate(-30 12 12)" />
        <path className={styles.compactRays} d="M19 2v4m-2-2h4M3 18v3m-1.5-1.5h3" stroke="#e9ca8b" />
        <circle cx="20" cy="18" r="1" fill="currentColor" stroke="none" />
      </>}
    </svg> : <svg className={styles.scene} viewBox="0 0 110 108" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <defs>
        <linearGradient id={blue} x1="25" y1="18" x2="80" y2="90" gradientUnits="userSpaceOnUse"><stop stopColor="#88d5ef" /><stop offset=".35" stopColor="#397fa8" /><stop offset="1" stopColor="#0b2e4b" /></linearGradient>
        <linearGradient id={gold} x1="38" y1="22" x2="68" y2="65" gradientUnits="userSpaceOnUse"><stop stopColor="#fff7dc" /><stop offset=".45" stopColor="#f4d89a" /><stop offset="1" stopColor="#b39159" /></linearGradient>
        <linearGradient id={glass} x1="30" y1="35" x2="70" y2="87" gradientUnits="userSpaceOnUse"><stop stopColor="#b8f1ff" stopOpacity=".7" /><stop offset=".45" stopColor="#18547f" stopOpacity=".9" /><stop offset="1" stopColor="#082945" /></linearGradient>
      </defs>
      <ellipse className={styles.shadow} cx="55" cy="97" rx="34" ry="4" />
      {(kind === "folder" || kind === "spark") && <ellipse className={styles.halo} cx="55" cy="57" rx="43" ry="38" />}
      <g className={styles.object}>
        {kind === "folder" ? <>
          <path fill="#082945" stroke="#355d7a" d="M19 30h24l10 10h37a6 6 0 0 1 6 6v39a7 7 0 0 1-7 7H26a7 7 0 0 1-7-7Z" />
          <path fill={`url(#${blue})`} stroke="#9bd5e8" d="M14 27a6 6 0 0 1 6-6h21l10 11h36a6 6 0 0 1 6 6v44H14Z" />
          <path d="M20 25h18l10 11h38" stroke="#d7f4ff" strokeOpacity=".7" />
          <g className={styles.ideaCards}>
            <g className={styles.extraCardLeft}><rect x="35" y="28" width="25" height="37" rx="4" fill="#18547f" stroke="#79e3ff" /><path d="m42 39-3 3 3 3m8-6 3 3-3 3m-3-8-2 10" stroke="#e9ca8b" /></g>
            <g className={styles.extraCardRight}><rect x="48" y="27" width="25" height="37" rx="4" fill="#f7f4ed" stroke="#b6d2df" /><path d="M54 52V42m6 10V37m6 15V33" stroke="#2d7fb4" strokeWidth="3" /></g>
            <g className={styles.leftCard}><rect x="25" y="35" width="30" height="36" rx="5" fill="#f7f4ed" stroke="#b6d2df" /><path d="m32 46 8-4 8 4-8 4Zm8 4v11" stroke="#2d7fb4" /><circle cx="40" cy="61" r="2" fill="#b39159" /></g>
            <g className={styles.rightCard}><rect x="59" y="34" width="26" height="37" rx="5" fill="#123f68" stroke="#79e3ff" /><path d="m65 47 6-5 7 5-7 6Zm6 6v9" stroke="#e9ca8b" /></g>
          </g>
          <g className={styles.idea}><g transform="translate(12 5) scale(.78)"><IdeaBulb fill={`url(#${gold})`} /></g></g>
          <g className={styles.folderLid}>
            <path fill="#041c31" d="M15 52h80l-5 33a8 8 0 0 1-8 7H26a8 8 0 0 1-8-7Z" />
            <path fill={`url(#${glass})`} stroke="#8ecde4" d="M18 49h76a4 4 0 0 1 4 5l-7 29a7 7 0 0 1-7 5H25a7 7 0 0 1-7-6l-4-28a4 4 0 0 1 4-5Z" />
            <path d="M21 53h69M25 84h56" stroke="#b7e7f7" strokeOpacity=".55" />
            <path d="m44 69 11-6 11 6-11 6Zm11 6v6m-11-12-6 3m28-3 6 3" stroke="#e9ca8b" strokeWidth="2" />
            <circle className={styles.status} cx="76" cy="73" r="2" fill="#79e3ff" />
          </g>
        </> : kind === "course" || kind === "section" ? <>
          <g className={styles.continueBody}>
            <rect x="17" y="39" width="76" height="43" rx="21.5" fill="#041c31" stroke="#123f68" />
            <rect x="17" y="33" width="76" height="43" rx="21.5" fill={`url(#${blue})`} stroke="#9bd5e8" />
            <path d="M35 37h39" stroke="#fffefa" strokeOpacity=".45" />
            <g stroke="#f4dfb0" strokeWidth="3.2">
              <path className={styles.continueArrow} d="m47 44 18 11-18 11Z" fill={`url(#${gold})`} strokeWidth="1.5" />
            </g>
            {electric && <g className={styles.chipElectric}><path className={styles.arc} d="M29 72h48l7-5" pathLength="100" /></g>}
          </g>
        </> : <>
          <circle cx="57" cy="58" r="29" fill="#082945" stroke="#397fa8" />
          <circle cx="53" cy="52" r="29" fill={`url(#${blue})`} stroke="#9bd5e8" />
          <g className={styles.idea}><g transform="translate(13 8) scale(.75)"><IdeaBulb fill={`url(#${gold})`} /></g></g>
          <ellipse className={styles.circuit} cx="55" cy="55" rx="44" ry="16" transform="rotate(-28 55 55)" stroke="#79e3ff" />
          <circle cx="92" cy="35" r="3" fill="#e9ca8b" />
        </>}
      </g>
      {(kind === "folder" || kind === "spark") && <g className={styles.glints} stroke="#e9ca8b"><path d="M91 14v8m-4-4h8M16 70v6m-3-3h6" /></g>}
    </svg>}
  </span>;
}
