import { createHash, randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { ACCESS_SESSION_COOKIE } from "@/lib/auth/session";
import { DRIVE_SCOPES, DRIVE_STATE_COOKIE, driveClient, driveConfig, assertDriveTokenStorage } from "@/lib/drive/connection";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "login" ? "login" : "connect";
  if (mode !== "login" && !(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  try {
    const config = driveConfig();
    if (new URL(request.url).origin !== new URL(config.redirectUri).origin) {
      return NextResponse.json({ message: "The Google callback must use the same domain as this page." }, { status: 503 });
    }
    await assertDriveTokenStorage();
    const client = driveClient();
    const store = await cookies();
    const state = randomBytes(32).toString("base64url");
    const pkce = await client.generateCodeVerifierAsync();
    const sessionHash = createHash("sha256").update(store.get(ACCESS_SESSION_COOKIE)?.value ?? "").digest("hex");
    store.set(DRIVE_STATE_COOKIE, JSON.stringify({ state, verifier: pkce.codeVerifier, sessionHash, mode }), {
      httpOnly: true, secure: new URL(config.redirectUri).protocol === "https:", sameSite: "lax", path: "/api/admin/drive", maxAge: 600,
    });
    const url = client.generateAuthUrl({
      access_type: "offline", prompt: "consent select_account", scope: DRIVE_SCOPES,
      login_hint: config.accountEmail, state, code_challenge: pkce.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ message: "Unable to connect Google. Check OAuth configuration and Drive token storage." }, { status: 503 });
  }
}
