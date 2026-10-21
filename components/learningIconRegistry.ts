export type LearningIconEntry = {
  element: HTMLSpanElement;
  kind: "folder" | "course" | "section";
  active: boolean;
};

export const learningIcons = new Map<HTMLSpanElement, LearningIconEntry>();
const listeners = new Set<() => void>();
let rendererState: "pending" | "ready" | "fallback" = "pending";
let fallbackTimer: number | undefined;

export function setLearningIconRendererState(state: typeof rendererState) {
  rendererState = state;
  if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
  fallbackTimer = undefined;
  learningIcons.forEach(({ element }) => { element.dataset.renderState = state; });
}

export function registerLearningIcon(entry: LearningIconEntry) {
  learningIcons.set(entry.element, entry);
  entry.element.dataset.renderState = rendererState;
  // One shared watchdog also covers an unavailable dynamic renderer bundle.
  if (rendererState === "pending" && fallbackTimer === undefined) fallbackTimer = window.setTimeout(() => setLearningIconRendererState("fallback"), 4000);
  listeners.forEach(listener => listener());
  return () => {
    learningIcons.delete(entry.element);
    if (!learningIcons.size && fallbackTimer !== undefined) { window.clearTimeout(fallbackTimer); fallbackTimer = undefined; }
    delete entry.element.dataset.webglReady;
    listeners.forEach(listener => listener());
  };
}

export function subscribeLearningIcons(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
