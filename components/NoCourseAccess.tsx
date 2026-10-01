"use client";

export default function NoCourseAccess() {
  async function signOut() {
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/");
  }

  return (
    <main className="access-empty-page">
      <section className="access-empty-card">
        <span>EIU COURSE ACCESS</span>
        <h1>No course access</h1>
        <p>
          This passcode session does not have an active course folder. Please request a valid
          folder passcode from the administrator.
        </p>
        <button type="button" onClick={() => void signOut()}>Return to access</button>
      </section>
    </main>
  );
}
