"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        let message = "Access code không đúng.";
        try {
          const data = await response.json();
          if (typeof data?.message === "string") message = data.message;
        } catch {
          // Keep the default message.
        }
        setError(message);
        setLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Không thể kết nối tới server.");
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
              <strong>Applied Agentic AI</strong>
            </div>
          </div>

          <div className="login-hero-copy">
            <div className="login-eyebrow">BUSINESS × AI</div>
            <h1>
              Turn ideas into
              <span>working solutions.</span>
            </h1>
            <p>Two interactive sections for Applied Agentic AI.</p>
          </div>

          <div className="analytics-scene" aria-hidden="true">
            <div className="analytics-grid" />
            <div className="analytics-board">
              <div className="analytics-board-header">
                <div>
                  <span>WORKFLOW ACTIVITY</span>
                  <strong>AI Transformation</strong>
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
              <span>AUTOMATION</span><strong>84%</strong><small>↑ workflow impact</small>
            </div>
            <div className="floating-kpi kpi-two">
              <span>BUILD SPEED</span><strong>3.2×</strong><small>faster iteration</small>
            </div>
          </div>

          <div className="login-visual-footer">
            <span>EIU</span>
            <span>Applied Agentic AI · Sections 1 &amp; 2</span>
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

            <div className="login-access-eyebrow">SESSION ACCESS</div>
            <h2>Welcome to<br />Applied Agentic AI</h2>
            <p className="login-access-description">
              Enter your access code to open the assigned learning section.
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              <label htmlFor="access-code">ACCESS CODE</label>
              <div className="login-code-field">
                <input
                  id="access-code"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="••••"
                  value={code}
                  autoFocus
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                />
                <div className="login-code-status">4-digit code</div>
              </div>

              {error && <div className="login-error"><span>!</span>{error}</div>}

              <button type="submit" className="login-submit" disabled={loading || code.length !== 4}>
                <span>{loading ? "Checking access..." : "Enter Session"}</span>
                {!loading && <span className="login-submit-arrow">→</span>}
              </button>
            </form>

            <div className="login-browser-note">
              <span className="login-browser-note-icon">✓</span>
              <div>
                <strong>One-time access</strong>
                <p>This browser will remember your access after successful login.</p>
              </div>
            </div>

            <div className="login-security-note">Private learning resource · EIU</div>
          </div>
        </section>
      </div>
    </main>
  );
}
