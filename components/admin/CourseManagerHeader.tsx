"use client";

import AdminWorkspaceNav from "./AdminWorkspaceNav";
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
      <AdminWorkspaceNav onSignOut={onSignOut} />
    </header>
  );
}
