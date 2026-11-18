import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Activity, type ReactNode } from "react";
import "../../../app/globals.css";

/** The existing player calls these factories lazily and caches their DOM. */
export function createOfflineSlides(renderers: (() => ReactNode)[]) {
  const mounted = new Map<SVGSVGElement, { root: ReturnType<typeof createRoot>; render: () => ReactNode; visible: boolean }>();
  let observer: MutationObserver | undefined;
  const watch = () => {
    if (observer) return;
    observer = new MutationObserver(() => {
      for (const [node, entry] of mounted) {
        const visible = node.isConnected;
        if (visible !== entry.visible) {
          entry.visible = visible;
          // Pause effects (timers and document keyboard handlers) while cached,
          // retaining component state when the player revisits the slide.
          flushSync(() => entry.root.render(<Activity mode={visible ? "visible" : "hidden"}>{entry.render()}</Activity>));
        }
      }
      for (const [node, entry] of [...mounted]) {
        if (node.isConnected) { mounted.delete(node); mounted.set(node, entry); }
      }
      // Match the Windows 1.2.1 player's six-slide cache. Release evicted roots.
      for (const [node, entry] of mounted) {
        if (mounted.size <= 6) break;
        if (!node.isConnected) { entry.root.unmount(); mounted.delete(node); }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pagehide", () => {
      observer?.disconnect();
      for (const entry of mounted.values()) entry.root.unmount();
      mounted.clear();
    }, { once: true });
  };
  return renderers.map(render => (css: string) => {
    watch();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-preserve-original", "true");
    svg.setAttribute("viewBox", "0 0 960 540");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.display = "block";
    const foreign = document.createElementNS(svg.namespaceURI, "foreignObject");
    foreign.setAttribute("width", "960");
    foreign.setAttribute("height", "540");
    const canvas = document.createElement("div");
    canvas.dataset.offlineCanvas = "true";
    canvas.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    canvas.style.cssText = "width:960px;height:540px;position:relative;overflow:hidden";
    const style = document.createElement("style");
    style.textContent = css;
    canvas.appendChild(style);
    const mount = document.createElement("div");
    mount.style.cssText = "width:960px;height:540px";
    canvas.appendChild(mount);
    foreign.appendChild(canvas);
    svg.appendChild(foreign);
    const root = createRoot(mount);
    mounted.set(svg, { root, render, visible: true });
    flushSync(() => root.render(<Activity mode="visible">{render()}</Activity>));
    return svg;
  });
}
