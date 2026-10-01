export type CourseAccess = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  languageLabel: "vi" | "en" | "vi_en";
  isUnlocked?: boolean;
};

export type SectionAccess = {
  id: string;
  courseId: string;
  sectionKey: string;
  title: string;
  position: number;
};

export type AppUserAccess = {
  authUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isActive: boolean;
  courses: CourseAccess[];
  sections: SectionAccess[];
};

export type LearningSection = "section1" | "section2";

export const APPLIED_AGENTIC_AI_SLUG = "applied-agentic-ai";
export const ACTIVE_SECTION_COOKIE = "eiu_active_section";

export function isLearningSection(value: unknown): value is LearningSection {
  return value === "section1" || value === "section2";
}

export function isEiuEmail(value: unknown): value is string {
  const email = String(value ?? "").trim().toLowerCase();
  const parts = email.split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[1] === "eiu.edu.vn";
}

export const FIXED_ADMIN_EMAIL = "son.lam@eiu.edu.vn";

export function isFixedAdminEmail(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === FIXED_ADMIN_EMAIL;
}

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
