"use client";

import { useReducedMotion } from "motion/react";
import SignInCard, { type SignInCardProps } from "./SignInCard";
import styles from "../LandingExperience.module.css";
import type { RefObject } from "react";
import type { LearningLanguage } from "@/lib/learningLanguage";
import EiuAgentBot from "../EiuAgentBot";

type AnimatedHeroCopyProps = SignInCardProps & {
  stage: number;
  entranceReady?: boolean;
  introPhase: "arriving" | "choosing" | "returning" | "ready";
  languageAnchor: RefObject<HTMLDivElement | null>;
  languageScreen: RefObject<HTMLDivElement | null>;
  onChooseLanguage: (language: LearningLanguage) => void;
  showFallbackRobot?: boolean;
  onCtaHover: (hovered: boolean) => void;
};

export default function AnimatedHeroCopy({
  stage,
  entranceReady = true,
  introPhase,
  languageAnchor,
  languageScreen,
  onChooseLanguage,
  showFallbackRobot = false,
  onCtaHover,
  ...signInProps
}: AnimatedHeroCopyProps) {
  const prefersReduced = useReducedMotion();

  // Stage flags based on master sequence
  const showHeadlineLead = entranceReady && (stage >= 2 || prefersReduced);
  const languageSelected = introPhase === "returning" || introPhase === "ready";
  const showCta = stage >= 5 && languageSelected;

  return (
    <div className={styles.copyInner}>
      <h1
        className={styles.headline}
        data-revealed={Boolean(showHeadlineLead)}
        aria-label="Beyond Intelligence. Into Innovation."
      >
        <span className={styles.headlineLead} aria-hidden="true">Beyond Intelligence</span>
        <span className={styles.headlineAction} data-depth="Into Innovation" aria-hidden="true"><strong>Into Innovation</strong></span>
      </h1>

      {!languageSelected && <div ref={languageAnchor} className={styles.robotLanguageStage} data-phase={introPhase} aria-label="Chọn ngôn ngữ · Choose your language">
        {showFallbackRobot && entranceReady && <div className={styles.languageFallbackRobot}><EiuAgentBot reducedMotion /></div>}
        <div ref={languageScreen} className={styles.robotLanguageChoices} data-fallback={showFallbackRobot} inert={!entranceReady || introPhase !== "choosing"} data-visible={entranceReady && introPhase === "choosing"}>
          <button type="button" lang="vi" aria-label="Tiếng Việt" onClick={() => onChooseLanguage("vi")}>VIE</button>
          <button type="button" lang="en" aria-label="English" onClick={() => onChooseLanguage("en")}>ENG</button>
        </div>
      </div>}
      {languageSelected && <div
        inert={!entranceReady || !showCta}
        data-login-visible={entranceReady && showCta}
        onMouseEnter={() => onCtaHover(true)}
        onMouseLeave={() => onCtaHover(false)}
        className={`${styles.signInWrap} ${styles.loginReveal}`}
      >
        <SignInCard {...signInProps} />
      </div>}
    </div>
  );
}
