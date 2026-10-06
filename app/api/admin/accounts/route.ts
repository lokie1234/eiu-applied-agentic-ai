import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { decryptPassword, passwordFields, temporaryPassword, validPassword } from "@/lib/auth/teachers";
import { FIXED_ADMIN_EMAIL, isValidEmail, normalizeEmail } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
export async function GET() {
  if (!(await requireAdminAccess())) return json({ message: "Administrator access required." }, 403);
  const { data, error } = await getSupabaseAdmin().from("teacher_accounts").select("id,email,display_name,status,must_change_password,created_at,updated_at").order("created_at", { ascending: false });
  if (error) return json({ message: "Unable to load teacher accounts. Check the database migration." }, 500);
  return json({ accounts: data });
}
export async function POST(request: Request) {
  const admin = await requireAdminAccess();
  if (!admin) return json({ message: "Administrator access required." }, 403);
  try {
    const body = await request.json();
    const db = getSupabaseAdmin();
    const action = String(body.action ?? "create");
    if (action === "create") {
      const email = normalizeEmail(body.email); const name = String(body.name ?? "").trim();
      if (!isValidEmail(email) || email === FIXED_ADMIN_EMAIL || !name || name.length > 120) return json({ message: "Enter a valid teacher email and name." }, 400);
      const password = temporaryPassword();
      const { data, error } = await db.from("teacher_accounts").insert({ email, display_name: name, ...await passwordFields(password, email) }).select("id").single();
      if (error) return json({ message: error.code === "23505" ? "This account already exists." : "Unable to create account." }, 400);
      return json({ id: data.id, email, password });
    }
    const { data: account, error } = await db.from("teacher_accounts").select("*").eq("id", String(body.id ?? "")).maybeSingle();
    if (error) throw error;
    if (!account) return json({ message: "Teacher account not found." }, 404);
    if (action === "reveal_password") {
      const { error: auditError } = await db.from("access_audit_logs").insert({ actor_email: admin.email, target_email: account.email, action: "TEACHER_PASSWORD_VIEWED" });
      if (auditError) throw auditError;
      return json({ password: decryptPassword(account.password_ciphertext, account.email) });
    }
    let updates: Record<string, unknown>;
    let password: string | undefined;
    if (action === "reset_password") {
      password = body.random === true ? temporaryPassword() : body.password;
      if (!validPassword(password) || (body.random !== true && password !== body.confirmPassword)) return json({ message: "Enter a password and matching confirmation." }, 400);
      updates = { ...await passwordFields(password, account.email), must_change_password: true, session_version: account.session_version + 1 };
    } else if (action === "update_account") {
      const name = String(body.name ?? account.display_name).trim();
      const status = body.status ?? account.status;
      if (!name || name.length > 120 || !["active", "suspended"].includes(status)) return json({ message: "Invalid account details." }, 400);
      updates = { display_name: name, status, session_version: account.session_version + 1 };
    } else return json({ message: "Unsupported action." }, 400);
    const { error: updateError } = await db.from("teacher_accounts").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", account.id).eq("session_version", account.session_version).select("id").single();
    if (updateError) return json({ message: "The account changed. Refresh and try again." }, 409);
    return json({ success: true, ...(password !== undefined ? { password } : {}) });
  } catch {
    return json({ message: "Unable to update teacher account." }, 500);
  }
}
