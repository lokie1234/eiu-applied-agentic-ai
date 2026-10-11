"use client";

import { useEffect, useRef } from "react";
import { loadHairlineFigure, type FigureHandle } from "./hairline/runtime";
import styles from "./LessonPortal.module.css";
import hairlineTheme from "./hairline/theme.module.css";

export default function HairlineEnter() {
  const stageRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = stageRef.current, read = readRef.current;
    if (!stage || !read) return;
    let disposed = false, handle: FigureHandle | undefined;
    let detach: (() => void) | undefined;
    let labelObserver: MutationObserver | undefined;
    void loadHairlineFigure("enter-key").then(({ runtime, figure }) => {
      if (disposed) return;
      stage.setAttribute("data-hairline", figure.name);
      const svg = runtime.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);
      handle = figure.mount({ stage, svg, read }, 0);
      const cap = svg.querySelector("[data-label-transform]");
      if (cap) {
        const label = runtime.mk("text", { x: "0", y: "0", "text-anchor": "middle", "dominant-baseline": "central", "aria-hidden": "true", class: styles.enterKeyLabel }, svg);
        label.textContent = "Enter";
        const placeLabel = () => label.setAttribute("transform", cap.getAttribute("data-label-transform") || "");
        placeLabel();
        labelObserver = new MutationObserver(placeLabel);
        labelObserver.observe(cap, { attributes: true, attributeFilter: ["data-label-transform"] });
      }
      const card = stage.closest("article");
      let hovered = Boolean(card?.matches(":hover")), focused = Boolean(card?.matches(":focus-within"));
      const sync = () => handle?.set(hovered || focused ? 24 : 0);
      const enter = () => { hovered = true; sync(); };
      const leave = () => { hovered = false; sync(); };
      const focus = () => { focused = true; sync(); };
      const blur = () => { focused = false; sync(); };
      const blurCard = (event: FocusEvent) => { if (!card?.contains(event.relatedTarget as Node | null)) blur(); };
      card?.addEventListener("pointerenter", enter);
      card?.addEventListener("pointerleave", leave);
      card?.addEventListener("focusin", focus);
      card?.addEventListener("focusout", blurCard);
      sync();
      detach = () => {
        card?.removeEventListener("pointerenter", enter);
        card?.removeEventListener("pointerleave", leave);
        card?.removeEventListener("focusin", focus);
        card?.removeEventListener("focusout", blurCard);
      };
    }).catch(() => { /* The native Enter button remains usable without artwork. */ });
    return () => { disposed = true; detach?.(); labelObserver?.disconnect(); handle?.destroy(); };
  }, []);
  return <span className={`${styles.enterArtwork} ${hairlineTheme.artwork}`} aria-hidden="true">
    <span ref={stageRef} className={styles.folderStage} />
    <span className={styles.enterFallback}>Enter</span>
    <span ref={readRef} hidden />
  </span>;
}
