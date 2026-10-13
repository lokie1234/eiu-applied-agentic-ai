"use client";

import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";
import SectionTwoSlide from "./SectionTwoSlide";
import styles from "./SectionTwoDeck.module.css";
import { sectionTwoDeckItems } from "@/lib/builtinDeckItems";

const SLIDE_WIDTH = 960;

export default function SectionTwoDeck({
  isAdmin = false,
  courseTitle = "Applied Agentic AI",
  sectionTitle = "AI Business Framework",
}: {
  onChooseSection?: () => void;
  isAdmin?: boolean;
  courseTitle?: string;
  sectionTitle?: string;
}) {
  return (
    <SharedDeckFrame
      courseTitle={courseTitle}
      sectionTitle={sectionTitle}
      totalSlides={sectionTwoDeckItems.length}
      frameClassName={styles.frame}
      transitionClassName={styles.slideTransition}
      showWorkshopApps
      renderSlide={(pageNumber, renderWidth) => {
        const scale = renderWidth / SLIDE_WIDTH;
        const item = sectionTwoDeckItems[pageNumber - 1];
        if (item?.kind === "quiz") return <QuizSlide scale={scale} variant="section2" isAdmin={isAdmin} />;
        if (item?.kind === "showcase") return <ShowcaseSlide scale={scale} isAdmin={isAdmin} section="section2" />;
        if (item?.kind === "content") {
          return (
            <div className={styles.canvas} style={{ transform: `scale(${scale})` }}>
              <SectionTwoSlide pageNumber={item.page} />
            </div>
          );
        }
        return null;
      }}
    />
  );
}
