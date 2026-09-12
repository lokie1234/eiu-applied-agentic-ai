import "server-only";
import crypto from "node:crypto";

export const ACCESS_COOKIE = "eiu_ai_access";
const ACCESS_PAYLOAD = "eiu-ai-access-granted-v1";

function getSecret() {
  const secret = process.env.ACCESS_SESSION_SECRET;
  if (!secret) throw new Error("ACCESS_SESSION_SECRET is missing");
  return secret;
}

export function createAccessToken() {
  return crypto.createHmac("sha256", getSecret()).update(ACCESS_PAYLOAD).digest("hex");
}

export function verifyAccessToken(token?: string) {
  if (!token) return false;

  const expected = createAccessToken();
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);

  if (tokenBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}
