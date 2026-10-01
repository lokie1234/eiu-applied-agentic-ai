"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import styles from "./LandingExperience.module.css";
import AgentHud from "./landing/AgentHud";
import AnimatedHeroCopy from "./landing/AnimatedHeroCopy";
// Keep the original EiuAgentBot for reduced-motion fallback
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

  // ── 3D experience state ──
  const prefersReduced = useReducedMotion();

  // Mouse tracking via ref — no React setState per frame
  const mouseRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }, []);

  // Cinematic intro sequence
  const [revealed, setRevealed] = useState(false);
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    // Step 1: Short delay then reveal robot + copy
    const t1 = setTimeout(() => setRevealed(true), 400);
    // Step 2: HUD cards appear after the heading word "move" would have animated in
    const t2 = setTimeout(() => setShowCards(true), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // CTA click: brief pulse then open modal (existing auth)
  const [ctaPulsed, setCtaPulsed] = useState(false);
  const handleCtaClick = useCallback(() => {
    setCtaPulsed(true);
    setTimeout(() => {
      setCtaPulsed(false);
      open();
    }, 280);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className={styles.page} onMouseMove={handleMouseMove}>
      {/* ── Background layers (unchanged) ── */}
      <div className={styles.aurora} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.dataLanes} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.campusOrbit} aria-hidden="true">
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
      </div>

      {/* ── Navigation ── */}
      <motion.nav
        className={styles.nav}
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
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
        {/* Copy side */}
        <div className={styles.copy}>
          <AnimatedHeroCopy onCtaClick={handleCtaClick} revealed={revealed} />
        </div>

        {/* 3D Scene side — replaces old .machine for capable devices */}
        <div
          className={styles.machine}
          style={{ position: "relative" }}
          aria-hidden="true"
        >
          {prefersReduced ? (
            /* Reduced-motion fallback: keep existing SVG robot */
            <EiuAgentBot />
          ) : (
            <>
              {/* WebGL Guardian Robot + World */}
              <HeroScene mouseRef={mouseRef} showCards={showCards} />
              {/* DOM HUD overlay */}
              <AgentHud showCards={showCards} />

              {/* CTA energy pulse ring — triggered on click */}
              <AnimatePresence>
                {ctaPulsed && (
                  <motion.div
                    key="ctaPulse"
                    initial={{ opacity: 0.8, scale: 0.4 }}
                    animate={{ opacity: 0, scale: 2.2 }}
                    exit={{}}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      inset: "50%",
                      width: 180,
                      height: 180,
                      marginLeft: -90,
                      marginTop: -90,
                      borderRadius: "50%",
                      border: "2px solid #e9ca8b",
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
