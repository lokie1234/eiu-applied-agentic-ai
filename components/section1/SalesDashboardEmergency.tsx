"use client";

import { useEffect, useRef, useState } from "react";
import { SALES_DASHBOARD_FILES } from "./salesDashboardEmergencyData";
import emergencyStyles from "../section2/SlideTwentyEightEmergency.module.css";
import styles from "./SalesDashboardEmergency.module.css";

type CodeFile = { readonly name: string; readonly code: string };

export default function SalesDashboardEmergency({ files = SALES_DASHBOARD_FILES }: { files?: readonly CodeFile[] }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = panel.current!;
    const opener = trigger.current;
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
      // Keep deck shortcuts from navigating while the panel is open.
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) event.stopPropagation();
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus();
    };
  }, [open]);

  async function copyFile(file: CodeFile) {
    try {
      await navigator.clipboard.writeText(file.code);
      setStatus(`Đã sao chép ${file.name}`);
    } catch {
      setStatus(`Không thể sao chép ${file.name}. Vui lòng thử lại.`);
    }
  }

  return <>
    <button ref={trigger} type="button" className={`${emergencyStyles.trigger} ${styles.trigger}`} data-interactive="true"
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setStatus(""); setOpen(true); }}>
      <span aria-hidden="true">!</span> Emergency
    </button>
    {open && <div className={emergencyStyles.backdrop} data-interactive="true" onMouseDown={() => setOpen(false)}>
      <section ref={panel} className={emergencyStyles.panel} role="dialog" aria-modal="true"
        aria-labelledby="sales-emergency-title" onMouseDown={event => event.stopPropagation()}>
        <button type="button" className={emergencyStyles.close} aria-label="Đóng Emergency" onClick={() => setOpen(false)}>×</button>
        <span className={emergencyStyles.eyebrow}>EIU · COPY CODE</span>
        <h2 id="sales-emergency-title">Emergency</h2>
        <p className={styles.hint}>Bấm vào từng khung để sao chép toàn bộ mã.</p>
        <div className={emergencyStyles.downloads}>
          {files.map(file => <button type="button" key={file.name}
            onClick={() => void copyFile(file)} aria-label={`Sao chép ${file.name}`}>
            <span aria-hidden="true">⧉</span>
            <strong>{file.name}</strong>
            <small>Bấm để sao chép mã</small>
          </button>)}
        </div>
        <div className={styles.status} role="status" aria-live="polite">{status}</div>
      </section>
    </div>}
  </>;
}
