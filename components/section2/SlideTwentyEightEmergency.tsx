"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./SlideTwentyEightEmergency.module.css";

const EMERGENCY_FILES = [
  { key: "config", label: "CONFIG", filename: "GEM_CONFIG.txt" },
  { key: "knowledge", label: "KNOWLEDGE", filename: "KNOWLEDGE_ALL.txt" },
] as const;

export default function SlideTwentyEightEmergency() {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [downloading, setDownloading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isUnlocked) inputRef.current?.focus();
  }, [isOpen, isUnlocked]);

  function closePanel() {
    setIsOpen(false);
    setCode("");
    setIsUnlocked(false);
    setStatus("idle");
    setDownloading(null);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("checking");

    try {
      const response = await fetch("/api/emergency-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setStatus("idle");
      setIsUnlocked(true);
    } catch {
      setStatus("error");
    }
  }

  async function downloadFile(file: (typeof EMERGENCY_FILES)[number]) {
    setDownloading(file.key);

    try {
      const response = await fetch("/api/emergency-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, file: file.key }),
      });

      if (!response.ok) {
        setIsUnlocked(false);
        setStatus("error");
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
            <div className={styles.eyebrow}>EIU · SECURE DOWNLOAD</div>
            <h2 id="emergency-title">Emergency</h2>

            {!isUnlocked ? (
              <form onSubmit={verifyCode}>
                <label htmlFor="emergency-code">Nhập code để tiếp tục</label>
                <div className={styles.codeRow}>
                  <input
                    ref={inputRef}
                    id="emergency-code"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={code}
                    aria-invalid={status === "error"}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 4));
                      setStatus("idle");
                    }}
                  />
                  <button type="submit" disabled={code.length !== 4 || status === "checking"}>
                    {status === "checking" ? "Đang kiểm tra…" : "Mở khóa"}
                  </button>
                </div>
                {status === "error" && <p className={styles.error}>Code không đúng. Vui lòng thử lại.</p>}
              </form>
            ) : (
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
            )}
          </section>
        </div>
      )}
    </>
  );
}
