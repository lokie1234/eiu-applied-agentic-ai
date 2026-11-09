"use client";

import Image from "next/image";
import styles from "./SectionOneSlide14.module.css";

type Props = {
  scale?: number;
};

function ModelLock() {
  return <svg className={styles.lock} viewBox="0 0 20 20" fill="none" aria-label="Bị khóa" role="img">
    <rect x="4.5" y="8" width="11" height="9" rx="2" />
    <path d="M7 8V5a3 3 0 0 1 6 0v3" />
    <circle cx="10" cy="12.5" r=".8" fill="currentColor" stroke="none" />
  </svg>;
}

export default function SectionOneSlide14({ scale = 1 }: Props) {
  return (
    <section className={styles.slide} style={{ transform: `scale(${scale})` }}>
      <div className={styles.canvas}>
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.trace} aria-hidden="true" />

        <header className={styles.header}>
          <span className={styles.dot} />
          <h1>Bước 1 - Làm quen với Gemini</h1>
        </header>

        <main className={styles.main}>
          <article className={`${styles.appWindow} ${styles.loginWindow}`}>
            <div className={styles.browserBar}>
              <div className={styles.windowDots}><i /><i /><i /></div>
              <div className={styles.addressBar}>
                <Image src="/branding/apps/google-gemini.svg" alt="" width={14} height={14} />
                <span>gemini.google.com</span>
                <b>⋮</b>
              </div>
            </div>

            <div className={styles.loginCard}>
              <div className={styles.brand}>
                <Image src="/branding/apps/google-gemini.svg" alt="Gemini" width={30} height={30} />
                <span>Gemini</span>
              </div>
              <div className={styles.accountPreview}>
                <span className={styles.avatar}>EI</span>
                <div><b>Welcome</b><small>Continue with your Google account</small></div>
              </div>
              <h2>Đăng nhập tài khoản</h2>
              <p>Bắt đầu sử dụng Gemini bằng tài khoản Google</p>
              <button>
                <Image src="/branding/apps/google-g.svg" alt="Google" width={18} height={18} />
                Sign in
              </button>
            </div>
          </article>

          <div className={styles.arrow}>
            <strong>→</strong>
            <span>Chọn model</span>
          </div>

          <article className={`${styles.appWindow} ${styles.modelWindow}`}>
            <div className={styles.browserBar}>
              <div className={styles.windowDots}><i /><i /><i /></div>
              <div className={styles.addressBar}>
                <Image src="/branding/apps/google-gemini.svg" alt="" width={14} height={14} />
                <span>Gemini · New chat</span>
                <b>⋮</b>
              </div>
            </div>

            <div className={styles.modelCard}>
              <div className={styles.promptBar}>
                <span className={styles.addIcon} aria-hidden="true">＋</span>
                <span className={styles.promptPlaceholder}>Ask Gemini</span>
                <span className={styles.modelPicker}>Gemini Auto <span aria-hidden="true">⌃</span></span>
                <svg className={styles.microphone} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="7.5" y="2" width="5" height="10" rx="2.5" />
                  <path d="M5 8v2a5 5 0 0 0 10 0V8M10 15v3" />
                </svg>
              </div>

              <div className={styles.modelMenu}>
                <div role="listbox" aria-label="Model Gemini (minh họa)">
                  <div className={`${styles.item} ${styles.active}`} role="option" aria-selected="true" aria-label="Auto · Gemini 3 models · Đang chọn">
                    <span className={styles.check} aria-hidden="true">✓</span>
                    <div><b>Auto</b><small>Gemini 3 models</small></div>
                    <span className={styles.selectedLabel}>Đang chọn</span>
                  </div>
                  <div className={styles.item} role="option" aria-selected="false" aria-disabled="true">
                    <ModelLock />
                    <div><b>3.1 Pro</b><small>Advanced reasoning</small></div>
                  </div>
                  <div className={styles.item} role="option" aria-selected="false" aria-disabled="true">
                    <ModelLock />
                    <div><b>4 Argon</b><small>Complex tasks</small></div>
                  </div>
                </div>
                <div className={styles.thinkingLevel}><span>Thinking level</span><span aria-hidden="true">›</span></div>
              </div>
            </div>
          </article>
        </main>
      </div>
    </section>
  );
}
