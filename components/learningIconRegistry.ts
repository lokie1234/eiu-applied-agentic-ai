export type LearningIconEntry = {
  element: HTMLSpanElement;
  kind: "folder" | "course" | "section";
  active: boolean;
  electric: boolean;
};

export const learningIcons = new Map<HTMLSpanElement, LearningIconEntry>();
const listeners = new Set<() => void>();

export function registerLearningIcon(entry: LearningIconEntry) {
  learningIcons.set(entry.element, entry);
  listeners.forEach(listener => listener());
  return () => {
    learningIcons.delete(entry.element);
    delete entry.element.dataset.webglReady;
    listeners.forEach(listener => listener());
  };
}

export function subscribeLearningIcons(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
