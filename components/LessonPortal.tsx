"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import type { AccessRole } from "@/lib/access";
import styles from "./LessonPortal.module.css";

const SectionOneDeck = dynamic(() => import("./PdfDeck"), { ssr: false });
const SectionTwoDeck = dynamic(() => import("./section2/SectionTwoDeck"), { ssr: false });

type SectionId = "section1" | "section2";

export default function LessonPortal({ role }: { role: AccessRole }) {
  const [adminSection, setAdminSection] = useState<SectionId | null>(null);
  const section = role === "admin" ? adminSection : role;

  if (role === "admin" && !section) {
    return (
      <main className={styles.portal}>
        <div className={styles.grid} aria-hidden="true" />
        <section className={styles.panel}>
          <div className={styles.brand}>
            <div className={styles.logoWindow}>
              <Image
                src="/branding/EIU-logo-white.png"
                alt="EIU"
                width={2048}
                height={2048}
                priority
                unoptimized
              />
            </div>
            <div>
              <span>ADMIN ACCESS</span>
              <strong>EIU - Applied Agentic AI</strong>
            </div>
          </div>

          <div className={styles.heading}>
            <span>CHỌN NỘI DUNG</span>
            <h1>Bạn muốn mở Section nào?</h1>
            <p>Mã quản trị 1103 có thể xem và chuyển đổi giữa cả hai phần học.</p>
          </div>

          <div className={styles.cards}>
            <button type="button" onClick={() => setAdminSection("section1")}>
              <span>SECTION 1</span>
              <strong>Từ Prompt đến Web App</strong>
              <small>39 slide · PDF + interaction</small>
              <i>→</i>
            </button>
            <button type="button" onClick={() => setAdminSection("section2")}>
              <span>SECTION 2</span>
              <strong>Từ Prompt đến AI Business Framework</strong>
              <small>38 slide · HTML/CSS/React</small>
              <i>→</i>
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (section === "section2") {
    return <SectionTwoDeck onChooseSection={role === "admin" ? () => setAdminSection(null) : undefined} />;
  }

  if (role === "admin") {
    return (
      <div className={styles.deckWrap}>
        <button
          type="button"
          className={styles.sectionSwitch}
          onClick={() => setAdminSection(null)}
        >
          Sections
        </button>
        <SectionOneDeck isAdmin />
      </div>
    );
  }

  return <SectionOneDeck isAdmin={false} />;
}
