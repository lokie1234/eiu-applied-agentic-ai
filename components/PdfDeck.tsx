"use client";

import { useMemo } from "react";
import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";
import SectionOneHtmlSlide from "@/components/section1/SectionOneHtmlSlide";
import SectionOneNativeSlide from "@/components/section1/SectionOneNativeSlide";
import SectionOneSlide14 from "@/components/section1/SectionOneSlide14";
import { buildSectionOneDeckItems } from "@/lib/builtinDeckItems";

const SLIDE_WIDTH = 960;

type Props = { isAdmin: boolean; courseTitle?: string; sectionTitle?: string };

export default function PdfDeck({ isAdmin, courseTitle = "Applied Agentic AI", sectionTitle = "Interactive Learning Deck" }: Props) {
  const deckItems = useMemo(() => buildSectionOneDeckItems(isAdmin), [isAdmin]);
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
