import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { getAdminCredential } from "@/lib/auth/adminPassword";
import { FIXED_ADMIN_EMAIL } from "@/lib/auth/types";
import { ACCESS_SESSION_COOKIE, createAccessSession, sessionCookieOptions } from "@/lib/auth/session";
import { DRIVE_STATE_COOKIE, driveClient, driveConfig, saveDriveToken } from "@/lib/drive/connection";

export const runtime = "nodejs";
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const store = await cookies();
  const saved = store.get(DRIVE_STATE_COOKIE)?.value;
  store.delete({ name: DRIVE_STATE_COOKIE, path: "/api/admin/drive" });
  const config = driveConfig();
  let destination = new URL("/admin/drive", config.redirectUri);
  let result = "failed";
  try {
    const query = new URL(request.url).searchParams;
    const pending = JSON.parse(saved ?? "null") as { state: string; verifier: string; sessionHash: string; mode?: string } | null;
    const sessionHash = createHash("sha256").update(store.get(ACCESS_SESSION_COOKIE)?.value ?? "").digest("hex");
    if (pending?.mode === "login") destination = new URL("/", config.redirectUri);
    else if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    if (!pending || !equal(pending.state, query.get("state") ?? "") || !equal(pending.sessionHash, sessionHash)) throw new Error("Invalid OAuth state.");
    if (query.has("error")) { result = "cancelled"; throw new Error("Consent cancelled."); }
    const code = query.get("code");
    if (!code) throw new Error("Missing code.");
    const client = driveClient();
    const { tokens } = await client.getToken({ code, codeVerifier: pending.verifier });
    if (!tokens.id_token || !tokens.refresh_token) throw new Error("Missing identity or offline authorization.");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const identity = ticket.getPayload();
    if (!identity?.email_verified || identity.email?.toLowerCase() !== config.accountEmail || identity.email?.toLowerCase() !== FIXED_ADMIN_EMAIL) {
      result = "wrong-account"; throw new Error("Wrong Google account.");
    }
    if (!(tokens.scope ?? "").split(" ").includes("https://www.googleapis.com/auth/drive.file")) {
      result = "missing-scope"; throw new Error("Drive access not granted.");
    }
    await saveDriveToken(config.accountEmail, tokens.refresh_token);
    if (pending.mode === "login") {
      const credential = await getAdminCredential();
      store.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "admin", authMethod: "google", email: FIXED_ADMIN_EMAIL, sessionVersion: credential?.session_version ?? 0 }), sessionCookieOptions());
      destination = new URL("/admin/access", config.redirectUri);
    }
    result = "connected";
  } catch {
    // Do not log provider errors: they can contain OAuth codes or credentials.
  }
  destination.searchParams.set("result", result);
  return NextResponse.redirect(destination);
}
