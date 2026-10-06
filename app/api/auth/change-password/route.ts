import { NextResponse } from "next/server";
import { currentTeacher, hashPassword, matchesPassword, passwordFields, validPassword } from "@/lib/auth/teachers";
import { ACCESS_SESSION_COOKIE, createAccessSession, currentAccessSession, sessionCookieOptions } from "@/lib/auth/session";
import { getAdminCredential, verifyAdminPassword } from "@/lib/auth/adminPassword";
import { FIXED_ADMIN_EMAIL } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    const session = await currentAccessSession();
    if (session?.role === "admin") {
      const body = await request.json();
      if (!validPassword(body.password) || body.password !== body.confirmPassword) return NextResponse.json({ message: "Enter a new password and matching confirmation." }, { status: 400 });
      const credential = await getAdminCredential();
      if (!validPassword(body.currentPassword) || !await verifyAdminPassword(body.currentPassword, credential)) return NextResponse.json({ message: "Incorrect current password." }, { status: 401 });
      if (await verifyAdminPassword(body.password, credential)) return NextResponse.json({ message: "Choose a password different from your current password." }, { status: 400 });
      const version = (credential?.session_version ?? 0) + 1;
      const db = getSupabaseAdmin();
      const values = { password_hash: await hashPassword(body.password), session_version: version, updated_at: new Date().toISOString() };
      const result = credential
        ? await db.from("admin_credentials").update(values).eq("id", true).eq("session_version", credential.session_version).select("id").single()
        : await db.from("admin_credentials").insert({ id: true, ...values }).select("id").single();
      if (result.error) return NextResponse.json({ message: "Unable to save the admin password. Apply the admin password migration, then sign in again." }, { status: 409 });
      const response = NextResponse.json({ success: true, destination: "/admin/access" });
      response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "admin", email: FIXED_ADMIN_EMAIL, sessionVersion: version }), sessionCookieOptions());
      return response;
    }
    const account = await currentTeacher();
    if (!account) return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
    const body = await request.json();
    if (!validPassword(body.password) || body.password !== body.confirmPassword) return NextResponse.json({ message: "Enter a new password and matching confirmation." }, { status: 400 });
    if (await matchesPassword(body.password, account.password_hash)) return NextResponse.json({ message: "Choose a password different from your current password." }, { status: 400 });
    const version = account.session_version + 1;
    const { error } = await getSupabaseAdmin().from("teacher_accounts").update({
      ...await passwordFields(body.password, account.email), must_change_password: false, session_version: version, updated_at: new Date().toISOString(),
    }).eq("id", account.id).eq("session_version", account.session_version).select("id").single();
    if (error) return NextResponse.json({ message: "The account changed. Please sign in again." }, { status: 409 });
    const response = NextResponse.json({ success: true, destination: "/teacher" });
    response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "teacher", email: account.email, accountId: account.id, sessionVersion: version }), sessionCookieOptions());
    return response;
  } catch { return NextResponse.json({ message: "Unable to change password." }, { status: 500 }); }
}
