"use client";

import styles from "./LearningGardenAction.module.css";

type Props = { kind: "grow" | "course" | "harvest"; className?: string; active?: boolean };

function CourseTree() {
  return <>
    <ellipse className={styles.shadow} cx="53" cy="95" rx="43" ry="3" />
    <path className={styles.soilSurface} d="M13 86c2-5 12-5 20-8 11-3 18-1 28-2 12-1 17 4 26 5 8 1 13 5 9 9-4 4-16 3-23 5-10 2-18 0-28 1-12 1-17-3-25-4-6-1-10-3-7-6Z" />
    <path className={styles.soilGrains} d="m23 86 4-1m48 1 4 1m-45 4 3 1m28 0 3-1" />
    <g className={styles.courseSapling}>
      <path className={styles.plotStem} d="M52 85V56" />
      <path className={styles.leaf} d="M52 72c-14 1-22-9-20-19 13-1 22 7 20 19Z" />
      <path className={styles.lightLeaf} d="M52 64c-1-13 9-21 22-19 0 12-9 21-22 19Z" />
      <path className={styles.vein} d="m52 72-12-11m12 3 14-12" />
    </g>
    <g className={styles.coursePlant}>
      <path className={styles.courseTrunk} d="m47 85 3-42h5l3 42Z" />
      <path className={styles.courseCanopy} d="M30 59C14 59 12 44 20 36c-4-12 5-23 17-22C43 2 60 3 65 15c14-3 26 9 23 22 12 11 6 26-8 28-10 2-18-1-25-4-8 5-18 4-25-2Z" />
      <path className={styles.courseCanopyLight} d="M37 14C43 2 60 3 65 15c-12-3-17 3-20 10-7 2-11 8-12 15-9-2-13 2-15 6-1-4 0-7 2-10-4-12 5-23 17-22Z" />
      <path className={styles.courseBranches} d="M52 68V32m0 22L35 39m17 7 17-15" />
    </g>
    <HarvestGlove course />
    <g className={styles.courseGlints}><path d="M20 39v6m-3-3h6m56 23v6m-3-3h6" /></g>
  </>;
}

function HarvestGlove({ course = false }: { course?: boolean }) {
  return <g className={styles.harvestGlove}>
    <g transform={course ? "translate(63 58) scale(.24)" : "translate(50 78) scale(.29)"}>
      <path className={styles.gloveCuff} d="m70 85 18-12c12 5 6 17-6 24-10 7-25 6-30-1Z" />
      <path className={styles.glovePalm} d="M86 83c10-10 9-29 3-45-5-13-17-27-29-20-11-7-22-2-29 5L19 6C13-3 6 0 3 10c-5 12 1 22 12 34 9 10 15 17 18 25-16-7-28 2-28 16-1 14 12 12 23 6 12-7 29 4 43-1 6-2 11-4 15-7Z" />
      <path className={styles.gloveSeam} d="M31 23q9 13 18 17m14 16 10 17m-14-3 8 11m9-27 4 15" />
    </g>
  </g>;
}

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
        <CourseTree />
      </> : <>
        <g transform="translate(-9 24) scale(.72)"><OrchardTree /></g>
        <g transform="translate(35 24) scale(.68)"><OrchardTree /></g>
        <g className={styles.orchardCenter}><OrchardTree /></g>
        <g transform="translate(28 56)"><OrchardFruit className={styles.fruitLeft} /></g>
        <g transform="translate(85 52)"><OrchardFruit className={styles.fruitRight} /></g>
        <g transform="translate(61 47)"><OrchardFruit /></g>
        <HarvestGlove />
      </>}
    </svg>
  </span>;
}
