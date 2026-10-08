"use client";

import Link from "next/link";
import styles from "./AdminAccessPortal.module.css";

export default function CourseManagerHeader({
  role, identity, onSignOut,
}: {
  role: "admin" | "teacher";
  identity: string;
  onSignOut: () => void;
}) {
  const isAdmin = role === "admin";
  return (
    <header className={styles.header}>
      <div className={styles.headerTitleGroup}>
        <span>EIU · LEARNING PLATFORM {isAdmin ? "ADMINISTRATION" : "TEACHING"}</span>
        <h1>{isAdmin ? "Admin Control Center" : "Teacher Workspace"}</h1>
        <p>{isAdmin ? "Admin" : "Teacher"}: <b>{identity}</b> · {isAdmin ? "Centralized Learner Access & Course Management" : "Course Setup & Content Management"}</p>
      </div>
      <nav className={styles.headerNav} aria-label="Workspace navigation">
        <Link href="/learn">Learning Space</Link>
        <Link href="/change-password">Change password</Link>
        {isAdmin && <Link href="/admin/drive">Google Drive</Link>}
        {isAdmin && <Link href="/admin/ai">✦ AI Knowledge</Link>}
        <button type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </header>
  );
}
