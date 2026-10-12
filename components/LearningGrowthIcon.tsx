import styles from "./LearningGrowthIcon.module.css";

type Props = { kind: "forest" | "seed" | "sapling" | "tree"; className?: string; selected?: boolean; action?: boolean };

function Tree({ forest = false }: { forest?: boolean }) {
  return <>
    <path className={styles.trunk} d="M47 83V47h6v36M50 64 35 50m15 9 16-15" />
    {forest ? <path className={styles.canopy} d="m50 13 16 23h-8l17 23H25l17-23h-8Z" /> : <>
      <path className={styles.canopy} d="M30 62C15 61 13 43 24 37c-3-13 10-22 21-18 7-13 28-7 28 8 17 1 23 23 10 31-8 7-19 5-27 3-10 5-18 5-26 1Z" />
      <path className={styles.vein} d="M50 61V36m0 17L36 40m14 7 15-11" />
    </>}
  </>;
}

export default function LearningGrowthIcon({ kind, className = "", selected = false, action = false }: Props) {
  return <span className={[styles.icon, action ? styles.artwork : "", className].join(" ")} data-selected={selected || undefined} aria-hidden="true">
    <svg viewBox="0 0 100 100" fill="none" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <ellipse className={styles.ground} cx="50" cy="85" rx={kind === "forest" ? 43 : 31} ry="4" />
      {kind === "forest" ? <>
        <g transform="translate(-16 18) scale(.72)"><g className={[styles.sway, styles.backTree].join(" ")}><Tree forest /></g></g>
        <g transform="translate(44 11) scale(.8)"><g className={[styles.sway, styles.sideTree].join(" ")}><Tree forest /></g></g>
        <g className={styles.sway}><Tree /></g>
      </> : kind === "seed" ? <>
        <path className={styles.seed} d="M35 81c-8-10-1-25 15-24 16-1 23 14 15 24-6 8-23 9-30 0Z" />
        <path className={styles.seedSeam} d="M50 60c-7 6-8 14-5 21" />
        <g className={styles.sprout}>
          <path className={styles.stem} d="M50 64V37" />
          <path className={styles.leaf} d="M50 46C32 48 24 35 27 23c16-2 26 8 23 23Z" />
          <path className={[styles.leaf, styles.lightLeaf].join(" ")} d="M50 39c-1-18 13-25 25-21 0 15-10 23-25 21Z" />
          <path className={styles.vein} d="m50 46-14-14m14 7 16-13" />
        </g>
      </> : kind === "sapling" ? <g className={styles.sway}>
        <path className={styles.stem} d="M50 83V24" />
        <g className={styles.leafFlutter}>
          <path className={styles.leaf} d="M50 65c-20 1-30-11-28-25 18-3 31 9 28 25Z" />
          <path className={[styles.leaf, styles.lightLeaf].join(" ")} d="M50 49c-1-18 12-29 30-26 1 16-12 28-30 26Z" />
          <path className={styles.leaf} d="M50 33c-14 0-22-10-20-22 14 0 23 10 20 22Z" />
          <path className={styles.vein} d="M50 65 32 49m18 0 20-17M50 33 38 20" />
        </g>
        <path className={styles.root} d="m50 80-10 5m10-5 10 5" />
      </g> : <g className={styles.sway}><Tree /><path className={styles.root} d="m50 80-12 5m12-5 12 5" /></g>}
    </svg>
    {action && <span className={styles.action}>Click</span>}
  </span>;
}
