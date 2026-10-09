function key(courseId: string, sectionId: string) { return `eiu:slide:${courseId}:${sectionId}`; }
export function rememberDeckSelection(courseId?: string | null, sectionId?: string | null, file = false) {
  const url = new URL(window.location.href);
  for (const name of ["courseId", "sectionId", "slide", "view"]) url.searchParams.delete(name);
  if (courseId) url.searchParams.set("courseId", courseId);
  if (sectionId && courseId) {
    url.searchParams.set("sectionId", sectionId);
    let page = "1";
    try { page = window.sessionStorage.getItem(key(courseId, sectionId)) || "1"; } catch {}
    url.searchParams.set("slide", page);
    if (file) url.searchParams.set("view", "file");
  }
  window.history.replaceState(window.history.state, "", url);
}
export function restoredSlide(total: number) {
  if (typeof window === "undefined") return 1;
  const page = Number(new URL(window.location.href).searchParams.get("slide") || 1);
  return Number.isFinite(page) ? Math.min(total, Math.max(1, Math.round(page))) : 1;
}
export function rememberSlide(page: number) {
  const url = new URL(window.location.href);
  if (!url.searchParams.get("sectionId")) return;
  url.searchParams.set("slide", String(page));
  window.history.replaceState(window.history.state, "", url);
  try { window.sessionStorage.setItem(key(url.searchParams.get("courseId") || "", url.searchParams.get("sectionId")!), String(page)); } catch {}
}
