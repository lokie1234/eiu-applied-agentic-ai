"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import styles from "./LandingExperience.module.css";

type Modal = "access" | null;
export default function LandingPage() {
  const [modal, setModal] = useState<Modal>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  function open() {
    setModal("access"); setValue(""); setError(""); setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!modal || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const payload = await response.json() as { success?: boolean; message?: string; destination?: string };
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to continue.");
      window.location.replace(payload.destination === "/admin/access" ? "/admin/access" : "/learn");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue."); setLoading(false);
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
        <div className={styles.navMeta}><span>APPLIED AGENTIC AI</span><i />LEARNING EXPERIENCE</div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.eyebrow}><i /> EIU AI LEARNING SPACE <span>2026</span></div>
          <h1><span>Build systems that</span><span><em>think</em> and <strong>move</strong></span></h1>
          <p className={styles.tagline}>Turn ideas into intelligent, automated workflows</p>
          <div className={styles.actions}>
            <button className={styles.accessButton} type="button" onClick={open}>
              <span>Access learning space</span><b>↗</b>
            </button>
            <span className={styles.accessNote}>Use the shared passcode<br />for your course folder</span>
          </div>
        </div>

        <div className={styles.machine} aria-hidden="true">
          <div className={styles.orbit}><i /><i /><i /></div>
          <div className={styles.core}><span>AI</span><small>AGENT ONLINE</small></div>
          <div className={`${styles.signalCard} ${styles.cardOne}`}><i />INPUT <strong>Intent detected</strong></div>
          <div className={`${styles.signalCard} ${styles.cardTwo}`}><i />PROCESS <strong>Workflow running</strong></div>
          <div className={`${styles.signalCard} ${styles.cardThree}`}><i />OUTPUT <strong>Action complete</strong></div>
          <div className={styles.telemetry}><span>LIVE ORCHESTRATION</span><i /><i /><i /><i /><i /></div>
          <svg className={styles.connector} viewBox="0 0 600 600"><path d="M70 172 C180 172 168 290 270 290" /><path d="M330 290 C440 290 420 112 548 112" /><path d="M330 312 C452 312 424 474 548 474" /></svg>
        </div>
      </section>

      <footer className={styles.footer}><span>EASTERN INTERNATIONAL UNIVERSITY</span><span>BUSINESS · TECHNOLOGY · TRANSFORMATION</span></footer>

      {modal && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="access-title">
          <button className={styles.close} type="button" onClick={() => setModal(null)} aria-label="Close">×</button>
          <span>SECURE ACCESS</span>
          <h2 id="access-title">Open learning space</h2>
          <p>Enter your access code to continue.</p>
          <form onSubmit={submit}>
            <label htmlFor="access-value">ACCESS CODE</label>
            <input id="access-value" type="password" value={value}
              onChange={(event) => { setValue(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              inputMode="numeric" pattern="(?:[0-9]{4}|[0-9]{6})" maxLength={6} autoComplete="one-time-code" aria-label="Access code" autoFocus required />
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button type="submit" disabled={loading || !value.trim()}>{loading ? "Verifying…" : "Continue"}<b>→</b></button>
          </form>
          <small className={styles.secure}>ENCRYPTED · SERVER VERIFIED · 12H SESSION</small>
        </section>
      </div>}
    </main>
  );
}
