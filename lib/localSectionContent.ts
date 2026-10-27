import "server-only";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sources from "@/course-content/sources.json";

// Repository-controlled bindings; uploaded/database filenames are never paths.
export function localSectionSourcePath(
  course: { id: string },
  section: { id: string; content_type: string; content_path?: string | null },
) {
  if (section.content_type === "tsx" && section.content_path?.startsWith("local:")) {
    const relative = section.content_path.slice("local:".length);
    const parts = relative.split("/");
    if (parts.length !== 5 || parts[0] !== "course-content" || parts[1] !== "imported" ||
        parts[2] !== course.id || parts[3] !== section.id ||
        !parts.slice(2, 4).every(value => /^[a-f0-9-]{36}$/i.test(value)) ||
        !/^[a-f0-9-]{36}\.js$/i.test(parts[4])) throw new Error("Invalid local lesson binding.");
    return relative;
  }
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

// Each import gets its own file. Publish its binding only after the bytes exist;
// a concurrent failed database update cannot replace the currently active lesson.
export async function saveLocalSectionSource(courseId: string, sectionId: string, bytes: Uint8Array) {
  if (![courseId, sectionId].every(value => /^[a-f0-9-]{36}$/i.test(value))) throw new Error("Invalid section identity.");
  const relative = `course-content/imported/${courseId}/${sectionId}/${randomUUID()}.js`;
  const absolute = path.join(process.cwd(), ...relative.split("/"));
  try {
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes, { flag: "wx" });
  } catch {
    throw new Error("Unable to save the lesson in the project. Check that course-content is writable.");
  }
  return `local:${relative}`;
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
