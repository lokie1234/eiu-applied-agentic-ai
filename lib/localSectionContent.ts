import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sources from "@/course-content/sources.json";

// Repository-controlled bindings; uploaded/database filenames are never paths.
export function localSectionSourcePath(
  course: { id: string },
  section: { id: string; content_type: string },
) {
  if (section.content_type !== "tsx") return null;
  const source = sources.find(item =>
    item.courseId === course.id && item.sectionId === section.id,
  );
  if (!source) return null;
  if (!/^course-content\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_.-]+\.js$/.test(source.path)) {
    throw new Error("Invalid local section source path.");
  }
  return source.path;
}

export async function readLocalSectionSource(
  course: Parameters<typeof localSectionSourcePath>[0],
  section: Parameters<typeof localSectionSourcePath>[1],
) {
  const source = localSectionSourcePath(course, section);
  // Read on every request so edits apply on reload. A missing configured source
  // fails visibly instead of silently showing an outdated uploaded copy.
  return source
    ? readFile(path.join(process.cwd(), "course-content", source.slice("course-content/".length)))
    : null;
}
