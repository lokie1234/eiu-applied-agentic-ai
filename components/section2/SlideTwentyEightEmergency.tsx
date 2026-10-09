"use client";

import { useState } from "react";
import styles from "./SlideTwentyEightEmergency.module.css";

const EMERGENCY_FILES = [
  { key: "config", label: "SKILL", filename: "SKILL.md" },
] as const;

export default function SlideTwentyEightEmergency() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  function closePanel() {
    setIsOpen(false);
    setHasError(false);
    setDownloading(null);
  }

  async function downloadFile(file: (typeof EMERGENCY_FILES)[number]) {
    setDownloading(file.key);
    setHasError(false);

    try {
      const response = await fetch("/api/emergency-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: file.key }),
      });

      if (!response.ok) {
        setHasError(true);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setHasError(true);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-interactive="true"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <span aria-hidden="true">!</span>
        Emergency
      </button>

      {isOpen && (
        <div className={styles.backdrop} data-interactive="true" onMouseDown={closePanel}>
          <section
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-title"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") closePanel();
            }}
          >
            <button type="button" className={styles.close} aria-label="Đóng" onClick={closePanel}>×</button>
            <div className={styles.eyebrow}>EIU · DOWNLOAD</div>
            <h2 id="emergency-title">Emergency</h2>

            <div className={styles.downloads}>
              {EMERGENCY_FILES.map((file) => (
                <button
                  type="button"
                  key={file.key}
                  disabled={downloading !== null}
                  onClick={() => downloadFile(file)}
                >
                  <span aria-hidden="true">↓</span>
                  <strong>{file.label}</strong>
                  <small>{downloading === file.key ? "Đang tải…" : file.filename}</small>
                </button>
              ))}
            </div>
            {hasError && <p className={styles.error}>Không thể tải file. Vui lòng thử lại.</p>}
          </section>
        </div>
      )}
    </>
  );
}
