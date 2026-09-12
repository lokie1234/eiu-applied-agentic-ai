"use client";

import styles from "./SlideClosingAmbient.module.css";

type Props = {
  pageNumber: 32 | 36 | 37 | 38;
};

const CHECK_POINTS = [
  [88, 203],
  [88, 282],
  [88, 361],
  [535, 203],
  [535, 282],
  [535, 361],
] as const;

function SlideThirtyTwo() {
  return (
    <>
      <div className={styles.completionAura} />
      <svg className={styles.svg} viewBox="0 0 960 540">
        <path className={styles.trace} d="M52 438 H168 C195 438 195 472 222 472 H327" />
        <path className={styles.traceDelay} d="M633 72 H742 C770 72 770 104 798 104 H908" />
        <circle className={styles.nodeA} cx="168" cy="438" r="4" />
        <circle className={styles.nodeB} cx="798" cy="104" r="4" />
        <circle className={styles.nodeC} cx="327" cy="472" r="3" />
      </svg>
      <span className={`${styles.spark} ${styles.sparkA}`} />
      <span className={`${styles.spark} ${styles.sparkB}`} />
      <span className={`${styles.spark} ${styles.sparkC}`} />
    </>
  );
}

function SlideThirtySix() {
  return (
    <>
      <svg className={styles.svg} viewBox="0 0 960 540">
        <path className={styles.cornerGold} d="M66 92 V48 H112" />
        <path className={styles.cornerBlue} d="M894 448 V492 H848" />
        <path className={styles.horizon} d="M190 405 H770" />
        <circle className={styles.orbitRing} cx="820" cy="108" r="34" />
        <circle className={styles.orbitDot} cx="820" cy="74" r="4" />
      </svg>
      <div className={styles.whiteShimmer} />
      <span className={`${styles.spark} ${styles.whiteSparkA}`} />
      <span className={`${styles.spark} ${styles.whiteSparkB}`} />
    </>
  );
}

function SlideThirtySeven() {
  return (
    <svg className={styles.svg} viewBox="0 0 960 540">
      <path className={styles.checkRail} d="M88 203 V361" />
      <path className={styles.checkRailDelay} d="M535 203 V361" />
      {CHECK_POINTS.map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`} style={{ animationDelay: `${index * 0.48}s` }} className={styles.checkPulse}>
          <circle cx={cx} cy={cy} r="20" />
          <circle cx={cx} cy={cy} r="4" className={styles.checkCore} />
        </g>
      ))}
      <path className={styles.resultSweep} d="M102 422 C310 486 650 486 858 422" />
    </svg>
  );
}

function SlideThirtyEight() {
  return (
    <>
      <div className={styles.practiceGlow} />
      <svg className={styles.svg} viewBox="0 0 960 540">
        <path className={styles.practiceArc} d="M76 462 C260 510 700 510 884 462" />
        <path className={styles.practiceTrace} d="M737 72 H846 V118 H905" />
        <circle className={styles.practiceNodeA} cx="737" cy="72" r="3" />
        <circle className={styles.practiceNodeB} cx="846" cy="118" r="4" />
        <circle className={styles.practiceNodeC} cx="905" cy="118" r="3" />
      </svg>
      <span className={`${styles.spark} ${styles.practiceSparkA}`} />
      <span className={`${styles.spark} ${styles.practiceSparkB}`} />
    </>
  );
}

export default function SlideClosingAmbient({ pageNumber }: Props) {
  return (
    <div className={styles.root} aria-hidden="true">
      {pageNumber === 32 && <SlideThirtyTwo />}
      {pageNumber === 36 && <SlideThirtySix />}
      {pageNumber === 37 && <SlideThirtySeven />}
      {pageNumber === 38 && <SlideThirtyEight />}
    </div>
  );
}
