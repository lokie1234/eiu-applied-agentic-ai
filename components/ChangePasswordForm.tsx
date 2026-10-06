"use client";
import { useState, type FormEvent } from "react";
import styles from "./admin/TeacherAccounts.module.css";
import layout from "./TeacherPortal.module.css";
export default function ChangePasswordForm({ required, isAdmin = false }: { required: boolean; isAdmin?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmPassword: confirmation, ...(isAdmin ? { currentPassword } : {}) }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message);
      window.location.replace(data.destination);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to change your password."); setBusy(false); }
  }
  return <main className={layout.passwordPage}><section className={`${styles.card} ${layout.passwordCard}`}><h1>{required ? "Set your password" : "Change password"}</h1><p>{required ? "Change your temporary password before using your teacher account." : "Choose a new password for your account."} There are no minimum-length or character requirements.</p><form className={styles.form} onSubmit={submit}>
    {isAdmin && <label>CURRENT PASSWORD<input className={styles.input} type={show ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required maxLength={1024} /></label>}
    <label>NEW PASSWORD<input className={styles.input} type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={1024} /></label>
    <label>CONFIRM PASSWORD<input className={styles.input} type={show ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required maxLength={1024} /></label>
    <button className={styles.button} type="button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide password" : "Show password"}</button>
    {error && <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p>}<button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save password and continue"}</button>
  </form><button className={styles.button} disabled={busy} onClick={async () => { await fetch("/api/signout", { method: "POST" }); window.location.replace("/"); }}>Sign out</button></section></main>;
}
