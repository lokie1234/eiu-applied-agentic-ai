import DriveWorkspaceNav from "@/components/admin/DriveWorkspaceNav";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { authorizedDriveClient, storedDriveToken } from "@/lib/drive/connection";
import styles from "./page.module.css";
import FolderPicker from "./FolderPicker";
export const metadata = { title: "EIU · Google Drive" };
const messages: Record<string, string> = { connected: "Google Drive is connected.", cancelled: "Google authorization was cancelled.", "wrong-account": "Choose the administrator Google account.", "missing-scope": "Allow Drive access to save course documents.", failed: "Unable to connect. Check your Google configuration and try again." };
export default async function DriveConnectionPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const admin = await requireAdminAccess(); if (!admin) redirect("/");
  const query = await searchParams; let connected = false; let error = "";
  try { if (await storedDriveToken()) { await authorizedDriveClient(); connected = true; } }
  catch { error = "Unable to verify Drive access. Reconnect your administrator Google account."; }
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>EIU · ADMIN WORKSPACE</p><h1>Google Drive</h1><p>Keep course documents together, wherever you teach.</p></div><DriveWorkspaceNav /></header>
    <section className={styles.card}><div className={styles.connection}><div><p className={styles.eyebrow}>GOOGLE DRIVE CONNECTION</p><h2>{admin.email}</h2><p>{connected ? "Connected · Ready to save documents" : "Connect your administrator account to save documents"}</p></div><div className={styles.actions}><span className={styles.status}>{connected ? "Connected" : "Not connected"}</span>{!connected && <a className={styles.button} href="/api/admin/drive/connect">Connect Google Drive</a>}{connected && <a className={styles.secondary} href="/api/admin/drive/connect">Reconnect</a>}</div></div>
    {query.result && messages[query.result] && <p className={styles.notice} role="status">{messages[query.result]}</p>}{error && <p className={styles.notice} role="alert">{error}</p>}</section>
    {connected && <section className={styles.card}><p className={styles.eyebrow}>YOUR DESTINATIONS</p><h2>Drive folders</h2><p>Give each destination a name, then select it when saving a section or an entire folder.</p><FolderPicker configured={Boolean(process.env.GOOGLE_DRIVE_PICKER_API_KEY?.trim())} /></section>}
  </main>;
}
