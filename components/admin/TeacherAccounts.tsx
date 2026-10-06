"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./TeacherAccounts.module.css";

type Account = { id: string; email: string; display_name: string; status: "active" | "suspended"; must_change_password: boolean; created_at: string };
type Dialog = { account: Account; mode: "password" | "details" } | null;
function Eye({ hidden = false }: { hidden?: boolean }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{hidden && <path d="m3 3 18 18"/>}</svg>; }
async function api(body?: Record<string, unknown>) {
  const res = await fetch("/api/admin/accounts", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await res.json(); if (!res.ok) throw new Error(data.message || "Unable to manage accounts."); return data;
}
export default function TeacherAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [email, setEmail] = useState(""); const [name, setName] = useState("");
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newPassword, setNewPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [show, setShow] = useState(false);
  const [editName, setEditName] = useState(""); const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    api().then(data => { if (active) setAccounts(data.accounts); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setDialog(null);
      if (event.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('input, select, button:not(:disabled)');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [dialog, busy]);
  async function run(key: string, action: () => Promise<void>) {
    if (busy) return; setBusy(key); setError(""); setMessage("");
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to manage accounts."); } finally { setBusy(""); }
  }
  async function reload() { const data = await api(); setAccounts(data.accounts); }
  async function create(event: FormEvent) {
    event.preventDefault();
    await run("create", async () => {
      const data = await api({ action: "create", email, name });
      setPasswords(prev => ({ ...prev, [data.id]: data.password }));
      setMessage(`Created ${data.email}. Temporary password: ${data.password}. The teacher must change it on first sign-in.`);
      setName(""); setEmail(""); await reload();
    });
  }
  function open(account: Account, mode: "password" | "details") {
    setDialog({ account, mode }); setNewPassword(""); setConfirmation(""); setShow(false); setEditName(account.display_name); setEditStatus(account.status); setError("");
  }
  async function reset(random: boolean) {
    if (!dialog) return;
    if (!random && newPassword !== confirmation) { setError("The passwords do not match."); return; }
    await run(dialog.account.id, async () => {
      const data = await api({ action: "reset_password", id: dialog.account.id, random, password: newPassword, confirmPassword: confirmation });
      setPasswords(prev => ({ ...prev, [dialog.account.id]: data.password }));
      setMessage(`Password reset for ${dialog.account.email}: ${data.password}. Previous sessions have ended. A password change is required at the next sign-in.`);
      await reload(); setDialog(null);
    });
  }
  const visible = accounts.filter(a => `${a.email} ${a.display_name}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || (filter === "pending" ? a.must_change_password : a.status === filter)));
  return <section className={styles.workspace} aria-label="Teacher account management">
    <div className={styles.heading}><div><h2>Teacher Accounts</h2><p>Create teacher accounts and manage their access and passwords.</p></div><div className={styles.metrics}><span><b>{accounts.length}</b>Total teachers</span><span><b>{accounts.filter(a => a.status === "active").length}</b>Active</span><span><b>{accounts.filter(a => a.must_change_password).length}</b>First login pending</span></div></div>
    {message && <div className={styles.message} role="status">{message}<button className={styles.button} onClick={() => setMessage("")}>Dismiss</button></div>}
    {error && !dialog && <div className={`${styles.message} ${styles.error}`} role="alert">{error}</div>}
    <div className={styles.layout}>
      <aside className={`${styles.card} ${styles.create}`}><h3>Create teacher account</h3><p>A temporary six-digit password is generated automatically.</p><form className={styles.form} onSubmit={create}>
        <label>FULL NAME<input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Teacher name" required maxLength={120} /></label>
        <label>LOGIN EMAIL<input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teacher@eiu.edu.vn" autoComplete="off" required /></label>
        <button className={styles.primary} disabled={!!busy || loading}>{busy === "create" ? "Creating…" : "+ Create teacher"}</button>
      </form><div className={styles.note}><strong>TEACHER PERMISSIONS</strong><p>Create courses and manage their own sections. View all courses on the platform.</p><strong>MAIN ADMIN</strong><p>View or reset teacher passwords, and suspend or reactivate accounts.</p></div></aside>
      <div className={`${styles.card} ${styles.list}`}>
        <div className={styles.toolbar}><input className={`${styles.input} ${styles.search}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" aria-label="Search teachers" /><select className={styles.select} aria-label="Filter teachers" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All teachers</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="pending">First login pending</option></select><button className={styles.button} disabled={!!busy} onClick={() => void run("refresh", reload)}>↻ Refresh</button></div>
        <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Teacher / Login email</th><th>Account</th><th>Password status</th><th>Current password</th><th>Actions</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={5} className={styles.empty}>Loading teacher accounts…</td></tr> : !visible.length ? <tr><td colSpan={5} className={styles.empty}><strong>{accounts.length ? "No matching teachers" : "Your teacher team starts here"}</strong>{accounts.length ? "Try another search or filter." : "Create the first account using the form on the left."}</td></tr> : visible.map(a => <tr key={a.id}>
            <td><div className={styles.identity}><span className={styles.avatar}>{a.display_name.charAt(0).toUpperCase()}</span><div><b title={a.display_name}>{a.display_name}</b><small title={a.email}>{a.email}</small></div></div></td>
            <td><span className={`${styles.badge} ${a.status === "suspended" ? styles.suspended : ""}`}>{a.status === "active" ? "Active" : "Suspended"}</span></td>
            <td><span className={`${styles.badge} ${a.must_change_password ? styles.pending : ""}`}>{a.must_change_password ? "Change required" : "Changed"}</span></td>
            <td><div className={styles.password}><code>{passwords[a.id] !== undefined ? passwords[a.id] : "••••••••"}</code><button className={styles.iconButton} disabled={!!busy} title={passwords[a.id] !== undefined ? "Hide password" : "View password"} aria-label={`${passwords[a.id] !== undefined ? "Hide" : "View"} password for ${a.email}`} onClick={() => {
              if (passwords[a.id] !== undefined) { setPasswords(prev => { const next = { ...prev }; delete next[a.id]; return next; }); return; }
              void run(a.id, async () => { const data = await api({ action: "reveal_password", id: a.id }); setPasswords(prev => ({ ...prev, [a.id]: data.password })); });
            }}><Eye hidden={passwords[a.id] !== undefined}/></button>{passwords[a.id] !== undefined && <button className={styles.button} onClick={() => void run("copy", async () => { await navigator.clipboard.writeText(passwords[a.id]); setMessage("Password copied."); })}>Copy</button>}</div></td>
            <td><div className={styles.actions}><button className={styles.button} disabled={!!busy} onClick={() => open(a, "details")}>Manage</button><button className={styles.primary} disabled={!!busy} onClick={() => open(a, "password")}>Change password</button></div></td>
          </tr>)}
        </tbody></table></div><div className={styles.footer}>{visible.length} of {accounts.length} teachers · Passwords are shown only when the main admin chooses to view them.</div>
      </div>
    </div>
    {dialog && <div className={styles.overlay}><div className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="teacher-dialog-title"><h2 id="teacher-dialog-title">{dialog.mode === "password" ? "Change teacher password" : "Manage teacher"}</h2><p>{dialog.account.email}</p>
      {error && <div className={`${styles.message} ${styles.error}`} role="alert">{error}</div>}
      {dialog.mode === "password" ? <><p>The teacher must change this password at the next sign-in. Previous sessions will end.</p><form className={styles.form} onSubmit={e => { e.preventDefault(); void reset(false); }}><label>NEW PASSWORD<input className={styles.input} type={show ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" required maxLength={1024}/></label><label>CONFIRM PASSWORD<input className={styles.input} type={show ? "text" : "password"} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required maxLength={1024}/></label><button className={styles.button} type="button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide password" : "Show password"}</button><div className={styles.dialogFooter}><button className={styles.button} type="button" disabled={!!busy} onClick={() => setDialog(null)}>Cancel</button><button className={styles.primary} disabled={!!busy}>Save password</button></div></form><button className={styles.button} disabled={!!busy} onClick={() => void reset(true)}>Generate random 6-digit password</button></> : <form className={styles.form} onSubmit={e => { e.preventDefault(); void run(dialog.account.id, async () => { await api({ action: "update_account", id: dialog.account.id, name: editName, status: editStatus }); await reload(); setDialog(null); setMessage("Teacher account updated."); }); }}><label>FULL NAME<input className={styles.input} value={editName} onChange={e => setEditName(e.target.value)} required maxLength={120}/></label><label>ACCOUNT STATUS<select className={styles.select} value={editStatus} onChange={e => setEditStatus(e.target.value as "active" | "suspended")}><option value="active">Active · Sign-in allowed</option><option value="suspended">Suspended · Sign-in blocked</option></select></label><p>Suspending an account blocks sign-in and ends current sessions. Existing course content is retained.</p><div className={styles.dialogFooter}><button className={styles.button} type="button" disabled={!!busy} onClick={() => setDialog(null)}>Cancel</button><button className={styles.primary} disabled={!!busy}>Save changes</button></div></form>}
    </div></div>}
  </section>;
}
