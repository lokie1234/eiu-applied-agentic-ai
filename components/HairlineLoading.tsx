"use client";

import { useEffect, useRef } from "react";
import { loadHairlineFigure, type FigureHandle } from "./hairline/runtime";
import styles from "./HairlineLoading.module.css";
import hairlineTheme from "./hairline/theme.module.css";

export default function HairlineLoading({ label = "Loading section", compact = false }: { label?: string; compact?: boolean }) {
  const stageRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = stageRef.current, read = readRef.current;
    if (!stage || !read) return;
    let disposed = false, handle: FigureHandle | undefined;
    let detach: (() => void) | undefined;
    void loadHairlineFigure("loading-dots").then(({ runtime, figure }) => {
      if (disposed) return;
      stage.setAttribute("data-hairline", figure.name);
      const svg = runtime.mk("svg", { viewBox: "0 95 400 135", "aria-hidden": "true" }, stage);
      handle = figure.mount({ stage, svg, read }, 16);
      const motion = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
      const sync = () => handle?.set(-1);
      motion.addEventListener("change", sync);
      detach = () => motion.removeEventListener("change", sync);
      sync();
    }).catch(() => { /* Static dots and the status label remain visible. */ });
    return () => { disposed = true; detach?.(); handle?.destroy(); };
  }, []);
  return <span className={`${styles.loading} ${compact ? styles.compact : ""}`} role="status" aria-live="polite" aria-label={label}>
    <span className={`${styles.artwork} ${hairlineTheme.artwork}`} aria-hidden="true">
      <span ref={stageRef} className={styles.stage} />
      <span className={styles.fallback}>•••••</span>
      <span ref={readRef} hidden />
    </span>
    <span className={styles.label}>{label}</span>
  </span>;
}
