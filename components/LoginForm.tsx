"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const ADMIN_QUICK_LOGIN_EMAIL = "son.lam@eiu.edu.vn";

export default function LoginForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  const isAdminQuickLogin = normalizedEmail() === ADMIN_QUICK_LOGIN_EMAIL;

  async function sendOtp(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    const targetEmail = normalizedEmail();
    if (!/^[^@\s]+@eiu\.edu\.vn$/i.test(targetEmail)) {
      setError("Vui lòng dùng email có đúng đuôi @eiu.edu.vn.");
      return;
    }
    setLoading(true);

    try {
      if (targetEmail === ADMIN_QUICK_LOGIN_EMAIL) {
        setEmail(targetEmail);
        setStep("otp");
        setResendIn(0);
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase Auth chưa được cấu hình.");
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: true },
      });
      if (sendError) throw sendError;
      setEmail(targetEmail);
      setStep("otp");
      setResendIn(60);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể gửi mã OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{6,8}$/.test(otp)) {
      setError("Mã OTP phải gồm từ 6 đến 8 chữ số.");
      return;
    }
    setLoading(true);
    try {
      if (isAdminQuickLogin) {
        const response = await fetch("/api/auth/admin-quick-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail(), code: otp }),
        });
        const payload = await response.json() as { success?: boolean; message?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Mã đăng nhập không đúng.");
        }
        window.location.replace("/");
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase Auth chưa được cấu hình.");
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail(),
        token: otp,
        type: "email",
      });
      if (verifyError) throw verifyError;
      window.location.replace("/");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Mã OTP không đúng hoặc đã hết hạn.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-visual">
          <div className="login-brand-row">
            <div className="login-logo-window">
              <Image
                src="/branding/EIU-logo-white.png"
                alt="EIU"
                width={2048}
                height={2048}
                priority
                unoptimized
                className="eiu-original-logo"
              />
            </div>
            <div className="login-brand-divider" />
            <div className="login-brand-copy">
              <span>EASTERN INTERNATIONAL UNIVERSITY</span>
              <strong>Interactive Learning Space</strong>
            </div>
          </div>

          <div className="login-hero-copy">
            <div className="login-eyebrow">EIU LEARNING PORTAL</div>
            <h1>
              Learn. Build.
              <span>Transform.</span>
            </h1>
            <p>One learning space for EIU courses, sections and interactive experiences.</p>
          </div>

          <div className="analytics-scene" aria-hidden="true">
            <div className="analytics-grid" />
            <div className="analytics-board">
              <div className="analytics-board-header">
                <div>
                  <span>LEARNING ACTIVITY</span>
                  <strong>Interactive Journey</strong>
                </div>
                <div className="analytics-live"><i /> LIVE</div>
              </div>

              <div className="analytics-main">
                <div className="analytics-bars">
                  {[38, 54, 45, 72, 63, 88].map((height, index) => (
                    <div
                      key={height + index}
                      className={`analytics-bar${index === 5 ? " featured" : ""}`}
                      style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }}
                    />
                  ))}
                </div>

                <svg className="analytics-line" viewBox="0 0 520 180" preserveAspectRatio="none">
                  <path
                    className="analytics-line-path"
                    d="M 10 142 C 68 128,98 146,140 112 S 222 96,260 102 S 330 52,375 71 S 446 34,510 28"
                  />
                  <circle className="analytics-point point-one" cx="260" cy="102" r="5" />
                  <circle className="analytics-point point-two" cx="375" cy="71" r="5" />
                  <circle className="analytics-point point-three" cx="510" cy="28" r="6" />
                </svg>
              </div>

              <div className="analytics-axis">
                <span>Discover</span><span>Design</span><span>Build</span><span>Scale</span>
              </div>
            </div>

            <div className="floating-kpi kpi-one">
              <span>ENGAGEMENT</span><strong>84%</strong><small>↑ learning progress</small>
            </div>
            <div className="floating-kpi kpi-two">
              <span>LEARNING PACE</span><strong>3.2×</strong><small>faster iteration</small>
            </div>
          </div>

          <div className="login-visual-footer">
            <span>EIU</span>
            <span>EIU Interactive Learning Space</span>
          </div>
        </section>

        <section className="login-access">
          <div className="login-access-inner">
            <div className="login-mobile-logo">
              <div className="login-mobile-logo-window">
                <Image
                  src="/branding/EIU-logo-white.png"
                  alt="EIU"
                  width={2048}
                  height={2048}
                  priority
                  unoptimized
                  className="eiu-original-logo"
                />
              </div>
            </div>

            <div className="login-access-eyebrow">EIU LEARNING ACCESS</div>
            <h2>Welcome to<br />EIU Interactive<br />Learning Space</h2>
            <p className="login-access-description">
              Đăng nhập bằng mã OTP gửi đến email EIU. Không gian học tập chỉ hiển thị những khóa học
              và section đã được admin cấp quyền.
            </p>

            <form className="login-form" onSubmit={step === "email" ? sendOtp : verifyOtp}>
              {step === "email" ? (
                <>
                  <label htmlFor="eiu-email">EMAIL EIU</label>
                  <input
                    id="eiu-email"
                    className="login-email-field"
                    type="email"
                    value={email}
                    autoComplete="email"
                    placeholder="your.name@eiu.edu.vn"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    autoFocus
                    required
                  />
                </>
              ) : (
                <>
                  <div className="otp-heading-row">
                    <label htmlFor="eiu-otp">MÃ OTP</label>
                    <button
                      type="button"
                      className="otp-change-email"
                      onClick={() => {
                        setStep("email");
                        setOtp("");
                        setError("");
                      }}
                    >
                      Đổi email
                    </button>
                  </div>
                  <p className="otp-sent-note">
                    {isAdminQuickLogin ? (
                      <>Nhập mã đăng nhập nhanh dành cho <strong>{email}</strong></>
                    ) : (
                      <>Mã đã được gửi đến <strong>{email}</strong></>
                    )}
                  </p>
                  <input
                    id="eiu-otp"
                    className="login-email-field otp-code-field"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={otp}
                    placeholder="000000"
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 8));
                      setError("");
                    }}
                    autoFocus
                    required
                  />
                </>
              )}

              {error && <div className="login-error"><span>!</span>{error}</div>}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? "Đang xử lý..."
                    : step === "email"
                      ? isAdminQuickLogin ? "Đăng nhập nhanh" : "Gửi mã OTP"
                      : "Xác minh và đăng nhập"}
                </span>
                {!loading && <span className="login-submit-arrow">→</span>}
              </button>

              {step === "otp" && !isAdminQuickLogin && (
                <button
                  type="button"
                  className="otp-resend"
                  disabled={loading || resendIn > 0}
                  onClick={() => void sendOtp()}
                >
                  {resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : "Gửi lại mã OTP"}
                </button>
              )}
            </form>

            <div className="login-browser-note">
              <span className="login-browser-note-icon">✓</span>
              <div>
                <strong>Một tài khoản, nhiều không gian học tập</strong>
                <p>Email @eiu.edu.vn dùng để xác minh; folder khóa học và section do admin quản lý.</p>
              </div>
            </div>

            <div className="login-security-note">Private learning resource · EIU</div>
          </div>
        </section>
      </div>
    </main>
  );
}
