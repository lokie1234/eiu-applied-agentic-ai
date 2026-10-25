import manifest from "../course-content/web-app-development/manifest.json";
import sources from "../course-content/sources.json";

type CompiledMetadata = { courseId: string; path: string; revision: string; bytes: number; teachingSlides: number; learnerSlides: number; preservesBusinessTemplate: boolean;
  nativeSlides?: { teaching: Record<string, "showcase" | "quiz">; learner: Record<string, "showcase" | "quiz"> };
};
export function getCompiledSectionMetadata(sectionId: string): CompiledMetadata | undefined {
  const entry = (manifest as Record<string, CompiledMetadata>)[sectionId];
  return entry && sources.some(source => source.sectionId === sectionId && source.courseId === entry.courseId && source.path === entry.path) ? entry : undefined;
}

