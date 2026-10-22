"use client";

import { motion, useReducedMotion } from "motion/react";
import SignInCard, { type SignInCardProps } from "./SignInCard";
import styles from "../LandingExperience.module.css";

type AnimatedHeroCopyProps = SignInCardProps & {
  stage: number;
  entranceReady?: boolean;
  onCtaHover: (hovered: boolean) => void;
};

export default function AnimatedHeroCopy({
  stage,
  entranceReady = true,
  onCtaHover,
  ...signInProps
}: AnimatedHeroCopyProps) {
  const prefersReduced = useReducedMotion();

  // Stage flags based on master sequence
  const showHeadlineLead = entranceReady && (stage >= 2 || prefersReduced);
  const showCta = stage >= 5;

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

      <motion.div
        inert={!entranceReady || !(showCta || prefersReduced)}
        initial={{ opacity: 0, y: 18, scale: .96 }}
        animate={entranceReady && (showCta || prefersReduced)
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 18, scale: .96 }}
        transition={{ duration: prefersReduced ? .15 : 1.2, delay: prefersReduced ? 0 : .12, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "left top" }}
        onMouseEnter={() => onCtaHover(true)}
        onMouseLeave={() => onCtaHover(false)}
        className={styles.signInWrap}
      >
        <SignInCard {...signInProps} />
      </motion.div>
    </div>
  );
}
