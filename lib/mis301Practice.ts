export const MIS301_COURSE_ID = "5e9700b6-d498-4ce7-b7b5-3cabca3fe8d5";
export const MIS301_SECTION_ID = "71c4d32e-7d80-4ae6-9576-13a0840ccd45";
// Server-owned report labels and allowed fields. Never accept identity or schema from a slide.
export const MIS301_PRACTICE = {
  import: { label: "Practice 1 · Import", fields: [{ id: "code", label: "Import code" }] },
  explore: { label: "Practice 2 · Explore", fields: [{ id: "headCode", label: "First 10 rows code" }, { id: "tailCode", label: "Last 5 rows code" }, { id: "rows", label: "Rows" }, { id: "columns", label: "Columns" }] },
  scores: { label: "Practice 3 · Happiness Score", fields: [{ id: "mean", label: "Average score" }, { id: "minimum", label: "Minimum score" }, { id: "code", label: "Evidence code" }] },
  quality: { label: "Practice 4 · Data quality", fields: [{ id: "countryType", label: "country_name dtype" }, { id: "supportCount", label: "social_support count" }, { id: "explanation", label: "Missing values explanation" }] },
} as const;
export type Mis301Part = keyof typeof MIS301_PRACTICE;
export function mis301Part(value: unknown): Mis301Part | null {
  return typeof value === "string" && Object.hasOwn(MIS301_PRACTICE, value) ? value as Mis301Part : null;
}
