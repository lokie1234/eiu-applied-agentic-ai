"use client";

import { useEffect, useRef } from "react";
import { loadHairlineFigure, type FigureHandle } from "./hairline/runtime";
import styles from "./LessonPortal.module.css";
import hairlineTheme from "./hairline/theme.module.css";
import { attachActionLabel } from "./hairline/actionLabel";

export default function HairlineBook() {
  const stageRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = stageRef.current, read = readRef.current;
    if (!stage || !read) return;
    let disposed = false, handle: FigureHandle | undefined;
    let detach: (() => void) | undefined, detachLabel: (() => void) | undefined;
    void loadHairlineFigure("course-book").then(({ runtime, figure }) => {
      if (disposed) return;
      stage.setAttribute("data-hairline", figure.name);
      const svg = runtime.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);
      handle = figure.mount({ stage, svg, read }, 10);
      detachLabel = attachActionLabel(svg, stage, styles.hairlineActionWord);
      const card = stage.closest("article");
      const touch = window.matchMedia("(hover: none), (pointer: coarse)");
      let hovered = Boolean(card?.matches(":hover")), focused = Boolean(card?.matches(":focus-within"));
      const sync = () => handle?.set(hovered || focused || touch.matches ? 76 : 10);
      const enter = () => { hovered = true; sync(); };
      const leave = () => { hovered = false; sync(); };
      const focus = () => { focused = true; sync(); };
      const blur = () => { focused = false; sync(); };
      const blurCard = (event: FocusEvent) => { if (!card?.contains(event.relatedTarget as Node | null)) blur(); };
      card?.addEventListener("pointerenter", enter);
      card?.addEventListener("pointerleave", leave);
      card?.addEventListener("focusin", focus);
      card?.addEventListener("focusout", blurCard);
      touch.addEventListener("change", sync);
      sync();
      detach = () => {
        card?.removeEventListener("pointerenter", enter);
        card?.removeEventListener("pointerleave", leave);
        card?.removeEventListener("focusin", focus);
        card?.removeEventListener("focusout", blurCard);
        touch.removeEventListener("change", sync);
      };
    }).catch(() => { /* The native course button remains usable without artwork. */ });
    return () => { disposed = true; detach?.(); detachLabel?.(); handle?.destroy(); };
  }, []);
  return <span className={`${styles.enterArtwork} ${hairlineTheme.artwork}`} aria-hidden="true">
    <span ref={stageRef} className={styles.folderStage}><span className={styles.hairlineActionFallback}>Click</span></span>
    <span ref={readRef} hidden />
  </span>;
}
