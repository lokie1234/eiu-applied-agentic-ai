"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./AdminWorkspaceNav.module.css";

export default function AdminWorkspaceNav({ onSignOut, showAdmin = false, driveEnabled = true }: { onSignOut?: () => void; showAdmin?: boolean; driveEnabled?: boolean }) {
  async function signOut() {
    if (onSignOut) { onSignOut(); return; }
    const response = await fetch("/api/signout", { method: "POST" });
    if (response.ok) window.location.replace("/");
  }
  return (
    <nav className={styles.nav} aria-label="Workspace navigation">
      {showAdmin && <Link href="/admin/access">Admin workspace</Link>}
      <Link className={styles.learning} href="/learn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v15" /></svg>
        Learning Space
      </Link>
      {driveEnabled && <Link href="/admin/drive"><Image src="/branding/apps/google-drive.svg" width={20} height={20} alt="" />Drive</Link>}
      <Link href="/admin/ai"><span aria-hidden="true">✦</span> AI Knowledge</Link>
      <button type="button" className={styles.signOut} onClick={() => void signOut()}>Sign out</button>
    </nav>
  );
}
