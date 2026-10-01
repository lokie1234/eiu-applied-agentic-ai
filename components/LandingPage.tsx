"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import styles from "./LandingExperience.module.css";
import AgentHud from "./landing/AgentHud";
import AnimatedHeroCopy from "./landing/AnimatedHeroCopy";
// Keep original SVG bot for reduced-motion fallback
import EiuAgentBot from "./EiuAgentBot";

// ── Lazy-load the WebGL scene to avoid SSR hydration issues ──
const HeroScene = dynamic(() => import("./landing/HeroScene"), {
  ssr: false,
  loading: () => null,
});

// ═══════════════════════════════════════════════════════════════
// AUTH — DO NOT MODIFY
// ═══════════════════════════════════════════════════════════════
type Modal = "access" | null;
const SAVED_EMAIL_KEY = "eiu_learner_saved_email";

export default function LandingPage() {
  // ── Auth state (UNTOUCHED) ──
  const [modal, setModal] = useState<Modal>(null);
  const [email, setEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdminEmail = email.trim().toLowerCase() === "son.lam@eiu.edu.vn";

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
    if (!modal || loading) return;
    setLoading(true);
    setError("");
    try {
      const cleanEmail = email.trim();
      const cleanAdminPassword = adminPassword.trim();
      const response = await fetch("/api/auth/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, adminPassword: cleanAdminPassword }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; destination?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Unable to sign in. Please check your email.");
      }
      try {
        localStorage.setItem(SAVED_EMAIL_KEY, cleanEmail);
      } catch {}
      window.location.replace(payload.destination === "/admin/access" ? "/admin/access" : "/learn");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please verify your credentials.");
      setLoading(false);
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
  const [ctaPulsed, setCtaPulsed] = useState(false);

  // ── Master Cinematic Timeline (0.0s - 4.0s) ──
  // Stage 0: 0.0s  - Environment awake
  // Stage 1: 0.3s  - EIU logo and nav fade in
  // Stage 2: 0.6s  - Robot emergence begins + Eyebrow/Headline lead
  // Stage 3: 1.3s  - Word "think" reveals -> Robot AI Core pulse
  // Stage 4: 1.85s - Word "move" reveals -> Orbit system spins up
  // Stage 5: 2.4s  - Workflow: INPUT card activates
  // Stage 6: 2.9s  - Workflow: PROCESS card activates
  // Stage 7: 3.35s - Workflow: OUTPUT card activates
  // Stage 8: 3.6s  - CTA button enters with soft spring
  // Stage 9: 4.0s  - Stable idle ambient mode
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (prefersReduced) {
      setStage(9);
      return;
    }

    const timers = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 600),
      setTimeout(() => setStage(3), 1300),
      setTimeout(() => setStage(4), 1850),
      setTimeout(() => setStage(5), 2400),
      setTimeout(() => setStage(6), 2900),
      setTimeout(() => setStage(7), 3350),
      setTimeout(() => setStage(8), 3600),
      setTimeout(() => setStage(9), 4000),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [prefersReduced]);

  // CTA click: short 320ms energy scan pulse then trigger auth modal
  const handleCtaClick = useCallback(() => {
    setCtaPulsed(true);
    setTimeout(() => {
      setCtaPulsed(false);
      open();
    }, 320);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className={styles.page} onMouseMove={handleMouseMove}>
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
      <section className={styles.hero}>
        {/* Left: Copy side with staggered entrance */}
        <div className={styles.copy}>
          <AnimatedHeroCopy
            onCtaClick={handleCtaClick}
            onCtaHover={setIsCtaHovered}
            stage={stage}
          />
        </div>

        {/* Right: 3D Scene side with Guardian Robot & Spatial AI World */}
        <div
          className={styles.machine}
          style={{ position: "relative", minHeight: 520 }}
          aria-hidden="true"
        >
          {prefersReduced ? (
            <EiuAgentBot />
          ) : (
            <>
              {/* WebGL Hero Scene: Guardian Robot 3D + World Orbits */}
              <HeroScene
                mouseRef={mouseRef}
                stage={stage}
                isCtaHovered={isCtaHovered}
                ctaPulsed={ctaPulsed}
              />

              {/* Spatial HUD Overlay (INPUT -> PROCESS -> OUTPUT) */}
              <AgentHud stage={stage} />

              {/* Energy Pulse Ring on CTA Click */}
              <AnimatePresence>
                {ctaPulsed && (
                  <motion.div
                    key="ctaPulse"
                    initial={{ opacity: 0.85, scale: 0.35 }}
                    animate={{ opacity: 0, scale: 2.4 }}
                    exit={{}}
                    transition={{ duration: 0.52, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      inset: "50%",
                      width: 220,
                      height: 220,
                      marginLeft: -110,
                      marginTop: -110,
                      borderRadius: "50%",
                      border: "2px solid #E9CA8B",
                      boxShadow: "0 0 45px rgba(233, 202, 139, 0.6)",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
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
              <p>{isAdminEmail ? "Enter your administrator password to sign in." : "Enter your authorized email to access the courses."}</p>
              <form onSubmit={submit}>
                <div className={styles.inputGroup}>
                  <label htmlFor="login-email">EMAIL ADDRESS</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); setError(""); }}
                    placeholder="name@gmail.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>

                {isAdminEmail && (
                  <div className={styles.inputGroup}>
                    <label htmlFor="login-admin-pass">ADMINISTRATOR PASSWORD</label>
                    <input
                      id="login-admin-pass"
                      type="password"
                      value={adminPassword}
                      onChange={(event) => { setAdminPassword(event.target.value); setError(""); }}
                      placeholder="Enter admin password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                )}

                {error && <div className={styles.error} role="alert">{error}</div>}

                <button type="submit" disabled={loading || !email.trim() || (isAdminEmail && !adminPassword.trim())}>
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
