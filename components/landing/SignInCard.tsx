"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./SignInCard.module.css";

export type SignInCardProps = {
  email: string;
  setEmail: (value: string) => void;
  adminPassword?: string;
  setAdminPassword?: (value: string) => void;
  isAdminEmail?: boolean;
  requiresPassword?: boolean;
  loading: boolean;
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

export default function SignInCard({ email, setEmail, adminPassword = "", setAdminPassword, isAdminEmail = false, requiresPassword = isAdminEmail, loading, error = "", onSubmit, onInputFocus, onInputBlur, onInputChange, onMethodChange }: SignInCardProps) {
  const [method, setMethod] = useState<"username" | "google" | null>(null);
  const unregisteredEmail = error.match(/^Email "([^"]+)" has not been granted access\./)?.[1];
  const usernameChoice = useRef<HTMLButtonElement>(null);
  function choose(next: "username" | "google" | null) {
    if (loading) return;
    onMethodChange?.();
    setMethod(next);
    if (next === null) requestAnimationFrame(() => usernameChoice.current?.focus());
  }
  return <section className={styles.card} aria-labelledby="sign-in-heading">
    <div className={styles.topline}><span className={styles.eyebrow}>EIU LEARNING SPACE</span>{method && <button className={styles.back} type="button" disabled={loading} onClick={() => choose(null)} aria-label="Back to sign-in options"><span aria-hidden="true">←</span> Back</button>}</div>
    <header className={styles.heading}>
      <div className={styles.headingCopy}>
    <h2 id="sign-in-heading">{method === "username" ? "Sign in with username" : method === "google" ? "Sign in with Google" : "Welcome back"}</h2>
    <p className={styles.intro}>{method === "username" ? "Use your registered email as your username." : method === "google" ? "Administrator access with your EIU Google account." : "Choose how you would like to sign in."}</p>
      </div>
      <span className={styles.headingMark} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 8h8l3 3 3-3h8v17h-8l-3 2-3-2H5V8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M16 11v16M9 13h3M9 17h3M20 13h3M20 17h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span>
    </header>
    {!method && <div className={styles.choices}>
      <button ref={usernameChoice} className={styles.choice} type="button" disabled={loading} onClick={() => choose("username")}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><span><strong>Username</strong><small>Sign in with your registered account</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
      <button className={styles.choice} type="button" disabled={loading} onClick={() => choose("google")}><span className={styles.choiceIcon}><GoogleLogo /></span><span><strong>Google</strong><small>Administrator account only</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
    </div>}
    {method === "username" && <form noValidate className={styles.form} onSubmit={onSubmit} aria-busy={loading}>
      <label htmlFor="hero-email-input">Username<input id="hero-email-input" aria-invalid={Boolean(error)} aria-describedby={error ? "sign-in-error" : undefined} type="email" value={email} disabled={loading} onChange={event => { setEmail(event.target.value); onInputChange?.(); }} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Your registered email address" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus aria-required="true" /></label>
      {requiresPassword && <label htmlFor="hero-admin-pass-input">{isAdminEmail ? "Administrator password" : "Teacher password"}<input id="hero-admin-pass-input" type="password" value={adminPassword} disabled={loading} onChange={event => { setAdminPassword?.(event.target.value); onInputChange?.(); }} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Enter your password" autoComplete="current-password" aria-required="true" /></label>}
      <button id="landing-access-button" className={styles.primary} type="submit" disabled={loading || !email.trim() || Boolean(requiresPassword && !adminPassword.length)}>{loading ? <><span className={styles.spinner} aria-hidden="true" />Signing in…</> : <>Sign in<span aria-hidden="true">→</span></>}</button>
    </form>}
    {method === "google" && <div className={styles.googlePanel}>
      <div className={styles.accountNote}><span className={styles.accountMark}><GoogleLogo /></span><div><strong>EIU administrator</strong><p>Your Google sign-in also connects Drive.</p></div></div>
      <a className={styles.googleButton} href="/api/admin/drive/connect?mode=login" aria-disabled={loading || undefined} onClick={event => { if (loading) event.preventDefault(); }}><GoogleLogo /><span>Continue with Google</span></a>
      <p className={styles.googleNote}>Only the authorized administrator Google account can continue.</p>
    </div>}
    {error && <div id="sign-in-error" className={styles.error} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">!</span>
      <div className={styles.errorContent}>
        <strong>{unregisteredEmail ? "Account not registered" : "Unable to sign in"}</strong>
        {unregisteredEmail ? <><span className={styles.errorEmail}>{unregisteredEmail}</span><p>This email has not been granted access. Please contact your instructor or administrator to register your account.</p></> : <p>{error}</p>}
      </div>
    </div>}
    <div className={styles.footer}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Secure access · Eastern International University</span></div>
  </section>;
}
