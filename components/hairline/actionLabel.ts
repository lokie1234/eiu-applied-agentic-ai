// Upright application lettering emerges outside the drawing as its opening settles.
// Canonical Hairline previews remain word-free; no second animation clock is needed.
export function attachActionLabel(svg: SVGSVGElement, stage: HTMLElement, className: string) {
  const plane = svg.querySelector("[data-action-reveal]");
  if (!plane) return () => {};
  const label = document.createElement("span");
  label.textContent = "Click";
  label.className = className;
  label.setAttribute("aria-hidden", "true");
  stage.append(label);
  const sync = () => {
    label.style.setProperty("--action-reveal", plane.getAttribute("data-action-reveal") || "0");
  };
  sync();
  stage.setAttribute("data-action-ready", "true");
  const observer = new MutationObserver(sync);
  observer.observe(plane, { attributes: true, attributeFilter: ["data-action-reveal"] });
  return () => { observer.disconnect(); label.remove(); stage.removeAttribute("data-action-ready"); };
}
