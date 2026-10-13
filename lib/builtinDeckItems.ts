export type SectionOneDeckItem =
  | { kind: "native"; pdfPage: number }
  | { kind: "slide14"; slide: "gemini-model" }
  | { kind: "html"; slide: "slide3" | "slide4" | "idea-results" | "deployment" | "apply-idea" | "realtime-dashboard" }
  | { kind: "showcase" }
  | { kind: "quiz" };

export function buildSectionOneDeckItems(isAdmin: boolean): SectionOneDeckItem[] {
  const items: SectionOneDeckItem[] = [];
  for (let pdfPage = 1; pdfPage <= 38; pdfPage += 1) {
    if (pdfPage === 10) continue;
    if (pdfPage === 3) items.push({ kind: "html", slide: "slide3" });
    else if (pdfPage === 4) items.push({ kind: "html", slide: "slide4" });
    else if (pdfPage === 14) items.push({ kind: "slide14", slide: "gemini-model" });
    else if (pdfPage === 38) {
      items.push({ kind: "showcase" });
      items.push({ kind: "html", slide: "realtime-dashboard" });
    } else items.push({ kind: "native", pdfPage });
    if (pdfPage === 4 && isAdmin) items.push({ kind: "html", slide: "idea-results" });
    if (pdfPage === 34) items.push({ kind: "html", slide: "deployment" });
    if (pdfPage === 37) items.push({ kind: "html", slide: "apply-idea" });
  }
  items.push({ kind: "quiz" });
  return items;
}

type SectionTwoDeckItem = { kind: "content"; page: number } | { kind: "showcase" } | { kind: "quiz" };
export const sectionTwoDeckItems: SectionTwoDeckItem[] = [
  ...Array.from({ length: 37 }, (_, index) => ({ kind: "content" as const, page: index + 1 })),
  { kind: "showcase" },
  { kind: "quiz" },
];
