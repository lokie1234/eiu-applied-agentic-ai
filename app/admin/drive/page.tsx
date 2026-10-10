import DriveWorkspaceNav from "@/components/admin/DriveWorkspaceNav";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { authorizedDriveClient, storedDriveToken } from "@/lib/drive/connection";
import styles from "./page.module.css";
import FolderPicker from "./FolderPicker";
import Image from "next/image";
export const metadata = { title: "EIU · Drive export setup" };
const messages: Record<string, string> = { connected: "Google Drive is connected.", cancelled: "Google authorization was cancelled.", "wrong-account": "Choose the administrator Google account.", "missing-scope": "Allow Drive access to save course documents.", failed: "Unable to connect. Check your Google configuration and try again." };
export default async function DriveConnectionPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const admin = await requireAdminAccess(); if (!admin) redirect("/");
  const query = await searchParams; let connected = false; let error = "";
  try { if (await storedDriveToken()) { await authorizedDriveClient(); connected = true; } }
  catch { error = "Unable to verify Drive access. Reconnect your administrator Google account."; }
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>EIU · LEARNING PLATFORM ADMINISTRATION</p><h1>Drive export setup</h1><p>Choose where to save copies of your web section files.</p></div><DriveWorkspaceNav /></header>
    <div className={styles.workspace}>
    <section className={styles.card} aria-labelledby="drive-account-heading"><div className={styles.cardHeading}><span className={styles.headingBadge}><Image src="/branding/apps/google-drive.svg" width={21} height={21} alt="" /></span><div><h2 id="drive-account-heading">Drive connection</h2><p>Administrator account</p></div></div><div className={styles.connection}><div className={styles.accountDetails}><strong>{admin.email}</strong><p>{connected ? "Ready to save course documents." : "Connect your account to save course documents."}</p></div><div className={styles.connectionActions}><span className={`${styles.status} ${connected ? styles.statusConnected : ""}`}><span aria-hidden="true" />{connected ? "Connected" : "Not connected"}</span>{!connected && <a className={styles.button} href="/api/admin/drive/connect">Connect Drive</a>}{connected && <a className={styles.secondaryButton} href="/api/admin/drive/connect">Reconnect</a>}</div></div>
    {query.result && messages[query.result] && <p className={styles.notice} role="status">{messages[query.result]}</p>}{error && <p className={styles.notice} role="alert">{error}</p>}</section>
    {connected && <section className={styles.card} aria-labelledby="drive-destinations-heading"><div className={styles.cardHeading}><span className={styles.headingBadge}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3Z"/></svg></span><div><h2 id="drive-destinations-heading">Your destinations</h2><p>Choose folders for files exported from the web.</p></div></div><FolderPicker configured={Boolean(process.env.GOOGLE_DRIVE_PICKER_API_KEY?.trim())} /></section>}
    </div>
  </main>;
}
