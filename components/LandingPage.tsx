"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
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
type Modal = "access" | null;
const SAVED_EMAIL_KEY = "eiu_learner_saved_email";

export default function LandingPage({ googleResult }: { googleResult?: string } = {}) {
  // ── Auth & Robot state ──
  const [modal, setModal] = useState<Modal>(null);
  const [email, setEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [teacherPasswordEmail, setTeacherPasswordEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(googleResult && googleResult !== "connected" ? googleResult === "wrong-account" ? "Google sign-in is available only for the administrator account." : "Google sign-in did not complete. Please try again." : "");
  const [robotState, setRobotState] = useState<RobotInteractionState>("idle");

  const isAdminEmail = email.trim().toLowerCase() === "son.lam@eiu.edu.vn";
  const requiresPassword = isAdminEmail || Boolean(teacherPasswordEmail && teacherPasswordEmail === email.trim().toLowerCase());

  function changeEmail(value: string) {
    setEmail(value);
    setTeacherPasswordEmail("");
    setAdminPassword("");
    setError("");
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  function open() {
    setModal("access");
    try {
      const saved = localStorage.getItem(SAVED_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
    setAdminPassword("");
    setError("");
    setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim();
    const cleanAdminPassword = adminPassword;
    if (!cleanEmail) return;

    const isUserType = cleanEmail.toLowerCase() !== "son.lam@eiu.edu.vn";
    if (requiresPassword && !cleanAdminPassword) return;

    setLoading(true);
    setError("");

    // Dạng users: Bấm access code -> kính mặt robo hiện loading.... màu xanh ngay!
    // Admin: robot chuyển sang processing để kiểm tra pass trước, đúng pass mới hiện loading xanh
    if (isUserType) {
      setRobotState("loading");
    } else {
      setRobotState("processing");
    }

    try {
      const response = await fetch("/api/auth/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, adminPassword: cleanAdminPassword }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; destination?: string; requireTeacherPassword?: boolean };
      if (payload.requireTeacherPassword) {
        setTeacherPasswordEmail(cleanEmail.toLowerCase());
        setRobotState("lookingAtAccess");
        setLoading(false);
        return;
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Unable to sign in. Please check your email.");
      }

      // Xác thực thành công: dạng users hoặc đúng pass admin
      // Kính mặt robo hiện loading.... màu xanh
      setRobotState("loading");
      if (modal) {
        setModal(null);
      }
      try {
        localStorage.setItem(SAVED_EMAIL_KEY, cleanEmail);
      } catch {}

      const destination = ["/admin/access", "/teacher", "/change-password"].includes(payload.destination ?? "") ? payload.destination! : "/learn";
      setTimeout(() => {
        window.location.replace(destination);
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

  useEffect(() => {
    if (prefersReduced) {
      setStage(9);
      return;
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
      {!prefersReduced && (
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
          stage >= 1 || prefersReduced
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
            email={email}
            setEmail={changeEmail}
            adminPassword={adminPassword}
            setAdminPassword={(val) => {
              setAdminPassword(val);
              setError("");
            }}
            isAdminEmail={isAdminEmail}
            requiresPassword={requiresPassword}
            loading={loading}
            error={error}
            onSubmit={submit}
            onMethodChange={() => { setError(""); setAdminPassword(""); }}
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
          {prefersReduced && <EiuAgentBot />}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer} style={{ position: "relative", zIndex: 10, pointerEvents: "auto" }}>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>BUSINESS · TECHNOLOGY · TRANSFORMATION</span>
      </footer>

      {/* ══════════════════════════════════════════════════════════
           AUTH MODAL — DO NOT MODIFY
          ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key="modalBackdrop"
            className={styles.modalBackdrop}
            role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.section
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="access-title"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.2, 0.85, 0.32, 1.22] }}
            >
              <button className={styles.close} type="button" onClick={() => setModal(null)} aria-label="Close">×</button>
              <span>SECURE ACCESS</span>
              <h2 id="access-title">Sign In</h2>
              <p>{requiresPassword ? `Enter your ${isAdminEmail ? "administrator" : "teacher"} password to sign in.` : "Enter your authorized email to access the courses."}</p>
              <form onSubmit={submit}>
                <div className={styles.inputGroup}>
                  <label htmlFor="login-email">EMAIL ADDRESS</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => changeEmail(event.target.value)}
                    placeholder="name@gmail.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>

                {requiresPassword && (
                  <div className={styles.inputGroup}>
                    <label htmlFor="login-admin-pass">{isAdminEmail ? "ADMINISTRATOR PASSWORD" : "TEACHER PASSWORD"}</label>
                    <input
                      id="login-admin-pass"
                      type="password"
                      value={adminPassword}
                      onChange={(event) => { setAdminPassword(event.target.value); setError(""); }}
                      placeholder={isAdminEmail ? "Enter administrator password" : "Enter teacher password"}
                      autoComplete="current-password"
                      autoFocus
                      required
                    />
                  </div>
                )}

                {error && <div className={styles.error} role="alert">{error}</div>}

                <button type="submit" disabled={loading || !email.trim() || (requiresPassword && !adminPassword.length)}>
                  {loading ? "Verifying…" : "Continue"}<b>→</b>
                </button>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
