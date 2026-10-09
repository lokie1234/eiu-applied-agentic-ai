"use client";

import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import QuizSlide from "@/components/QuizSlide";
import ShowcaseSlide from "@/components/ShowcaseSlide";
import SectionTwoSlide from "./SectionTwoSlide";
import styles from "./SectionTwoDeck.module.css";

const CONTENT_SLIDES = 36;
const SHOWCASE_SLIDE = 37;
const QUIZ_SLIDE = 38;
const TOTAL_SLIDES = QUIZ_SLIDE;
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
      totalSlides={TOTAL_SLIDES}
      frameClassName={styles.frame}
      transitionClassName={styles.slideTransition}
      showWorkshopApps
      renderSlide={(pageNumber, renderWidth) => {
        const scale = renderWidth / SLIDE_WIDTH;
        if (pageNumber === QUIZ_SLIDE) return <QuizSlide scale={scale} variant="section2" isAdmin={isAdmin} />;
        if (pageNumber === SHOWCASE_SLIDE) return <ShowcaseSlide scale={scale} isAdmin={isAdmin} section="section2" />;
        if (pageNumber <= CONTENT_SLIDES) {
          return (
            <div className={styles.canvas} style={{ transform: `scale(${scale})` }}>
              <SectionTwoSlide pageNumber={pageNumber} />
            </div>
          );
        }
        return null;
      }}
    />
  );
}
