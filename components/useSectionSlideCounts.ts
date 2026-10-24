"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCompiledSectionMetadata } from "@/lib/compiledSectionMetadata";
import type { SectionFileType } from "@/lib/sectionSlideCount";

type Section = { uploadedContent?: boolean; id: string; contentType: string; contentRevision?: string | null; slideCount?: number | null };
type Count = { revision: string; count: number };

// Equal catalog refreshes share the same input instead of downloading and
// rendering every section again. A changed content revision starts a fresh read.
export function useSectionSlideCounts(courseId: string, sections?: Section[], isAdmin = false) {
  const signature = sections ? JSON.stringify(sections.map(({ id, contentType, contentRevision, uploadedContent, slideCount }) => ({ id, contentType, uploadedContent,
    contentRevision: (contentType === "tsx" && !uploadedContent && getCompiledSectionMetadata(id)?.revision) || contentRevision, slideCount }))) : "";
  const input = useMemo<Section[] | undefined>(() => signature ? JSON.parse(signature) : undefined, [signature]);
  const [results, setResults] = useState<{ courseId: string; sections?: Section[]; counts: Record<string, Count> }>({ courseId: "", counts: {} });
  const completed = useRef<{ courseId: string; counts: Record<string, Count> }>({ courseId: "", counts: {} });
  useEffect(() => {
    if (!input) return;
    if (!input?.length) return;
    if (completed.current.courseId !== courseId) completed.current = { courseId, counts: {} };
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]);
    const queue = input.filter(section => ["tsx", "pdf", "pptx"].includes(section.contentType) &&
      !(section.contentType === "tsx" && !section.uploadedContent && getCompiledSectionMetadata(section.id)) &&
      completed.current.counts[`${section.id}:${isAdmin}`]?.revision !== `${section.contentType}:${section.contentRevision ?? ""}:${isAdmin}`);
    let next = 0;
    async function run() {
      while (next < queue.length && !signal.aborted) {
        const section = queue[next++];
        try {
          const { readSectionSlideCount } = await import("@/lib/sectionSlideCount");
          if (signal.aborted) return;
          const count = await readSectionSlideCount(section.id, section.contentType as SectionFileType, signal, isAdmin, section.uploadedContent);
          if (signal.aborted) return;
          completed.current.counts[`${section.id}:${isAdmin}`] = { revision: `${section.contentType}:${section.contentRevision ?? ""}:${isAdmin}`, count };
          setResults(current => ({ courseId, sections: input, counts: {
            ...(current.courseId === courseId ? current.counts : {}),
            [`${section.id}:${isAdmin}`]: { revision: `${section.contentType}:${section.contentRevision ?? ""}:${isAdmin}`, count },
          } }));
        } catch { /* Keep the pending label instead of claiming an outdated count. */ }
      }
    }
    void run(); void run();
    return () => controller.abort();
  }, [courseId, input, isAdmin]);
  const counts: Record<string, number> = {};
  for (const section of input ?? []) {
    const compiled = section.contentType === "tsx" && !section.uploadedContent ? getCompiledSectionMetadata(section.id) : undefined;
    if (compiled) { counts[section.id] = isAdmin ? compiled.teachingSlides : compiled.learnerSlides; continue; }
    if (results.courseId !== courseId) continue;
    const result = results.counts[`${section.id}:${isAdmin}`];
    if (result?.revision === `${section.contentType}:${section.contentRevision ?? ""}:${isAdmin}`) counts[section.id] = result.count;
  }
  return counts;
}
