import "server-only";
import { OAuth2Client } from "google-auth-library";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SECTION_SOURCE_DESTINATIONS } from "@/lib/sectionSourceFiles";

const TOKEN_PATH = path.join(process.cwd(), ".local", "google-drive.enc");
export const DRIVE_STATE_COOKIE = "eiu_drive_oauth";
export const DRIVE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];

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

export async function storedDriveToken(): Promise<string | null> {
  const configured = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
  if (configured) return configured;
  // Filesystem persistence is intentionally only supported for local development.
  if (process.env.NODE_ENV === "production") return null;
  let data: string;
  try { data = await readFile(TOKEN_PATH, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const { iv, tag, body } = JSON.parse(data) as { iv: string; tag: string; body: string };
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decoded = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]);
  const record = JSON.parse(decoded.toString("utf8")) as { email: string; refreshToken: string };
  if (record.email !== driveConfig().accountEmail) return null;
  return record.refreshToken;
}

export async function saveLocalDriveToken(email: string, refreshToken: string) {
  if (process.env.NODE_ENV === "production") throw new Error("Production token persistence is not configured. Connect using local development first.");
  if (email !== driveConfig().accountEmail) throw new Error("Unexpected Drive account.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ email, refreshToken }), "utf8"), cipher.final()]);
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  const temporary = `${TOKEN_PATH}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), body: body.toString("base64") }), { mode: 0o600 });
  await rename(temporary, TOKEN_PATH);
}

export async function authorizedDriveClient() {
  const config = driveConfig();
  const token = await storedDriveToken();
  if (!token) throw new Error("Google Drive is not connected.");
  const client = driveClient();
  client.setCredentials({ refresh_token: token });
  const identity = await client.request<{ email: string; email_verified: boolean }>({ url: "https://www.googleapis.com/oauth2/v3/userinfo", timeout: 10000 });
  if (!identity.data.email_verified || identity.data.email.toLowerCase() !== config.accountEmail) {
    throw new Error("Stored authorization belongs to a different Google account. Reconnect Drive.");
  }
  return client;
}

export async function driveStatus() {
  const config = driveConfig();
  if (!(await storedDriveToken())) return { connected: false, email: config.accountEmail, folders: [] };
  const client = await authorizedDriveClient();
  const folders = await Promise.all(Object.entries(SECTION_SOURCE_DESTINATIONS).map(async ([type, id]) => {
    try {
      const response = await client.request<{ name: string; mimeType: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean } }>({
        url: `https://www.googleapis.com/drive/v3/files/${id}`,
        timeout: 10000,
        params: { supportsAllDrives: true, fields: "name,mimeType,trashed,capabilities(canAddChildren)" },
      });
      const available = response.data.mimeType === "application/vnd.google-apps.folder" && !response.data.trashed && response.data.capabilities?.canAddChildren === true;
      return { type, id, name: response.data.name, available };
    } catch {
      return { type, id, name: "", available: false };
    }
  }));
  return { connected: true, email: config.accountEmail, folders };
}
