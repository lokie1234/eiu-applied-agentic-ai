"use client";
import { useEffect, useId, useRef } from "react";
import styles from "./AdminAccessPortal.module.css";
export type EiuDialogState = {
  isOpen: boolean; title: string; message: string; detail?: string;
  confirmLabel?: string; cancelLabel?: string; variant?: "danger" | "gold" | "warning" | "info";
  isAlert?: boolean; onConfirm?: () => void | Promise<void>;
};
export default function EiuConfirmDialog({ dialog, onClose }: { dialog: EiuDialogState; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId(); const messageId = useId();
  useEffect(() => {
    if (!dialog.isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    card.current?.querySelector<HTMLButtonElement>('[data-confirm="true"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = card.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [dialog.isOpen, onClose]);
  return <>      {dialog.isOpen && (
        <div className={styles.eiuModalBackdrop} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} onClick={onClose}>
          <div ref={card} className={styles.eiuModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.eiuModalHeader}>
              <div className={styles.eiuModalBadgeRow}>
                <span className={styles.eiuModalBrandTag}>EIU SYSTEM GOVERNANCE</span>
                <span className={dialog.variant === "danger" ? styles.eiuModalBadgeDanger : styles.eiuModalBadgeGold}>
                  {dialog.variant === "danger" ? "DANGER ZONE" : "NOTICE"}
                </span>
              </div>
              <div className={styles.eiuModalTitleRow}>
                <div className={dialog.variant === "danger" ? styles.eiuModalIconDanger : styles.eiuModalIconGold}>
                  {dialog.variant === "danger" ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  )}
                </div>
                <h3 id={titleId}>{dialog.title}</h3>
              </div>
            </div>

            <div className={styles.eiuModalBody}>
              <p id={messageId} className={styles.eiuModalMessage}>{dialog.message}</p>
              {dialog.detail && (
                <div className={styles.eiuModalDetailBox}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{dialog.detail}</span>
                </div>
              )}
            </div>

            <div className={styles.eiuModalFooter}>
              {!dialog.isAlert && (
                <button
                  type="button"
                  className={styles.eiuModalBtnCancel}
                  onClick={onClose}
                >
                  {dialog.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                type="button"
                className={dialog.variant === "danger" ? styles.eiuModalBtnDanger : styles.eiuModalBtnConfirm}
                onClick={async () => {
                  const onConfirmFn = dialog.onConfirm;
                  onClose();
                  if (onConfirmFn) {
                    await onConfirmFn();
                  }
                }}
                data-confirm="true"
              >
                {dialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}</>;
}
