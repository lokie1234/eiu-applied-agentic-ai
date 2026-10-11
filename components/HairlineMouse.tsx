"use client";

import { useEffect, useRef } from "react";
import { loadHairlineFigure, type FigureHandle } from "./hairline/runtime";
import styles from "./LessonPortal.module.css";
import hairlineTheme from "./hairline/theme.module.css";

export default function HairlineMouse() {
  const stageRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = stageRef.current, read = readRef.current;
    if (!stage || !read) return;
    let disposed = false, handle: FigureHandle | undefined;
    let detach: (() => void) | undefined;
    void loadHairlineFigure("click-mouse").then(({ runtime, figure }) => {
      if (disposed) return;
      stage.setAttribute("data-hairline", figure.name);
      const svg = runtime.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);
      handle = figure.mount({ stage, svg, read }, 0);
      const button = stage.closest("button");
      let hovered = Boolean(button?.matches(":hover")), focused = button === document.activeElement;
      const sync = () => handle?.set(hovered || focused ? 12 : 0);
      const enter = () => { hovered = true; sync(); };
      const leave = () => { hovered = false; sync(); };
      const focus = () => { focused = true; sync(); };
      const blur = () => { focused = false; sync(); };
      button?.addEventListener("pointerenter", enter);
      button?.addEventListener("pointerleave", leave);
      button?.addEventListener("focus", focus);
      button?.addEventListener("blur", blur);
      sync();
      detach = () => {
        button?.removeEventListener("pointerenter", enter);
        button?.removeEventListener("pointerleave", leave);
        button?.removeEventListener("focus", focus);
        button?.removeEventListener("blur", blur);
      };
    }).catch(() => { /* The section button and Click label remain available. */ });
    return () => { disposed = true; detach?.(); handle?.destroy(); };
  }, []);
  return <span className={`${styles.sectionClickArtwork} ${hairlineTheme.artwork}`} aria-hidden="true">
    <span ref={stageRef} className={styles.folderStage} />
    <span ref={readRef} hidden />
  </span>;
}
