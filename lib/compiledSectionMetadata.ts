import manifest from "../course-content/web-app-development/manifest.json";
import mis301Manifest from "../course-content/mis301/manifest.json";
import mis311Manifest from "../course-content/mis311/manifest.json";
import advancedManifest from "../course-content/advanced-business-analytics/manifest.json";
import sources from "../course-content/sources.json";
export type ShowcaseGuide = { title: string; message: string; cards: { title: string; text: string; logo?: string; logoSrc?: string; detail?: string; code?: string; summary?: string[]; modes?: { title: string; text: string }[]; points?: string[] }[] };
export type ShowcasePractice = { title: string; minutes: number; goal: string; steps: string[]; deliverable: string; allowImages: boolean; allowDelete?: boolean; activityId?: string; hint?: string };

type CompiledMetadata = { courseId: string; path: string; revision: string; bytes: number; teachingSlides: number; learnerSlides: number; preservesBusinessTemplate: boolean;
  nativeSlides?: { teaching: Record<string, "showcase" | "quiz">; learner: Record<string, "showcase" | "quiz"> };
  showcaseGuide?: ShowcaseGuide;
  showcasePractice?: ShowcasePractice;
  showcasePractices?: Record<string, ShowcasePractice>;
};
export function getCompiledSectionMetadata(sectionId: string): CompiledMetadata | undefined {
  const entry = (manifest as Record<string, CompiledMetadata>)[sectionId] ?? (mis301Manifest as Record<string, CompiledMetadata>)[sectionId] ?? (mis311Manifest as Record<string, CompiledMetadata>)[sectionId] ?? (advancedManifest as Record<string, CompiledMetadata>)[sectionId];
  return entry && sources.some(source => source.sectionId === sectionId && source.courseId === entry.courseId && source.path === entry.path) ? entry : undefined;
}

