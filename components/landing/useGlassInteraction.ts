"use client";

import { useCallback, useEffect, useRef, type FocusEvent, type PointerEvent } from "react";

const properties = ["--glass-x", "--glass-y", "--glass-rx", "--glass-ry"];

/** One input sampler for every control on a glass surface; no React updates per frame. */
export function useGlassInteraction() {
  const frame = useRef<number | null>(null);
  const surface = useRef<HTMLElement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const motion = useRef<MediaQueryList | null>(null);

  const reset = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    for (const property of properties) surface.current?.style.removeProperty(property);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    motion.current = media;
    const stop = () => reset();
    media.addEventListener?.("change", stop);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      reset();
      media.removeEventListener?.("change", stop);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [reset]);

  function schedule(host: HTMLElement, x: number, y: number) {
    surface.current = host;
    pointer.current.x = x;
    pointer.current.y = y;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const px = Math.max(0, Math.min(1, (pointer.current.x - bounds.left) / bounds.width));
      const py = Math.max(0, Math.min(1, (pointer.current.y - bounds.top) / bounds.height));
      host.style.setProperty("--glass-x", `${px * 100}%`);
      host.style.setProperty("--glass-y", `${py * 100}%`);
      host.style.setProperty("--glass-rx", `${(0.5 - py) * 12}deg`);
      host.style.setProperty("--glass-ry", `${(px - 0.5) * 12}deg`);
    });
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !motion.current?.matches || !event.currentTarget.contains(event.target as Node)) return;
    schedule(event.currentTarget, event.clientX, event.clientY);
  }

  function focus(event: FocusEvent<HTMLElement>) {
    if (!motion.current?.matches || !event.currentTarget.contains(event.target)) return;
    const bounds = event.target.getBoundingClientRect();
    schedule(event.currentTarget, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  }

  return {
    onPointerEnter: move,
    // Capture keeps nested buttons, inputs and links on the same interaction surface.
    onPointerMoveCapture: move,
    onPointerLeave: reset,
    onPointerCancel: reset,
    onFocusCapture: focus,
    onBlurCapture: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) reset();
    },
  };
}
