"use client";

import styles from "./SectionOneSlide14.module.css";

type Props = {
  scale?: number;
};

export default function SectionOneSlide14({ scale = 1 }: Props) {
  return (
    <section className={styles.slide} style={{ transform: `scale(${scale})` }}>
      <div className={styles.canvas}>
        <header className={styles.header}>
          <span className={styles.dot} />
          <h1>Bước 1 - Làm quen với Gemini</h1>
        </header>

        <main className={styles.main}>
          <div className={styles.loginCard}>
            <div className={styles.brand}>✦ Gemini</div>
            <h2>Đăng nhập tài khoản</h2>
            <p>Bắt đầu sử dụng Gemini bằng tài khoản Google</p>
            <button>Sign in</button>
          </div>

          <div className={styles.arrow}>
            <strong>→</strong>
            <span>Chọn model</span>
          </div>

          <div className={styles.modelCard}>
            <h3>Gemini Model</h3>

            <div className={styles.item}>
              <b>3.6 Flash</b>
              <small>Fast response</small>
            </div>

            <div className={`${styles.item} ${styles.active}`}>
              <b>3.6 Thinking ✓</b>
              <small>Complex problem solving</small>
              <label>Recommended</label>
            </div>

            <div className={styles.item}>
              <b>3.1 Pro</b>
              <small>Advanced AI</small>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
