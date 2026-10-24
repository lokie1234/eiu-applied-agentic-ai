import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sources from "@/course-content/sources.json";

// Repository-controlled bindings; uploaded/database filenames are never paths.
export function localSectionSourcePath(
  course: { id: string },
  section: { id: string; content_type: string; content_path?: string | null },
) {
  // Explicit admin replacements take precedence over the registered project default.
  if (section.content_type !== "tsx" || section.content_path?.startsWith("drive:override:")) return null;
  const source = sources.find(item =>
    item.courseId === course.id && item.sectionId === section.id,
  );
  if (!source) return null;
  if (!/^course-content\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_.-]+\.js$/.test(source.path)) {
    throw new Error("Invalid local section source path.");
  }
  return source.path;
}

const localSourceCache = new Map<string, { mtime: number; data: Buffer }>();

export async function readLocalSectionSource(
  course: Parameters<typeof localSectionSourcePath>[0],
  section: Parameters<typeof localSectionSourcePath>[1],
) {
  const source = localSectionSourcePath(course, section);
  if (!source) return null;
  const fullPath = path.join(process.cwd(), "course-content", source.slice("course-content/".length));
  try {
    const fileStat = await stat(fullPath);
    const cached = localSourceCache.get(fullPath);
    if (cached && cached.mtime === fileStat.mtimeMs) {
      return cached.data;
    }
    const data = await readFile(fullPath);
    localSourceCache.set(fullPath, { mtime: fileStat.mtimeMs, data });
    return data;
  } catch {
    return readFile(fullPath);
  }
}
