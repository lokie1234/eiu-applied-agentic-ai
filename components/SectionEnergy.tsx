"use client";

import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import styles from "./LessonPortal.module.css";

type Box = { x: number; y: number; width: number; height: number };
type Geometry = { width: number; height: number; exclusions: Box[] };

/** Measure content once per layout change; CSS animates without React updates. */
export default function SectionEnergy() {
  const ref = useRef<SVGSVGElement>(null);
  const maskId = useId().replace(/:/g, "");
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useEffect(() => {
    const card = ref.current?.parentElement;
    if (!card) return;
    let frame = 0;
    const content = [...card.querySelectorAll<HTMLElement>("[data-energy-exclude]")];
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!card) return;
        // Offset dimensions ignore the card's hover translation and 3D icon tilt.
        const width = card.clientWidth, height = card.clientHeight;
        const exclusions = content.map(element => ({
          x: element.offsetLeft - 8, y: element.offsetTop - 7,
          width: element.offsetWidth + 16, height: element.offsetHeight + 14,
        }));
        const next = { width, height, exclusions };
        setGeometry(previous => previous?.width === width && previous.height === height &&
          previous.exclusions.length === exclusions.length && previous.exclusions.every((box, index) => {
            const value = exclusions[index];
            return box.x === value.x && box.y === value.y && box.width === value.width && box.height === value.height;
          }) ? previous : next);
      });
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(card);
    content.forEach(element => observer.observe(element));
    schedule();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const width = geometry?.width ?? 1, height = geometry?.height ?? 1;
  const exclusions = geometry?.exclusions ?? [];
  const isClear = (x: number, y: number) => exclusions.every(box =>
    x < box.x - 8 || x > box.x + box.width + 8 || y < box.y - 8 || y > box.y + box.height + 8);
  const center = [[.5, .55], [.5, .65], [.4, .55], [.6, .55], [.35, .65], [.5, .45]]
    .map(([x, y]) => [x * width, y * height])
    .find(([x, y]) => isClear(x, y));
  const [cx, cy] = center ?? [width * .5, height * .55];
  const ends = [[8, 8], [width * .5, 6], [width - 8, 8], [width - 6, height * .5],
    [width - 8, height - 8], [width * .5, height - 6], [8, height - 8], [6, height * .5]];
  return <svg ref={ref} className={styles.sectionEnergy} viewBox={`0 0 ${width} ${height}`}
    aria-hidden="true" focusable="false" shapeRendering="geometricPrecision">
    {geometry && <>
      <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
        <rect x="3" y="3" width={Math.max(0, width - 6)} height={Math.max(0, height - 6)} rx="12" fill="white" />
        {exclusions.map((box, index) => <rect key={index} {...box} rx="7" fill="black" />)}
      </mask></defs>
      <g mask={`url(#${maskId})`}>
        {ends.map(([x, y], index) => {
          const mx = cx + (x - cx) * .35, my = cy + (y - cy) * .5;
          const route = `M${cx} ${cy}L${mx} ${cy}L${mx} ${my}L${x} ${y}`;
          return <g key={index} style={{ "--ray-delay": `${-(index % 6) * .42}s`, "--ray-duration": `${3.6 + (index % 3) * .4}s` } as CSSProperties}>
            <path className={styles.sectionEnergyTrack} d={route} vectorEffect="non-scaling-stroke" />
            <path className={styles.sectionEnergyPulse} d={route} pathLength="100" vectorEffect="non-scaling-stroke" />
            <circle className={styles.sectionEnergyEnd} cx={x} cy={y} r="2" />
          </g>;
        })}
        <circle className={styles.sectionEnergyAura} cx={cx} cy={cy} r="14" />
        <circle className={styles.sectionEnergyCore} cx={cx} cy={cy} r="3" />
      </g>
    </>}
  </svg>;
}
