"use client";

import Link from "next/link";
import styles from "./AdminAccessPortal.module.css";

export default function CourseManagerHeader({
  identity, onSignOut,
}: {
  identity: string;
  onSignOut: () => void;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTitleGroup}>
        <span>EIU · LEARNING PLATFORM ADMINISTRATION</span>
        <h1>Admin Control Center</h1>
        <p>Admin: <b>{identity}</b> · Passcode Access & Course Management</p>
      </div>
      <nav className={styles.headerNav} aria-label="Workspace navigation">
        <Link href="/learn">Learning Space</Link>
        <Link href="/admin/drive">Google Drive</Link>
        <Link href="/admin/ai">✦ AI Knowledge</Link>
        <button type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </header>
  );
}
