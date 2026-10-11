"use client";

import { useEffect, useRef } from "react";
import { loadHairlineFigure, type FigureHandle } from "./hairline/runtime";
import styles from "./LessonPortal.module.css";
import hairlineTheme from "./hairline/theme.module.css";

export default function HairlineFolder({ selected }: { selected: boolean }) {
  const stageRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const handleRef = useRef<FigureHandle | null>(null);
  const selectionRef = useRef(selected);
  const interactionRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    const read = readRef.current;
    if (!stage || !read) return;
    let disposed = false;
    let detachInteraction: (() => void) | undefined;
    let brandObserver: MutationObserver | undefined;
    void loadHairlineFigure("course-folder").then(({ runtime, figure }) => {
      if (disposed) return;
      stage.setAttribute("data-hairline", figure.name);
      const svg = runtime.mk("svg", { viewBox: "30 20 340 280", "aria-hidden": "true" }, stage);
      handleRef.current = figure.mount({ stage, svg, read }, selectionRef.current ? 38 : 18);
      const cover = svg.querySelector("[data-logo-transform]");
      if (cover) {
        const logo = runtime.mk("image", { href: "/branding/eiu-logo-uploaded.png", width: "100", height: "28", "aria-hidden": "true" }, svg);
        const placeBrand = () => logo.setAttribute("transform", cover.getAttribute("data-logo-transform") || "");
        placeBrand();
        brandObserver = new MutationObserver(placeBrand);
        brandObserver.observe(cover, { attributes: true, attributeFilter: ["data-logo-transform"] });
      }
      const button = stage.closest("button");
      const enter = () => { interactionRef.current = true; handleRef.current?.set(58); };
      const leave = () => { interactionRef.current = false; handleRef.current?.set(selectionRef.current ? 38 : 18); };
      button?.addEventListener("pointerenter", enter);
      button?.addEventListener("pointerleave", leave);
      button?.addEventListener("focusin", enter);
      button?.addEventListener("focusout", leave);
      if (button?.matches(":hover, :focus-within")) enter();
      detachInteraction = () => {
        button?.removeEventListener("pointerenter", enter);
        button?.removeEventListener("pointerleave", leave);
        button?.removeEventListener("focusin", enter);
        button?.removeEventListener("focusout", leave);
      };
    }).catch(() => {
      // Folder names and native selection buttons remain usable if artwork fails.
    });
    return () => {
      disposed = true;
      detachInteraction?.();
      brandObserver?.disconnect();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    selectionRef.current = selected;
    handleRef.current?.set(interactionRef.current ? 58 : selected ? 38 : 18);
  }, [selected]);

  return <span className={`${styles.folderArtwork} ${hairlineTheme.artwork}`} aria-hidden="true">
    <span ref={stageRef} className={styles.folderStage} />
    <span ref={readRef} hidden />
  </span>;
}
