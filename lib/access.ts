import "server-only";
import crypto from "node:crypto";

export const ACCESS_COOKIE = "eiu_ai_access";
export type AccessRole = "user" | "admin";

function getSecret() {
  const secret = process.env.ACCESS_SESSION_SECRET;
  if (!secret) throw new Error("ACCESS_SESSION_SECRET is missing");
  return secret;
}

function payload(role: AccessRole) {
  return `eiu-ai-access-${role}-v2`;
}

export function createAccessToken(role: AccessRole) {
  return crypto.createHmac("sha256", getSecret()).update(payload(role)).digest("hex");
}

function matches(token: string, expected: string) {
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);

  if (tokenBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function getAccessRole(token?: string): AccessRole | null {
  if (!token) return null;
  if (matches(token, createAccessToken("admin"))) return "admin";
  if (matches(token, createAccessToken("user"))) return "user";
  return null;
}

export function verifyAccessToken(token?: string) {
  return getAccessRole(token) !== null;
}
