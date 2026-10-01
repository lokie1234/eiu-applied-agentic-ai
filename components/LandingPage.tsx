"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import EiuAgentBot from "./EiuAgentBot";
import styles from "./LandingExperience.module.css";

type Modal = "access" | null;

const SAVED_EMAIL_KEY = "eiu_learner_saved_email";

export default function LandingPage() {
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

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.dataLanes} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.campusOrbit} aria-hidden="true">
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
      </div>
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <Image src="/branding/EIU-logo-white.png" alt="Eastern International University" width={2048} height={2048} priority unoptimized />
        </div>
        <div className={styles.navMeta}><span>INTERACTIVE</span><i />LEARNING SPACE</div>
      </nav>

      {/* Autonomous EIU Agent Bot roving the layout */}
      <EiuAgentBot />

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.eyebrow}><i /> EIU AI LEARNING SPACE <span>2026</span></div>
          <h1><span>Build systems that</span><span><em>think</em> and <strong>move</strong></span></h1>
          <p className={styles.tagline}>Turn ideas into intelligent, automated workflows</p>
          <div className={styles.actions}>
            <button
              id="landing-access-button"
              className={styles.accessButton}
              type="button"
              onClick={open}
              aria-label="Access courses"
            >
              <span className={styles.accessButtonLabel}>Access courses</span>
              <span className={styles.accessButtonIcon}>↗</span>
            </button>
            <span className={styles.accessNote}>Sign in with email<br />to view courses</span>
          </div>
        </div>

        <div className={styles.machine} aria-hidden="true">
          <div className={styles.orbit}><i /><i /><i /></div>
          <div className={styles.core}><span>AI</span><small>AGENT ONLINE</small></div>
          <div className={`${styles.signalCard} ${styles.cardOne}`}><i />INPUT <strong>Intent detected</strong></div>
          <div className={`${styles.signalCard} ${styles.cardTwo}`}><i />PROCESS <strong>Workflow running</strong></div>
          <div className={`${styles.signalCard} ${styles.cardThree}`}><i />OUTPUT <strong>Action complete</strong></div>
          <svg className={styles.connector} viewBox="0 0 600 600"><path d="M70 172 C180 172 168 290 270 290" /><path d="M330 290 C440 290 420 112 548 112" /><path d="M330 312 C452 312 424 474 548 474" /></svg>
        </div>
      </section>

      <footer className={styles.footer}><span>EASTERN INTERNATIONAL UNIVERSITY</span><span>BUSINESS · TECHNOLOGY · TRANSFORMATION</span></footer>

      {modal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="access-title">
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
          </section>
        </div>
      )}
    </main>
  );
}
