"use client";

import { motion, useReducedMotion } from "motion/react";
import btnStyles from "./AccessButton.module.css";

interface AnimatedHeroCopyProps {
  stage: number;
  email: string;
  setEmail: (val: string) => void;
  adminPassword?: string;
  setAdminPassword?: (val: string) => void;
  isAdminEmail?: boolean;
  loading: boolean;
  error?: string;
  onSubmit: (e: React.FormEvent) => void;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  onInputChange?: () => void;
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
  loading,
  error = "",
  onSubmit,
  onInputFocus,
  onInputBlur,
  onInputChange,
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

      {/* ── EIU DNA INLINE LOGIN CARD (Replaces CTA button directly) ── */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={
          showCta || prefersReduced
            ? { opacity: 1, y: 0, scale: 1 }
            : {}
        }
        transition={{
          duration: 0.42,
          ease: [0.22, 1, 0.36, 1],
        }}
        onMouseEnter={() => onCtaHover(true)}
        onMouseLeave={() => onCtaHover(false)}
        style={{
          marginTop: 26,
          width: "100%",
          maxWidth: 460,
          background:
            "linear-gradient(145deg, rgba(8, 41, 69, 0.82) 0%, rgba(4, 28, 49, 0.94) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(233, 202, 139, 0.35)",
          borderRadius: 22,
          padding: "20px 22px",
          boxShadow:
            "0 20px 48px rgba(0, 0, 0, 0.52), 0 0 35px rgba(233, 202, 139, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient gold corner accent light */}
        <div
          style={{
            position: "absolute",
            top: -24,
            right: -24,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(233, 202, 139, 0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Login Form */}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {/* Email Address */}
          <div>
            <label
              htmlFor="hero-email-input"
              style={{
                display: "block",
                marginBottom: 5,
                color: "#F4DFB0",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
              }}
            >
              Email Address
            </label>
            <input
              id="hero-email-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                onInputChange?.();
              }}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              placeholder="name@gmail.com or student@eiu.edu.vn"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="email"
              required
              style={{
                width: "100%",
                height: 48,
                padding: "0 16px",
                background: "rgba(3, 20, 34, 0.75)",
                border: "1px solid rgba(233, 202, 139, 0.28)",
                borderRadius: 12,
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
          </div>

          {/* Administrator Password */}
          {isAdminEmail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.24 }}
            >
              <label
                htmlFor="hero-admin-pass-input"
                style={{
                  display: "block",
                  marginBottom: 5,
                  color: "#F4DFB0",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                }}
              >
                Administrator Password
              </label>
              <input
                id="hero-admin-pass-input"
                type="password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword?.(e.target.value);
                  onInputChange?.();
                }}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                placeholder="Enter administrator password"
                autoComplete="current-password"
                required
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  background: "rgba(3, 20, 34, 0.75)",
                  border: "1px solid rgba(233, 202, 139, 0.28)",
                  borderRadius: 12,
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </motion.div>
          )}

          {/* Error Notice */}
          {error && (
            <div
              role="alert"
              style={{
                padding: "8px 14px",
                borderRadius: 9,
                background: "rgba(166, 47, 55, 0.25)",
                border: "1px solid rgba(248, 113, 113, 0.45)",
                color: "#FCA5A5",
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Action: Access Courses with Dynamic System Running Animations */}
          <button
            id="landing-access-button"
            type="submit"
            disabled={loading || !email.trim() || Boolean(isAdminEmail && !adminPassword?.trim())}
            className={`${btnStyles.btn} ${loading ? btnStyles.btnRunning : ""} ${
              !email.trim() || (isAdminEmail && !adminPassword?.trim()) ? btnStyles.btnDisabled : ""
            }`}
            onMouseEnter={() => onCtaHover(true)}
            onMouseLeave={() => onCtaHover(false)}
          >
            {/* Ambient Shimmer Beam on Idle, Rapid Laser Beam when System Running */}
            {loading ? (
              <span className={btnStyles.runningLaserBeam} aria-hidden="true" />
            ) : (
              <span className={btnStyles.shimmerBeam} aria-hidden="true" />
            )}

            {/* Bottom Real-time Data Stream Line when Running */}
            {loading && <span className={btnStyles.dataStreamLine} aria-hidden="true" />}

            {/* Action Label & Status Indicators */}
            <div className={btnStyles.labelWrap}>
              {loading && <span className={btnStyles.runningDotPulse} aria-hidden="true" />}
              <span className={btnStyles.labelText}>
                {loading ? "Accessing Courses" : "Access Courses"}
              </span>
              {loading && (
                <span className={btnStyles.runningDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>

            {/* Right Badge Icon: Arrow on idle, High-tech orbital spinner when Running */}
            <div className={btnStyles.badgeIcon} aria-hidden="true">
              {loading ? (
                <span className={btnStyles.badgeSpinner} />
              ) : (
                <span>→</span>
              )}
            </div>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
