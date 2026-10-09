"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SectionTwoSkillAnatomy.module.css";

const EXAMPLE = `---
name: business-internal-web-app-builder
description: Tạo ứng dụng web nội bộ doanh nghiệp.
---

# Instructions

## Role
Chuyên gia Google Apps Script và Google Sheets.

## Workflow
1. Phân tích yêu cầu.
2. Thiết kế dữ liệu.
3. Xây dựng ứng dụng.
4. Kiểm tra và hướng dẫn triển khai.`;

export default function SectionTwoSkillAnatomy() {
  const [popup, setPopup] = useState<"kebab" | "example" | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!popup) return;
    closeRef.current?.focus();
    return () => triggerRef.current?.focus();
  }, [popup]);
  function open(kind: "kebab" | "example", button: HTMLButtonElement) {
    triggerRef.current = button;
    setPopup(kind);
  }
  return <>
    <div className={styles.grid}>
      <article>
        <header className={styles.cardHead}><span>01</span><h2>NAME</h2></header>
        <div className={styles.cardIcon} aria-hidden="true">Aa</div>
        <div className={styles.cardBody}>Tên viết dạng <button type="button" data-interactive="true" aria-haspopup="dialog" onClick={event => open("kebab", event.currentTarget)}>kebab-case</button></div>
      </article>
      <article>
        <header className={styles.cardHead}><span>02</span><h2>DESCRIPTION</h2></header>
        <div className={styles.cardIcon} aria-hidden="true">≡</div>
        <strong className={styles.cardBody}>Mục đích và <span className={styles.phrase}>khi nào sử dụng</span></strong>
      </article>
      <article className={styles.instructions}>
        <header className={styles.cardHead}><span>03</span><h2>INSTRUCTIONS</h2></header>
        <div className={styles.cardIcon} aria-hidden="true">✓</div>
        <strong className={styles.cardBody}>Quy trình, quy tắc <span className={styles.phrase}>và đầu ra</span></strong>
      </article>
    </div>
    <button type="button" className={styles.exampleButton} data-interactive="true" aria-haspopup="dialog" onClick={event => open("example", event.currentTarget)}>Ví dụ</button>
    {popup && <div className={styles.overlay} data-interactive="true" onClick={event => { if (event.target === event.currentTarget) setPopup(null); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") setPopup(null);
      if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); }
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="SKILL-anatomy-title">
        <header><h2 id="SKILL-anatomy-title">{popup === "kebab" ? "kebab-case" : "Ví dụ · SKILL.md"}</h2><button type="button" ref={closeRef} onClick={() => setPopup(null)}>Close ×</button></header>
        {popup === "example" ? <pre>{EXAMPLE}</pre> : <div className={styles.kebab}>
          <p>Viết tên bằng chữ thường, dùng dấu gạch nối <b>-</b> giữa các từ; không dùng dấu cách hoặc dấu tiếng Việt.</p>
          <code>business-internal-web-app-builder</code><code>leave-request-manager</code><code>incident-reporting</code>
          <p>Ví dụ: <span>Leave Request Manager</span> → <b>leave-request-manager</b></p>
        </div>}
      </section>
    </div>}
  </>;
}
