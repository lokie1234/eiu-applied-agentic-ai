"use client";

import { useMemo } from "react";
import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";
import SectionOneHtmlSlide, { type SectionOneHtmlKind } from "@/components/section1/SectionOneHtmlSlide";
import SectionOneNativeSlide from "@/components/section1/SectionOneNativeSlide";
import SectionOneSlide14 from "@/components/section1/SectionOneSlide14";

const SECTION_ONE_PAGE_COUNT = 38;
const SLIDE_WIDTH = 960;

type Props = { isAdmin: boolean; courseTitle?: string; sectionTitle?: string };

type DeckItem =
  | { kind: "native"; pdfPage: number }
  | { kind: "slide14"; slide: "gemini-model" }
  | { kind: "html"; slide: SectionOneHtmlKind }
  | { kind: "showcase" }
  | { kind: "quiz" };

function buildDeckItems(isAdmin: boolean): DeckItem[] {
  const items: DeckItem[] = [];
  for (let pdfPage = 1; pdfPage <= SECTION_ONE_PAGE_COUNT; pdfPage += 1) {
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

export default function PdfDeck({ isAdmin, courseTitle = "Applied Agentic AI", sectionTitle = "Interactive Learning Deck" }: Props) {
  const deckItems = useMemo(() => buildDeckItems(isAdmin), [isAdmin]);
  return (
    <SharedDeckFrame
      courseTitle={courseTitle}
      sectionTitle={sectionTitle}
      totalSlides={deckItems.length}
      showWorkshopApps
      showDemoApp
      renderSlide={(pageNumber, renderWidth) => {
        const currentItem = deckItems[pageNumber - 1];
        const scale = renderWidth / SLIDE_WIDTH;
        if (!currentItem) return <div className="page-loading-shell"><div className="loading-spinner" /></div>;
        if (currentItem.kind === "slide14") return <SectionOneSlide14 scale={scale} />;
        if (currentItem.kind === "showcase") return <ShowcaseSlide scale={scale} isAdmin={isAdmin} />;
        if (currentItem.kind === "quiz") return <QuizSlide scale={scale} isAdmin={isAdmin} />;
        if (currentItem.kind === "html") return <SectionOneHtmlSlide kind={currentItem.slide} scale={scale} isAdmin={isAdmin} />;
        return <SectionOneNativeSlide page={currentItem.pdfPage} scale={scale} courseTitle={courseTitle} />;
      }}
    />
  );
}
