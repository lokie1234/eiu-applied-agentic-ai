export const SLIDE_STORAGE_KEYS = {
  // Section 1
  s1_stages: "eiu_s1_slide7_stages",
  s1_business: "eiu_s1_slide11_business",
  s1_restaurant: "eiu_s1_slide10_restaurant",
  s1_hiddenIdeas: "eiu_s1_hidden_ideas",
  s1_hiddenShowcase: "eiu_s1_hidden_showcase",

  // Section 2
  s2_users: "eiu_s2_slide7_users",
  s2_workflow: "eiu_s2_slide8_workflow",
  s2_core: "eiu_s2_slide16_sorted",
  s2_hiddenShowcase: "eiu_s2_hidden_showcase",
} as const;

export function getSlideStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSlideStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

export function clearSlideInteractionStorage(section?: "section1" | "section2"): void {
  if (typeof window === "undefined") return;
  try {
    if (!section || section === "section1") {
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s1_stages);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s1_business);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s1_restaurant);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s1_hiddenIdeas);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s1_hiddenShowcase);
    }
    if (!section || section === "section2") {
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s2_users);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s2_workflow);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s2_core);
      sessionStorage.removeItem(SLIDE_STORAGE_KEYS.s2_hiddenShowcase);
    }
  } catch {}
}
