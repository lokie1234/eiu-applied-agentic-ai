"use client";

import { useEffect, useRef } from "react";
import { loadHairlineFigure, type FigureHandle } from "./hairline/runtime";
import styles from "./LessonPortal.module.css";
import hairlineTheme from "./hairline/theme.module.css";
import { attachActionLabel } from "./hairline/actionLabel";

export default function HairlinePage() {
  const stageRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = stageRef.current, read = readRef.current;
    if (!stage || !read) return;
    let disposed = false, handle: FigureHandle | undefined;
    let detach: (() => void) | undefined, detachLabel: (() => void) | undefined;
    void loadHairlineFigure("section-page").then(({ runtime, figure }) => {
      if (disposed) return;
      stage.setAttribute("data-hairline", figure.name);
      const svg = runtime.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);
      handle = figure.mount({ stage, svg, read }, 28);
      detachLabel = attachActionLabel(svg, stage, styles.hairlineActionWord);
      const button = stage.closest("button");
      const touch = window.matchMedia("(hover: none), (pointer: coarse)");
      let hovered = Boolean(button?.matches(":hover")), focused = button === document.activeElement;
      const sync = () => handle?.set(hovered || focused || touch.matches ? 76 : 28);
      const enter = () => { hovered = true; sync(); };
      const leave = () => { hovered = false; sync(); };
      const focus = () => { focused = true; sync(); };
      const blur = () => { focused = false; sync(); };
      button?.addEventListener("pointerenter", enter);
      button?.addEventListener("pointerleave", leave);
      button?.addEventListener("focus", focus);
      button?.addEventListener("blur", blur);
      touch.addEventListener("change", sync);
      sync();
      detach = () => {
        button?.removeEventListener("pointerenter", enter);
        button?.removeEventListener("pointerleave", leave);
        button?.removeEventListener("focus", focus);
        button?.removeEventListener("blur", blur);
        touch.removeEventListener("change", sync);
      };
    }).catch(() => { /* The section button and Click label remain available. */ });
    return () => { disposed = true; detach?.(); detachLabel?.(); handle?.destroy(); };
  }, []);
  return <span className={`${styles.sectionClickArtwork} ${hairlineTheme.artwork}`} aria-hidden="true">
    <span ref={stageRef} className={styles.folderStage}><span className={styles.hairlineActionFallback}>Click</span></span>
    <span ref={readRef} hidden />
  </span>;
}
