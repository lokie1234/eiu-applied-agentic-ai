"use client";
import Link from "next/link";
export default function DriveWorkspaceNav() {
  async function signOut() { const response = await fetch("/api/signout", { method: "POST" }); if (response.ok) window.location.replace("/"); }
  return <nav aria-label="Workspace navigation"><Link href="/admin/access">Admin workspace</Link><Link href="/learn">Learning Space</Link><Link href="/change-password">Change password</Link><Link href="/admin/ai">✦ AI Knowledge</Link><button type="button" onClick={() => void signOut()}>Sign out</button></nav>;
}
