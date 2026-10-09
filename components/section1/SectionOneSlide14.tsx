"use client";

import Image from "next/image";
import styles from "./SectionOneSlide14.module.css";

type Props = {
  scale?: number;
};

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
              <div className={styles.modelHeader}>
                <Image src="/branding/apps/google-gemini.svg" alt="Gemini" width={25} height={25} />
                <div><small>SELECT MODEL</small><h3>Gemini Model</h3></div>
                <span>⌄</span>
              </div>

              <div className={styles.item}>
                <span className={styles.modelGlyph}>⚡</span>
                <div><b>3.5 Flash-Lite</b><small>Fastest answers</small></div>
              </div>

              <div className={`${styles.item} ${styles.active}`}>
                <span className={styles.modelGlyph}>✦</span>
                <div><b>3.6 Flash ✓</b><small>All-around help</small></div>
                <label>Recommended</label>
              </div>

              <div className={styles.item}>
                <span className={styles.modelGlyph}>◆</span>
                <div><b>3.1 Pro</b><small>Advanced reasoning</small></div>
              </div>
            </div>
          </article>
        </main>
      </div>
    </section>
  );
}
