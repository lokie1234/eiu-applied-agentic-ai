"use client";

import styles from "./LearningGardenAction.module.css";

type Props = { kind: "grow" | "course" | "harvest"; className?: string; active?: boolean };

// Fixed, irregular placement keeps overlapping foliage stable across renders.
const courseLeaves = [
  [8, 30, -28, .95, 0], [67, 29, 36, .88, 2], [126, 31, -42, .9, 0],
  [184, 29, 19, 1, 2], [247, 30, -35, .92, 0], [307, 29, 44, .86, 2],
  [37, 31, 15, 1, 2], [96, 29, -18, .9, 0], [157, 30, 38, .95, 2],
  [216, 31, -26, .88, 0], [278, 29, 17, 1, 2], [337, 30, -43, .92, 0],
  [20, 28, 34, 1.05, 1], [81, 29, -32, 1, 0], [145, 28, 24, .96, 1],
  [203, 29, -46, 1, 0], [265, 28, 38, 1.04, 1], [326, 29, -16, .98, 0],
  [49, 28, -40, .92, 0], [112, 29, 46, 1, 1], [174, 28, -21, .95, 0],
  [232, 29, 29, 1.02, 1], [294, 28, -38, .93, 0], [354, 29, 22, 1, 1],
];

function FolderPlot({ className }: { className: string }) {
  return <span className={[styles.icon, styles.grow, className].join(" ")} aria-hidden="true">
    <svg viewBox="0 0 110 108" fill="none" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <ellipse className={styles.plotHalo} cx="55" cy="55" rx="38" ry="36" />
      <ellipse className={styles.shadow} cx="55" cy="96" rx="42" ry="4" />
      <path className={styles.soilBed} d="M14 78q40-17 82 0l-5 14q-36 10-72 0Z" />
      <ellipse className={styles.soilSurface} cx="55" cy="78" rx="41" ry="11" />
      <path className={styles.soilContour} d="M23 86q31 10 64 0" />
      <path className={styles.soilGrains} d="m24 76 4-1m49 1 5 1m-54 7 3 1m40 0 3-1m-32 6 3 1m20-1 3-1" />
      <ellipse className={styles.seedPocket} cx="55" cy="77" rx="12" ry="4" />
      <g className={styles.plotRoots}>
        <path d="M55 77v15m0-9-10 5m10-1 10 4m-17-5-4-4m17 7 5-6" />
      </g>
      <g className={styles.seedLeft}><path d="M55 78c-15-5-13-20 0-23Z" /><path className={styles.seedHighlight} d="M49 63q-5 4-2 9" /></g>
      <g className={styles.seedRight}><path d="M55 55c13 3 15 18 0 23Z" /></g>
      <g className={styles.growingPlant}>
        <g className={styles.plotFoliage}>
          <path className={styles.plotStem} d="M55 78q-3-22 1-47" />
          <g className={styles.lowerLeaves}>
            <path className={styles.leaf} d="M54 65C36 67 26 55 28 43c17-2 29 8 26 22Z" />
            <path className={styles.lightLeaf} d="M54 59c-1-17 12-26 27-22 0 14-12 24-27 22Z" />
            <path className={styles.vein} d="m54 65-16-13m16 7 18-14" />
          </g>
          <g className={styles.upperLeaves}>
            <path className={styles.leaf} d="M55 43c-14 1-24-8-23-20 14-2 26 8 23 20Z" />
            <path className={styles.lightLeaf} d="M56 35c-1-16 8-25 20-25 3 13-6 26-20 25Z" />
            <path className={styles.vein} d="M55 43 40 31m16 4 12-16" />
          </g>
        </g>
      </g>
      <g className={styles.growthGlints}>
        <path d="M22 31v8m-4-4h8m61-10v6m-3-3h6m-5 29v6m-3-3h6" />
      </g>
    </svg>
  </span>;
}

function OrchardTree() {
  return <>
    <path className={styles.trunk} d="M52 88V44h6v44m-3-25L40 49m15 9 17-16" />
    <path className={styles.canopy} d="M34 62C18 61 15 42 27 35c-2-14 13-23 24-17 10-13 29-6 29 9 18 3 21 24 7 32-8 7-22 5-30 3-9 4-17 4-23 0Z" />
    <path className={styles.vein} d="M55 62V34m0 19L40 39m15 6 15-10" />
  </>;
}

function OrchardFruit({ className = "" }: { className?: string }) {
  return <g className={[styles.fallingFruit, className].join(" ")}>
    <path className={styles.fruitStem} d="M0-5 2-9" />
    <path className={styles.fruitLeaf} d="M2-7c0-4 4-5 7-4-1 4-4 5-7 4Z" />
    <path className={styles.apple} d="M0-4c-9-5-11 5-6 10 2 3 4 1 6 1s4 2 6-1c5-5 3-15-6-10Z" />
    <path className={styles.fruitShine} d="M-4-1q-2 2-1 4" />
  </g>;
}

export default function LearningGardenAction({ kind, className = "", active = false }: Props) {
  if (kind === "grow") return <FolderPlot className={className} />;
  return <span className={[styles.icon, styles[kind], className].join(" ")} data-active={active || undefined} aria-hidden="true">
    <svg viewBox="0 0 110 108" fill="none" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {kind === "harvest" && <ellipse className={styles.shadow} cx="55" cy="91" rx="43" ry="4" />}
      {kind === "course" ? <>
        <g className={styles.leafRing}>
          {courseLeaves.map(([angle, radius, tilt, scale, shade], index) => <g key={index}
            transform={"rotate(" + angle + " 55 54) translate(55 " + (54 - (radius * .35 + 13)) + ") rotate(" + tilt * .65 + ") scale(" + scale * .58 + ")"}>
            <path className={shade === 1 ? styles.ringLeafLight : shade === 2 ? styles.ringLeafDark : styles.ringLeaf}
              d="M0 0C-10-2-17-11-12-20 0-20 9-8 0 0Z" />
            <path className={styles.ringVein} d="M0 0-8-13m5 8-6-2m5-2 3-4" />
          </g>)}
        </g>
        <text className={styles.goText} x="55" y="55" textAnchor="middle" dominantBaseline="middle">Go</text>
      </> : <>
        <g transform="translate(-9 24) scale(.72)"><OrchardTree /></g>
        <g transform="translate(44 19) scale(.78)"><OrchardTree /></g>
        <g className={styles.orchardCenter}><OrchardTree /></g>
        <g transform="translate(28 56)"><OrchardFruit className={styles.fruitLeft} /></g>
        <g transform="translate(85 52)"><OrchardFruit className={styles.fruitRight} /></g>
        <g transform="translate(61 47)"><OrchardFruit /></g>
        <text className={styles.clickText} x="55" y="106" textAnchor="middle">Click</text>
      </>}
    </svg>
  </span>;
}
