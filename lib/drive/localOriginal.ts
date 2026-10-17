import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Only recover a known original for the exact legacy section and compiled path.
// Never interpret database paths as local filesystem paths.
export function localOriginalPath(section: { id: string; course_id: string; content_path?: string | null; source_filename?: string | null }) {
  if (section.id === "71c4d32e-7d80-4ae6-9576-13a0840ccd45" &&
      section.course_id === "5e9700b6-d498-4ce7-b7b5-3cabca3fe8d5" &&
      section.content_path === `${section.course_id}/${section.id}/PandasPracticePart2.js` &&
      section.source_filename === "PandasPracticePart2.tsx") return "course-content/mis301/PandasPracticePart2.js";
  return null;
}

export async function readLocalOriginal(section: Parameters<typeof localOriginalPath>[0]) {
  const file = localOriginalPath(section);
  return file ? readFile(path.join(process.cwd(), file)) : null;
}
