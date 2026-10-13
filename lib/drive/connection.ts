import "server-only";
import { OAuth2Client } from "google-auth-library";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const TOKEN_PATH = path.join(process.cwd(), ".local", "google-drive.enc");
export const DRIVE_STATE_COOKIE = "eiu_drive_oauth";
export const DRIVE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];
let activeClient: { key: string; client: OAuth2Client; verification: Promise<void> | null } | null = null;

export function driveConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  const accountEmail = process.env.GOOGLE_DRIVE_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (!clientId || !clientSecret || !redirectUri || !accountEmail) {
    throw new Error("Google Drive OAuth configuration is incomplete.");
  }
  const url = new URL(redirectUri);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Drive callback must use HTTPS or localhost.");
  }
  return { clientId, clientSecret, redirectUri, accountEmail };
}

export function driveClient() {
  const config = driveConfig();
  return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

function encryptionKey() {
  const secret = process.env.PASSCODE_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("A stable PASSCODE_SESSION_SECRET of at least 32 characters is required.");
  return createHash("sha256").update(`eiu-drive-token:${secret}`).digest();
}

function decryptDriveToken(data: string): string | null {
  const { iv, tag, body } = JSON.parse(data) as { iv: string; tag: string; body: string };
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decoded = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]);
  const record = JSON.parse(decoded.toString("utf8")) as { email: string; refreshToken: string };
  return record.email === driveConfig().accountEmail ? record.refreshToken : null;
}

export async function assertDriveTokenStorage() {
  encryptionKey();
  if (process.env.NODE_ENV !== "production") return;
  const { error } = await getSupabaseAdmin().from("google_drive_connections")
    .select("account_email").eq("account_email", driveConfig().accountEmail).maybeSingle();
  if (error) throw new Error("Google Drive token storage is unavailable. Apply the Drive connections migration.");
}

export async function storedDriveToken(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") {
    const { data, error } = await getSupabaseAdmin().from("google_drive_connections")
      .select("encrypted_token").eq("account_email", driveConfig().accountEmail).maybeSingle();
    if (data) return decryptDriveToken(data.encrypted_token);
    const configured = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
    if (configured) return configured;
    if (error) throw new Error("Google Drive token storage is unavailable.");
    return null;
  }
  const configured = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
  if (configured) return configured;
  let data: string;
  try { data = await readFile(TOKEN_PATH, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  return decryptDriveToken(data);
}

export async function saveDriveToken(email: string, refreshToken: string) {
  if (email !== driveConfig().accountEmail) throw new Error("Unexpected Drive account.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ email, refreshToken }), "utf8"), cipher.final()]);
  const encrypted = JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), body: body.toString("base64") });
  if (process.env.NODE_ENV === "production") {
    const { error } = await getSupabaseAdmin().from("google_drive_connections").upsert({
      account_email: email, encrypted_token: encrypted, updated_at: new Date().toISOString(),
    }, { onConflict: "account_email" });
    if (error) throw new Error("Unable to persist Google Drive authorization.");
    return;
  }
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  const temporary = TOKEN_PATH + "." + randomBytes(8).toString("hex") + ".tmp";
  await writeFile(temporary, encrypted, { mode: 0o600 });
  await rename(temporary, TOKEN_PATH);
}

export async function authorizedDriveClient() {
  const config = driveConfig();
  const token = await storedDriveToken();
  if (!token) { activeClient = null; throw new Error("Google Drive is not connected."); }
  // Read current stored credentials on every call; reconnects replace the client immediately.
  const key = createHash("sha256").update(JSON.stringify([config, token])).digest("hex");
  if (activeClient?.key !== key) {
    const client = driveClient();
    client.setCredentials({ refresh_token: token });
    activeClient = { key, client, verification: null };
  }
  const entry = activeClient;
  // Reuse access tokens, but share identity checks only while they are in flight.
  if (!entry.verification) {
    entry.verification = (async () => {
      const identity = await entry.client.request<{ email: string; email_verified: boolean }>({ url: "https://www.googleapis.com/oauth2/v3/userinfo", timeout: 10000 });
      if (!identity.data.email_verified || identity.data.email.toLowerCase() !== config.accountEmail) {
        throw new Error("Stored authorization belongs to a different Google account. Reconnect Drive.");
      }
    })().catch(error => { if (activeClient === entry) activeClient = null; throw error; })
      .finally(() => { entry.verification = null; });
  }
  await entry.verification;
  return entry.client;
}
