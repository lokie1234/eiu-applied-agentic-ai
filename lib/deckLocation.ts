export function rememberDeckSelection(courseId?: string | null, sectionId?: string | null, file = false, readable?: { course: string; section?: string }) {
  const url = new URL(window.location.href);
  for (const name of ["courseId", "sectionId", "course", "section", "slide", "view"]) url.searchParams.delete(name);
  if (courseId) url.searchParams.set(readable?.course ? "course" : "courseId", readable?.course || courseId);
  if (sectionId && courseId) {
    url.searchParams.set(readable?.section ? "section" : "sectionId", readable?.section || sectionId);
    // This is an explicit selection, so start a fresh presentation. Refreshes
    // restore directly from the current URL without calling this function.
    url.searchParams.set("slide", "1");
    if (file) url.searchParams.set("view", "file");
  }
  // Let Next's native-history adapter update its canonical URL. Passing its
  // private history state bypasses the adapter and a later refresh loses the deck.
  if (url.href !== window.location.href) window.history.replaceState(null, "", url);
}
export function restoredSlide(total: number) {
  if (typeof window === "undefined") return 1;
  const page = Number(new URL(window.location.href).searchParams.get("slide") || 1);
  return Number.isFinite(page) ? Math.min(total, Math.max(1, Math.round(page))) : 1;
}
export function rememberSlide(page: number) {
  const url = new URL(window.location.href);
  const section = url.searchParams.get("section") || url.searchParams.get("sectionId");
  if (!section) return;
  url.searchParams.set("slide", String(page));
  if (url.href !== window.location.href) window.history.replaceState(null, "", url);
}
