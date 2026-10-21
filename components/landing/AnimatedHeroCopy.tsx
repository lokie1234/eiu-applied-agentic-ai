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
  passcode,
  identityFields,
  information,
  onInformationChange,
  onInformationCancel,
  setPasscode,
  loading,
  error = "",
  onSubmit,
  onInputFocus,
  onInputBlur,
  onInputChange,
  onMethodChange,
  onCtaHover,
}: AnimatedHeroCopyProps) {
  const prefersReduced = useReducedMotion();

  // Stage flags based on master sequence
  const showEyebrow = stage >= 2;
  const showHeadlineLead = stage >= 2;
  const showCta = stage >= 5;

  return (
    <div className={styles.copyInner}>
      {/* ── Eyebrow: EIU AI LEARNING SPACE ── */}
      <motion.div
        className={styles.heroEyebrow}
        initial={{ opacity: 0, x: -16, filter: "blur(4px)" }}
        animate={
          showEyebrow || prefersReduced
            ? { opacity: 1, x: 0, filter: "blur(0px)" }
            : {}
        }
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#E9CA8B",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.18em",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 29,
            height: 1,
            background: "#E9CA8B",
            display: "inline-block",
          }}
        />
        EIU AI LEARNING SPACE
        <span
          style={{
            padding: "4px 8px",
            border: "1px solid rgba(233,202,139,.25)",
            borderRadius: 999,
            color: "rgba(255,255,255,.55)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          2026
        </span>
      </motion.div>

      <motion.h1
        className={styles.headline}
        aria-label="Beyond Intelligence. Into Innovation."
        initial={{ opacity: 0, y: 16 }}
        animate={showHeadlineLead || prefersReduced ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: prefersReduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className={styles.headlineLead} aria-hidden="true">Beyond Intelligence</span>
        <span className={styles.headlineAction} aria-hidden="true"><strong>Into Innovation</strong></span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.985, filter: "blur(9px)" }}
        animate={entranceReady && (showCta || prefersReduced)
          ? { opacity: 1, scale: 1, filter: "blur(0px)" }
          : {}}
        transition={{ duration: prefersReduced ? 0 : 1.5, delay: prefersReduced ? 0 : 0.05, ease: [0.25, 0.1, 0.25, 1] }}
        onMouseEnter={() => onCtaHover(true)}
        onMouseLeave={() => onCtaHover(false)}
        className={styles.signInWrap}
      >
        <SignInCard passcode={passcode} setPasscode={setPasscode}
          revealReady={entranceReady && (showCta || Boolean(prefersReduced))}
          identityFields={identityFields} information={information} onInformationChange={onInformationChange} onInformationCancel={onInformationCancel}
          loading={loading} error={error} onSubmit={onSubmit}
          onInputFocus={onInputFocus} onInputBlur={onInputBlur} onInputChange={onInputChange} onMethodChange={onMethodChange} />
      </motion.div>
    </div>
  );
}
