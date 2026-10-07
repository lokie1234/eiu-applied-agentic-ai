"use client";
import styles from "./AdminAccessPortal.module.css";

export default function VisibilityToggle({ hidden, label, disabled, busy, onToggle }: {
  hidden: boolean;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  const action = `${hidden ? "Unhide" : "Hide"} ${label}`;
  return (
    <button type="button" className={`${styles.visibilityToggle} ${hidden ? styles.visibilityToggleHidden : ""}`}
      title={action} aria-label={action} aria-pressed={hidden} disabled={disabled} onClick={event => { event.stopPropagation(); onToggle(); }}>
      {busy ? <span className={styles.btnSpinnerSm} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="m3 3 18 18" />}
      </svg>}
    </button>
  );
}
