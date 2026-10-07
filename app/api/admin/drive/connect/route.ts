import { createHash, randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { ACCESS_SESSION_COOKIE } from "@/lib/auth/session";
import { DRIVE_SCOPES, DRIVE_STATE_COOKIE, driveClient, driveConfig } from "@/lib/drive/connection";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  try {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ message: "Connect from local development; production token persistence is not configured yet." }, { status: 503 });
    const config = driveConfig();
    const client = driveClient();
    const store = await cookies();
    const state = randomBytes(32).toString("base64url");
    const pkce = await client.generateCodeVerifierAsync();
    const sessionHash = createHash("sha256").update(store.get(ACCESS_SESSION_COOKIE)?.value ?? "").digest("hex");
    store.set(DRIVE_STATE_COOKIE, JSON.stringify({ state, verifier: pkce.codeVerifier, sessionHash }), {
      httpOnly: true, secure: new URL(config.redirectUri).protocol === "https:", sameSite: "lax", path: "/api/admin/drive", maxAge: 600,
    });
    const url = client.generateAuthUrl({
      access_type: "offline", prompt: "consent select_account", scope: DRIVE_SCOPES,
      login_hint: config.accountEmail, state, code_challenge: pkce.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ message: "Unable to start Drive connection. Check server OAuth configuration." }, { status: 503 });
  }
}
