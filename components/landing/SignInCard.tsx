"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import styles from "./SignInCard.module.css";
import type { IdentityField } from "@/lib/learningIdentity";
import LearnerInformationDialog from "./LearnerInformationDialog";

export type SignInCardProps = {
  passcode: string;
  identityFields?: IdentityField[];
  information?: Record<string, string>;
  onInformationChange?: (id: string, value: string) => void;
  onInformationCancel?: () => void;
  setPasscode: (value: string) => void;
  loading: boolean;
  revealReady?: boolean;
  error?: string;
  onSubmit: (event: FormEvent) => void;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  onInputChange?: () => void;
  onMethodChange?: () => void;
};

function GoogleLogo() {
  return <svg className={styles.googleLogo} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.67-.35-3.93H24v7.44h10.99a9.4 9.4 0 0 1-4.08 6.18v5.14h6.61c3.87-3.56 6.09-8.81 6.09-14.83Z" />
    <path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.95l-6.61-5.14c-1.83 1.23-4.17 1.97-6.9 1.97-5.32 0-9.84-3.59-11.46-8.42H5.71v5.3A20 20 0 0 0 24 44Z" />
    <path fill="#FBBC05" d="M12.54 27.46a12 12 0 0 1 0-6.92v-5.3H5.71a20 20 0 0 0 0 17.52l6.83-5.3Z" />
    <path fill="#EA4335" d="M24 12.12c3 0 5.67 1.03 7.8 3.05l5.85-5.85A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.71 15.24l6.83 5.3C14.16 15.71 18.68 12.12 24 12.12Z" />
  </svg>;
}

export default function SignInCard({ passcode, setPasscode, identityFields = [], information = {}, onInformationChange, onInformationCancel, loading, revealReady = true, error = "", onSubmit, onInputFocus, onInputBlur, onInputChange, onMethodChange }: SignInCardProps) {
  const [method, setMethod] = useState<"passcode" | "google" | null>(null);
  const [hasChosenMethod, setHasChosenMethod] = useState(false);
  const passcodeChoice = useRef<HTMLButtonElement>(null);
  const passcodeComplete = /^[0-9]{6}$/.test(passcode);
  const glassFrame = useRef<number | null>(null);
  const glassPointer = useRef({ x: 0, y: 0 });
  const glassMotion = useRef<MediaQueryList | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelAnimations = useRef<Animation[]>([]);
  const previousHeight = useRef<number | null>(null);
  const switching = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    glassMotion.current = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    return () => {
      mounted.current = false;
      if (glassFrame.current !== null) cancelAnimationFrame(glassFrame.current);
      panelAnimations.current.forEach(animation => animation.cancel());
    };
  }, []);
  useLayoutEffect(() => {
    const content = panel.current;
    const startHeight = previousHeight.current;
    if (!content || startHeight === null) return;
    previousHeight.current = null;
    panelAnimations.current.forEach(animation => animation.cancel());
    panelAnimations.current = [];
    const finish = () => {
      if (!mounted.current) return;
      content.style.removeProperty("overflow");
      content.inert = false;
      content.removeAttribute("aria-busy");
      switching.current = false;
      panelAnimations.current.forEach(animation => animation.cancel());
      panelAnimations.current = [];
      if (method === null) passcodeChoice.current?.focus({ preventScroll: true });
      else content.querySelector<HTMLElement>(method === "passcode" ? "input" : "a[href]")?.focus({ preventScroll: true });
    };
    if (typeof content.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const endHeight = content.getBoundingClientRect().height;
    content.style.overflow = "hidden";
    const sizing = content.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
      duration: 360, easing: "cubic-bezier(.22,1,.36,1)",
    });
    const entering = content.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 300, easing: "cubic-bezier(.22,1,.36,1)",
    });
    panelAnimations.current = [sizing, entering];
    void Promise.allSettled([sizing.finished, entering.finished]).then(finish);
  }, [method]);
  function moveGlass(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !glassMotion.current?.matches) return;
    const surface = event.currentTarget;
    glassPointer.current.x = event.clientX;
    glassPointer.current.y = event.clientY;
    if (glassFrame.current !== null) return;
    glassFrame.current = requestAnimationFrame(() => {
      glassFrame.current = null;
      const bounds = surface.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = Math.max(0, Math.min(1, (glassPointer.current.x - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (glassPointer.current.y - bounds.top) / bounds.height));
      surface.style.setProperty("--glass-x", `${x * 100}%`);
      surface.style.setProperty("--glass-y", `${y * 100}%`);
      surface.style.setProperty("--glass-rx", `${(0.5 - y) * 12}deg`);
      surface.style.setProperty("--glass-ry", `${(x - 0.5) * 12}deg`);
    });
  }
  function resetGlass(event: PointerEvent<HTMLElement>) {
    if (glassFrame.current !== null) cancelAnimationFrame(glassFrame.current);
    glassFrame.current = null;
    for (const property of ["--glass-x", "--glass-y", "--glass-rx", "--glass-ry"]) {
      event.currentTarget.style.removeProperty(property);
    }
  }
  async function choose(next: "passcode" | "google" | null) {
    if (loading || switching.current || next === method) return;
    const content = panel.current;
    switching.current = true;
    previousHeight.current = content?.getBoundingClientRect().height ?? 0;
    if (content && typeof content.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      content.inert = true;
      content.setAttribute("aria-busy", "true");
      const leaving = content.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-4px)" }], {
        duration: 150, easing: "ease-out", fill: "forwards",
      });
      panelAnimations.current = [leaving];
      try { await leaving.finished; } catch {
        if (mounted.current) {
          content.inert = false;
          content.removeAttribute("aria-busy");
          previousHeight.current = null;
          switching.current = false;
          panelAnimations.current = [];
        }
        return;
      }
      if (!mounted.current) return;
    }
    onMethodChange?.();
    if (next) setHasChosenMethod(true);
    setMethod(next);
  }
  return <section className={styles.card} data-login-surface="true" data-state={loading ? "loading" : error ? "error" : "ready"} data-entrance={hasChosenMethod ? "settled" : revealReady ? "entering" : "pending"} aria-label={!method ? "Sign in" : undefined} aria-labelledby={method ? "sign-in-heading" : undefined} onPointerEnter={moveGlass} onPointerMove={moveGlass} onPointerLeave={resetGlass} onPointerCancel={resetGlass}>
    <span className={styles.energyFrame} aria-hidden="true" />
    <span className={styles.surfaceLight} aria-hidden="true" />
    <div ref={panel} className={styles.glassContent}>
    {method && <div className={styles.topline}><button className={styles.back} type="button" disabled={loading} onClick={() => choose(null)} aria-label="Back to sign-in options"><span aria-hidden="true">←</span> Back</button></div>}
    {method && <header className={styles.heading}>
      <div className={styles.headingCopy}>
    <h2 id="sign-in-heading">{method === "passcode" ? "Sign in with passcode" : "Sign in with Google"}</h2>
    <p className={styles.intro}>{method === "passcode" ? "Enter your 6-digit passcode." : "Use your EIU administrator account."}</p>
      </div>
    </header>}
    {!method && <div className={styles.choices}>
      <button ref={passcodeChoice} className={styles.choice} type="button" disabled={loading} onClick={() => choose("passcode")}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><span><strong>Passcode</strong><small>Learners & facilitators</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
      <button className={styles.choice} type="button" disabled={loading} onClick={() => choose("google")}><span className={styles.choiceIcon}><GoogleLogo /></span><span><strong>Google</strong><small>Administrator access</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
    </div>}
    {method === "passcode" && <form noValidate className={styles.form} onSubmit={event => { if (loading || !passcodeComplete) { event.preventDefault(); return; } onSubmit(event); }} aria-busy={loading}>
      <label htmlFor="hero-passcode-input">Passcode<input id="hero-passcode-input" aria-invalid={Boolean(error)} aria-describedby={error && !identityFields.length ? "sign-in-error" : undefined} type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} data-complete={passcodeComplete} value={passcode} disabled={loading} onChange={event => { setPasscode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6)); onInputChange?.(); }} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={6} aria-required="true" /></label>
      <button id="landing-access-button" className={styles.primary} type="submit" data-ready={passcodeComplete && !loading} disabled={loading || !passcodeComplete}>{loading ? <><span className={styles.spinner} aria-hidden="true" />Signing in…</> : <>Sign in<span aria-hidden="true">→</span></>}</button>
    </form>}
    {method === "google" && <div className={styles.googlePanel}>
      <div className={styles.accountNote}><span className={styles.accountMark}><GoogleLogo /></span><div><strong>EIU administrator</strong><p>Google sign-in also connects Drive.</p></div></div>
      <a className={styles.googleButton} href="/api/admin/drive/connect?mode=login" aria-disabled={loading || undefined} onClick={event => { if (loading) event.preventDefault(); }}><GoogleLogo /><span>Continue with Google</span></a>
    </div>}
    {error && !identityFields.length && <div id="sign-in-error" className={styles.error} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">!</span>
      <div className={styles.errorContent}>
        <strong>Unable to sign in</strong>
        <p>{error}</p>
      </div>
    </div>}
    <div className={styles.footer}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Secure access <span aria-hidden="true">·</span> <span className={styles.universityName}>Eastern International University</span></span></div>
    </div>
    {identityFields.length > 0 && <LearnerInformationDialog fields={identityFields} information={information} onChange={onInformationChange} onSubmit={onSubmit} onCancel={onInformationCancel} loading={loading} error={error} />}
  </section>;
}
