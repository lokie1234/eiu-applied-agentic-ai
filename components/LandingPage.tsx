"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import styles from "./LandingExperience.module.css";
import AnimatedHeroCopy from "./landing/AnimatedHeroCopy";
import EntranceBootOverlay from "./landing/EntranceBootOverlay";
// Keep original SVG bot for reduced-motion fallback
import EiuAgentBot from "./EiuAgentBot";

import { type RobotInteractionState } from "./landing/GuardianRobot3D";

// ── Lazy-load the WebGL scene to avoid SSR hydration issues ──
const HeroScene = dynamic(() => import("./landing/HeroScene"), {
  ssr: false,
  loading: () => null,
});

// ═══════════════════════════════════════════════════════════════
// AUTH & INTERACTION STATE
// ═══════════════════════════════════════════════════════════════
export default function LandingPage({ googleResult }: { googleResult?: string } = {}) {
  // ── Auth & Robot state ──
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(googleResult && googleResult !== "connected" ? googleResult === "wrong-account" ? "Google sign-in is available only for the administrator account." : "Google sign-in did not complete. Please try again." : "");
  const [robotState, setRobotState] = useState<RobotInteractionState>("idle");

  function changePasscode(value: string) {
    setPasscode(value);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const cleanPasscode = passcode.trim();
    if (!/^[A-Za-z0-9-]{4,32}$/.test(cleanPasscode)) {
      setError("Please enter a valid passcode.");
      return;
    }
    setLoading(true);
    setError("");
    setRobotState("loading");

    try {
      const response = await fetch("/api/auth/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: cleanPasscode }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; destination?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Unable to sign in. Please check your passcode.");
      }

      // Xác thực thành công: dạng users hoặc đúng pass admin
      // Kính mặt robo hiện loading.... màu xanh
      setRobotState("loading");
      setTimeout(() => {
        window.location.replace("/learn");
      }, 1500);
    } catch (caught) {
      setRobotState("restricted");
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please verify your credentials.");
      setLoading(false);
      setTimeout(() => setRobotState("idle"), 2800);
    }
  }
  // ═══════════════════════════════════════════════════════════════
  // END AUTH
  // ═══════════════════════════════════════════════════════════════

  // ── 3D & Cinematic Experience State ──
  const prefersReduced = useReducedMotion();

  // Mouse tracking via ref for zero per-frame React re-renders
  const mouseRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }, []);

  // CTA interaction synchronization
  const [isCtaHovered, setIsCtaHovered] = useState(false);
  const ctaPulsed = false;

  // ── Master Cinematic Timeline (Accelerated internal emergence) ──
  // Stage 0: 0.0s   - Environment awake
  // Stage 1: 0.15s  - EIU logo and nav fade in
  // Stage 2: 0.35s  - Eyebrow / Headline lead "Build systems that"
  // Stage 3: 0.65s  - Word "think" reveals -> Robot AI Core pulse
  // Stage 4: 0.95s  - Word "move" reveals -> Orbit system spins up & tagline
  // Stage 5: 1.20s  - Inline Login card emerges right as overlay dissolves!
  // Stage 6: 1.50s  - Workflow synchronization
  // Stage 7: 1.80s  - System stable readiness
  // Stage 8: 2.10s  - Interactive mode active
  // Stage 9: 2.40s  - Full stable idle ambient mode
  const [stage, setStage] = useState(0);
  const reducedMotionReady = Boolean(prefersReduced && stage > 0);

  useEffect(() => {
    if (prefersReduced) {
      const timer = setTimeout(() => setStage(9), 0);
      return () => clearTimeout(timer);
    }

    const timers = [
      setTimeout(() => setStage(1), 150),
      setTimeout(() => setStage(2), 350),
      setTimeout(() => setStage(3), 650),
      setTimeout(() => setStage(4), 950),
      setTimeout(() => setStage(5), 1200),
      setTimeout(() => setStage(6), 1500),
      setTimeout(() => setStage(7), 1800),
      setTimeout(() => setStage(8), 2100),
      setTimeout(() => setStage(9), 2400),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [prefersReduced]);


  // ── Initial Entrance Boot State (Single run per page visit) ──
  const [isEntranceActive, setIsEntranceActive] = useState(true);
  const [isOverlayExiting, setIsOverlayExiting] = useState(false);

  const handleEntranceComplete = useCallback(() => {
    setIsEntranceActive(false);
  }, []);

  const handleEntranceStartExit = useCallback(() => {
    setIsOverlayExiting(true);
  }, []);

  return (
    <main
      className={styles.page}
      onMouseMove={handleMouseMove}
      style={{
        opacity: isOverlayExiting || !isEntranceActive ? 1 : 0.94,
        transform: isOverlayExiting || !isEntranceActive ? "scale(1)" : "scale(0.995)",
        transition: "opacity 0.52s cubic-bezier(0.22, 1, 0.36, 1), transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* ── Temporary Initial Page Entrance Boot Layer (Unmounts permanently upon completion) ── */}
      {isEntranceActive && (
        <EntranceBootOverlay
          onComplete={handleEntranceComplete}
          onStartExit={handleEntranceStartExit}
          prefersReduced={prefersReduced}
        />
      )}
      {/* ── Background layers (Atmosphere) ── */}
      <div className={styles.aurora} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.dataLanes} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.campusOrbit} aria-hidden="true">
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
      </div>

      {/* ── Fullscreen WebGL Hero Scene: Guardian Robot 3D + World Orbits (Unconstrained, Spanning Entire Web Space) ── */}
      {!reducedMotionReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 2,
            pointerEvents: "auto",
          }}
        >
          <HeroScene
            mouseRef={mouseRef}
            stage={stage}
            robotState={robotState}
            isCtaHovered={isCtaHovered}
            ctaPulsed={ctaPulsed}
          />
        </div>
      )}

      {/* ── Navigation (Step 2: Smooth Emergence) ── */}
      <motion.nav
        className={styles.nav}
        initial={{ opacity: 0, y: -16, filter: "blur(4px)" }}
        animate={
          stage >= 1 || reducedMotionReady
            ? { opacity: 1, y: 0, filter: "blur(0px)" }
            : {}
        }
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.logoWrap}>
          <Image
            src="/branding/EIU-logo-white.png"
            alt="Eastern International University"
            width={2048}
            height={2048}
            priority
            unoptimized
          />
        </div>
        <div className={styles.navMeta}><span>INTERACTIVE</span><i />LEARNING SPACE</div>
      </motion.nav>

      {/* ── Hero layout ── */}
      <section className={styles.hero} style={{ position: "relative", zIndex: 5, pointerEvents: "none" }}>
        {/* Left: Copy side with staggered entrance */}
        <div className={styles.copy}>
          <AnimatedHeroCopy
            stage={stage}
            passcode={passcode}
            setPasscode={changePasscode}

            loading={loading}
            error={error}
            onSubmit={submit}
            onMethodChange={() => { setError(""); setPasscode(""); }}
            onInputFocus={() => {
              setIsCtaHovered(true);
              setRobotState((prev) => (prev === "loading" || prev === "processing" || prev === "restricted" ? prev : "lookingAtAccess"));
            }}
            onInputBlur={() => {
              setIsCtaHovered(false);
              setRobotState((prev) => (prev === "loading" || prev === "processing" || prev === "shakeError" || prev === "restricted" ? prev : "idle"));
            }}
            onInputChange={() => {
              setRobotState((prev) => (prev === "loading" || prev === "processing" ? prev : "typing"));
            }}
            onCtaHover={(hovered) => {
              setIsCtaHovered(hovered);
              setRobotState((prev) => {
                if (prev === "loading" || prev === "processing" || prev === "shakeError" || prev === "restricted") return prev;
                if (hovered && prev === "idle") return "lookingAtAccess";
                if (!hovered && prev === "lookingAtAccess") return "idle";
                return prev;
              });
            }}
          />
        </div>

        {/* Right: Overlays / HUD / Fallback */}
        <div
          className={styles.machine}
          style={{ position: "relative", minHeight: 520, pointerEvents: "none" }}
          aria-hidden="true"
        >
          {reducedMotionReady && <EiuAgentBot />}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer} style={{ position: "relative", zIndex: 10, pointerEvents: "auto" }}>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>BUSINESS · TECHNOLOGY · TRANSFORMATION</span>
      </footer>

    </main>
  );
}
