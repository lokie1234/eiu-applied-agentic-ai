"use client";

import { useEffect, useState } from "react";
import { readSectionSlideCount, type SectionFileType } from "@/lib/sectionSlideCount";

type Section = { id: string; contentType: string; contentRevision?: string | null };
type Count = { revision: string; count: number };

// Only the open course is inspected, with at most two concurrent reads. Reopening
// or refreshing its catalog re-reads the authoritative, access-checked source.
export function useSectionSlideCounts(courseId: string, sections?: Section[]) {
  const [results, setResults] = useState<{ courseId: string; sections?: Section[]; counts: Record<string, Count> }>({ courseId: "", counts: {} });
  useEffect(() => {
    if (!sections?.length) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]);
    const queue = sections.filter(section => ["tsx", "pdf", "pptx"].includes(section.contentType));
    let next = 0;
    async function run() {
      while (next < queue.length && !signal.aborted) {
        const section = queue[next++];
        try {
          const count = await readSectionSlideCount(section.id, section.contentType as SectionFileType, signal);
          if (signal.aborted) return;
          setResults(current => ({ courseId, sections, counts: {
            ...(current.courseId === courseId && current.sections === sections ? current.counts : {}),
            [section.id]: { revision: `${section.contentType}:${section.contentRevision ?? ""}`, count },
          } }));
        } catch { /* Keep the pending label instead of claiming an outdated count. */ }
      }
    }
    void run(); void run();
    return () => controller.abort();
  }, [courseId, sections]);
  const counts: Record<string, number> = {};
  if (results.courseId === courseId && results.sections === sections) for (const section of sections ?? []) {
    const result = results.counts[section.id];
    if (result?.revision === `${section.contentType}:${section.contentRevision ?? ""}`) counts[section.id] = result.count;
  }
  return counts;
}
