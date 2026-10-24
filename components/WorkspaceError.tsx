"use client";

import Link from "next/link";

export default function WorkspaceError({ retry }: { retry: () => void }) {
  return <main style={{ maxWidth: 560, margin: "15vh auto", padding: 24 }} role="alert">
    <h1>Unable to load this page</h1>
    <p>The connection was interrupted. Please try again.</p>
    <button type="button" onClick={retry}>Try again</button>
    <p><Link href="/learn">Learning Space</Link> · <Link href="/admin/access">Admin Settings</Link></p>
  </main>;
}
