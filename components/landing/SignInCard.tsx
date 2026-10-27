"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useLearningLanguage } from "@/lib/learningLanguage";
import { useGlassInteraction } from "./useGlassInteraction";
import styles from "./SignInCard.module.css";
import type { IdentityField } from "@/lib/learningIdentity";
import LearnerInformationDialog from "./LearnerInformationDialog";

export type SignInCardProps = {
  initialLanguageChosen?: boolean;
  passcode: string;
  identityFields?: IdentityField[];
  information?: Record<string, string>;
  onInformationChange?: (id: string, value: string) => void;
  onInformationCancel?: () => void;
  setPasscode: (value: string) => void;
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

export default function SignInCard({ initialLanguageChosen = false, passcode, setPasscode, identityFields = [], information = {}, onInformationChange, onInformationCancel, loading, error = "", onSubmit, onInputFocus, onInputBlur, onInputChange, onMethodChange }: SignInCardProps) {
  const { language, setLanguage, t } = useLearningLanguage();
  const [languageChosen, setLanguageChosen] = useState(initialLanguageChosen);
  const [method, setMethod] = useState<"passcode" | "google" | null>(null);
  const passcodeChoice = useRef<HTMLButtonElement>(null);
  const passcodeComplete = /^[0-9]{6}$/.test(passcode);
  const [showPasscode, setShowPasscode] = useState(false);
  const passcodeForm = useRef<HTMLFormElement>(null);
  const autoSubmittedCode = useRef<string | null>(null);
  useEffect(() => {
    if (!languageChosen || method !== "passcode" || !passcodeComplete) {
      autoSubmittedCode.current = null;
      return;
    }
    if (loading || identityFields.length > 0 || autoSubmittedCode.current === passcode) return;
    autoSubmittedCode.current = passcode;
    passcodeForm.current?.requestSubmit();
  }, [passcode, passcodeComplete, languageChosen, method, loading, identityFields.length]);
  const glass = useGlassInteraction();
  const panel = useRef<HTMLDivElement>(null);
  const panelAnimations = useRef<Animation[]>([]);
  const previousHeight = useRef<number | null>(null);
  const switching = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
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
      if (!languageChosen) content.querySelector<HTMLElement>("button[lang]")?.focus({ preventScroll: true });
      else if (method === null) passcodeChoice.current?.focus({ preventScroll: true });
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
  }, [method, languageChosen]);
  async function choose(next: "passcode" | "google" | null, nextLanguage?: "vi" | "en") {
    if (loading || switching.current || (!nextLanguage && next === method)) return;
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
    setShowPasscode(false);
    if (nextLanguage) {
      setLanguage(nextLanguage);
      setLanguageChosen(true);
      return;
    }
    onMethodChange?.();
    setMethod(next);
  }
  return <section className={styles.card} data-step={languageChosen ? "login" : "language"} {...glass} data-login-surface="true" data-state={loading ? "loading" : error ? "error" : "ready"} lang={language} aria-label={!languageChosen ? "Chọn ngôn ngữ · Choose your language" : !method ? t("Sign in") : undefined} aria-labelledby={languageChosen && method ? "sign-in-heading" : undefined}>
    <div className={styles.glassRig}>
    <span className={styles.glassShell} aria-hidden="true">
      <span className={styles.energyFrame} />
      <span className={styles.surfaceLight} />
    </span>
    <div ref={panel} className={styles.glassContent} data-login-content>
    {!languageChosen ? <div className={styles.languageChoices}>
        {([{ code: "vi", name: "VIE" }, { code: "en", name: "ENG" }] as const).map(option =>
          <button key={option.code} type="button" className={styles.languageChoice} lang={option.code} onClick={() => choose(method, option.code)}>
            <strong>{option.name}</strong>
          </button>)}
    </div> : <>
    <div className={styles.topline}>
      {method && <button className={styles.back} type="button" disabled={loading} onClick={() => choose(null)} aria-label={t("Back to sign-in options")}><span aria-hidden="true">←</span> {t("Back")}</button>}
      <div className={styles.languageSwitch} role="group" aria-label={t("Language", "Ngôn ngữ")}>
        {(["vi", "en"] as const).map(code => <button key={code} className={styles.languageToggle} type="button" data-login-language={code} disabled={loading} aria-pressed={language === code} onClick={() => setLanguage(code)}>
          {code === "vi" ? t("Vietnamese", "Tiếng Việt") : t("English", "Tiếng Anh")}
        </button>)}
      </div>
    </div>
    {method && <header className={styles.heading}>
      <div className={styles.headingCopy}>
    <h2 id="sign-in-heading">{method === "passcode" ? t("Sign in with passcode") : t("Sign in with Google")}</h2>
    <p className={styles.intro}>{method === "passcode" ? t("Enter your 6-digit passcode.") : t("Use your EIU administrator account.")}</p>
      </div>
    </header>}
    {!method && <div className={styles.choices}>
      <button ref={passcodeChoice} className={styles.choice} type="button" disabled={loading} onClick={() => choose("passcode")}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><span><strong>{t("Passcode")}</strong><small>{t("Learners & facilitators")}</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
      <button className={styles.choice} type="button" disabled={loading} onClick={() => choose("google")}><span className={styles.choiceIcon}><GoogleLogo /></span><span><strong>Google</strong><small>{t("Administrator access")}</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
    </div>}
    {method === "passcode" && <form ref={passcodeForm} noValidate className={styles.form} onSubmit={event => { if (loading || !passcodeComplete) { event.preventDefault(); return; } onSubmit(event); }} aria-busy={loading}>
      <label htmlFor="hero-passcode-input">{t("Passcode")}</label>
      <div className={styles.passcodeField} data-error={Boolean(error) && !loading}>
      <input id="hero-passcode-input" aria-invalid={Boolean(error)} aria-describedby={error && !identityFields.length ? "sign-in-error" : undefined} type={showPasscode ? "text" : "password"} inputMode="numeric" pattern="[0-9]{6}" minLength={6} data-complete={passcodeComplete} value={passcode} disabled={loading} onChange={event => { setPasscode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6)); onInputChange?.(); }} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={6} aria-required="true" />
      <button className={styles.passcodeToggle} type="button" aria-controls="hero-passcode-input" aria-pressed={showPasscode} aria-label={showPasscode ? t("Hide passcode", "Ẩn mã") : t("Show passcode", "Hiện mã")} onClick={() => setShowPasscode(current => !current)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPasscode && <path d="m3 3 18 18"/>}</svg>
      </button>
      </div>
    </form>}
    {method === "google" && <div className={styles.googlePanel}>
      <div className={styles.accountNote}><span className={styles.accountMark}><GoogleLogo /></span><div><strong>{t("EIU administrator")}</strong><p>{t("Google sign-in also connects Drive.")}</p></div></div>
      <a className={styles.googleButton} href="/api/admin/drive/connect?mode=login" aria-disabled={loading || undefined} onClick={event => { if (loading) event.preventDefault(); }}><GoogleLogo /><span>{t("Continue with Google")}</span></a>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0", color: "#a0b8cc", fontSize: "12px" }}>
        <span style={{ flex: 1, height: "1px", background: "rgba(217, 239, 255, 0.2)" }} />
        <span>{t("or admin password", "hoặc mật khẩu admin")}</span>
        <span style={{ flex: 1, height: "1px", background: "rgba(217, 239, 255, 0.2)" }} />
      </div>
      <form noValidate className={styles.form} onSubmit={onSubmit} aria-busy={loading}>
        <label htmlFor="admin-password-input" className={styles.screenReaderOnly}>{t("Admin password", "Mật khẩu quản trị")}</label>
        <div className={styles.passcodeField} data-error={Boolean(error) && !loading}>
          <input
            id="admin-password-input"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "sign-in-error" : undefined}
            type={showPasscode ? "text" : "password"}
            value={passcode}
            disabled={loading}
            onChange={event => { setPasscode(event.target.value.slice(0, 32)); onInputChange?.(); }}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            placeholder={t("Admin password", "Mật khẩu quản trị")}
            autoComplete="current-password"
            aria-required="true"
          />
          <button
            className={styles.passcodeToggle}
            type="button"
            aria-controls="admin-password-input"
            aria-pressed={showPasscode}
            aria-label={showPasscode ? t("Hide password", "Ẩn mật khẩu") : t("Show password", "Hiện mật khẩu")}
            onClick={() => setShowPasscode(current => !current)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPasscode && <path d="m3 3 18 18"/>}</svg>
          </button>
        </div>
        <button type="submit" className={styles.primary} disabled={loading || !passcode.trim()}>
          {loading ? <span className={styles.spinner} /> : <span>{t("Sign in as Admin", "Đăng nhập quản trị")}</span>}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </div>}
    {error && !identityFields.length && <span id="sign-in-error" className={styles.screenReaderOnly} role="alert">{error === "Wrong passcode" ? error : t(error)}</span>}
    <div className={styles.footer}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>{t("Secure access")} <span aria-hidden="true">·</span> <span className={styles.universityName}>Eastern International University</span></span></div>
    </>}
    </div>
    </div>
    {languageChosen && identityFields.length > 0 && <LearnerInformationDialog fields={identityFields} information={information} onChange={onInformationChange} onSubmit={onSubmit} onCancel={onInformationCancel} loading={loading} error={error} />}
  </section>;
}
