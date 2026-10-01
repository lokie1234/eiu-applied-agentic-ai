"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";

interface AnimatedHeroCopyProps {
  onCtaClick: () => void;
  /** True once the cinematic intro should reveal */
  revealed: boolean;
}

// Staggered word-by-word reveal helper
function SplitHeadline({
  children,
  delay,
}: {
  children: string;
  delay: number;
}) {
  const words = children.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", marginRight: "0.24em" }}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: delay + i * 0.08,
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
  onCtaClick,
  revealed,
}: AnimatedHeroCopyProps) {
  const prefersReduced = useReducedMotion();
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Magnetic CTA hover
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (prefersReduced || !ctaRef.current) return;
    const rect = ctaRef.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) * 0.12;
    const dy = (e.clientY - rect.top - rect.height / 2) * 0.12;
    ctaRef.current.style.transform = `translate(${dx}px, ${dy}px) translateY(-4px) scale(1.025)`;
  };
  const handleMouseLeave = () => {
    if (!ctaRef.current) return;
    ctaRef.current.style.transform = "";
  };

  const base = prefersReduced ? 0 : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={revealed ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.85, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "relative", zIndex: 3 }}
    >
      {/* Eyebrow */}
      <motion.div
        className="hero-eyebrow"
        initial={{ opacity: 0, x: -18 }}
        animate={revealed ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.55, delay: base * 0.4 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#e9ca8b",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.18em",
          marginBottom: 4,
        }}
      >
        <span style={{ width: 29, height: 1, background: "#e9ca8b", display: "inline-block" }} />
        EIU AI LEARNING SPACE
        <span
          style={{
            padding: "4px 7px",
            border: "1px solid rgba(233,202,139,.2)",
            borderRadius: 999,
            color: "rgba(255,255,255,.46)",
            fontSize: 8,
          }}
        >
          2026
        </span>
      </motion.div>

      {/* Headline */}
      <h1
        style={{
          margin: "26px 0 30px",
          fontSize: "clamp(55px, 4.9vw, 88px)",
          lineHeight: 0.96,
          letterSpacing: "-0.055em",
          fontWeight: 680,
        }}
      >
        <span style={{ display: "block", whiteSpace: "nowrap" }}>
          {revealed && (
            <SplitHeadline delay={base * 0.55}>Build systems that</SplitHeadline>
          )}
        </span>
        <span style={{ display: "block" }}>
          {revealed && (
            <>
              <motion.em
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: 400,
                  color: "#f4dfb0",
                  fontStyle: "italic",
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: base * 0.82, ease: [0.22, 1, 0.36, 1] }}
              >
                think
              </motion.em>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: base * 0.92 }}
                style={{ color: "rgba(255,255,255,0.6)", margin: "0 0.18em" }}
              >
                and
              </motion.span>
              <motion.strong
                style={{
                  color: "#64a8d3",
                  fontWeight: 760,
                  textShadow: "0 0 44px rgba(45,127,180,.18)",
                }}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.65, delay: base * 1.02, ease: [0.22, 1, 0.36, 1] }}
              >
                move
              </motion.strong>
            </>
          )}
        </span>
      </h1>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={revealed ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: base * 1.15, ease: [0.22, 1, 0.36, 1] }}
        style={{
          maxWidth: 620,
          margin: 0,
          color: "rgba(255,255,255,.64)",
          fontSize: 17,
          lineHeight: 1.72,
        }}
      >
        Turn ideas into intelligent, automated workflows
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={revealed ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: base * 1.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 26 }}
      >
        <button
          id="landing-access-button"
          ref={ctaRef}
          type="button"
          onClick={onCtaClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-label="Access courses"
          style={{
            position: "relative",
            minWidth: 310,
            height: 72,
            padding: "0 12px 0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            background: "linear-gradient(135deg,#fff7e8 0%,#f4dfb0 40%,#e9ca8b 80%,#dfb86c 100%)",
            color: "#082945",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 0 28px rgba(233,202,139,.45), 0 18px 45px rgba(0,0,0,.35)",
            transition: "box-shadow 0.3s ease, transform 0.28s cubic-bezier(0.2,0.85,0.32,1.2)",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: "clamp(21px,1.4vw,25px)",
              fontWeight: 850,
              letterSpacing: "-0.025em",
              color: "#082945",
              whiteSpace: "nowrap",
            }}
          >
            Access courses
          </span>
          <span
            style={{
              width: 48,
              height: 48,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "#082945",
              color: "#f4dfb0",
              fontSize: 22,
              fontWeight: 850,
              flexShrink: 0,
            }}
          >
            ↗
          </span>
        </button>

        <span
          style={{
            color: "rgba(255,255,255,.36)",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1.55,
            letterSpacing: "0.08em",
          }}
        >
          Sign in with email
          <br />
          to view courses
        </span>
      </motion.div>
    </motion.div>
  );
}

