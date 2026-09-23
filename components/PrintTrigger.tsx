"use client";

import styles from "@/app/export-deck/export-deck.module.css";

export default function PrintTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={styles.printButton}
      title="In hoặc Lưu thành PDF"
    >
      <span>⎙</span> In / Lưu PDF
    </button>
  );
}

