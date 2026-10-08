"use client";

import { motion, useReducedMotion } from "motion/react";
import SignInCard from "./SignInCard";

interface AnimatedHeroCopyProps {
  stage: number;
  email: string;
  setEmail: (val: string) => void;
  adminPassword?: string;
  setAdminPassword?: (val: string) => void;
  isAdminEmail?: boolean;
  requiresPassword?: boolean;
  loading: boolean;
  error?: string;
  onSubmit: (e: React.FormEvent) => void;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  onInputChange?: () => void;
  onMethodChange?: () => void;
  onCtaHover: (hovered: boolean) => void;
}

// Staggered word-by-word reveal helper
function SplitHeadline({
  children,
  delay = 0,
}: {
  children: string;
  delay?: number;
}) {
  const words = children.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", marginRight: "0.24em" }}
          initial={{ opacity: 0, y: 22, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.45,
            delay: delay + i * 0.06,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

export default function AnimatedHeroCopy({
  stage,
  email,
  setEmail,
  adminPassword = "",
  setAdminPassword,
  isAdminEmail = false,
  requiresPassword = isAdminEmail,
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
  const showThink = stage >= 3;
  const showMove = stage >= 4;
  const showTagline = stage >= 4;
  const showCta = stage >= 5;

  return (
    <div style={{ position: "relative", zIndex: 3 }}>
      {/* ── Eyebrow: EIU AI LEARNING SPACE ── */}
      <motion.div
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

      {/* ── Headline: Build systems that think and move ── */}
      <h1
        style={{
          margin: "24px 0 28px",
          fontSize: "clamp(54px, 4.8vw, 86px)",
          lineHeight: 0.98,
          letterSpacing: "-0.055em",
          fontWeight: 680,
        }}
      >
        <span style={{ display: "block", whiteSpace: "nowrap" }}>
          {showHeadlineLead && (
            <SplitHeadline>Build systems that</SplitHeadline>
          )}
        </span>

        <span style={{ display: "block", marginTop: 4 }}>
          {/* Word: think (triggers robot AI core pulse) */}
          {showThink && (
            <motion.em
              style={{
                fontFamily: "Georgia, serif",
                fontWeight: 400,
                color: "#F4DFB0",
                fontStyle: "italic",
                display: "inline-block",
                textShadow: "0 0 32px rgba(244,223,176,.32)",
              }}
              initial={{ opacity: 0, scale: 0.88, filter: "blur(5px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{
                duration: 0.48,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              think
            </motion.em>
          )}

          {/* Word: and */}
          {showMove && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ color: "rgba(255,255,255,0.6)", margin: "0 0.2em" }}
            >
              and
            </motion.span>
          )}

          {/* Word: move (triggers orbit system spin-up) */}
          {showMove && (
            <motion.strong
              style={{
                color: "#2D7FB4",
                fontWeight: 760,
                textShadow: "0 0 42px rgba(45,127,180,.35)",
                display: "inline-block",
              }}
              initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.48,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              move
            </motion.strong>
          )}
        </span>
      </h1>

      {/* ── Tagline ── */}
      <motion.p
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={
          showTagline || prefersReduced
            ? { opacity: 1, y: 0, filter: "blur(0px)" }
            : {}
        }
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          maxWidth: 620,
          margin: 0,
          color: "rgba(255,255,255,.68)",
          fontSize: 17,
          lineHeight: 1.7,
        }}
      >
        Turn ideas into intelligent, automated workflows
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={showCta || prefersReduced ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => onCtaHover(true)}
        onMouseLeave={() => onCtaHover(false)}
        style={{ marginTop: 26, width: "100%", maxWidth: 460 }}
      >
        <SignInCard email={email} setEmail={setEmail} adminPassword={adminPassword} setAdminPassword={setAdminPassword}
          isAdminEmail={isAdminEmail} requiresPassword={requiresPassword} loading={loading} error={error} onSubmit={onSubmit}
          onInputFocus={onInputFocus} onInputBlur={onInputBlur} onInputChange={onInputChange} onMethodChange={onMethodChange} />
      </motion.div>
    </div>
  );
}
