import "server-only";
import crypto from "node:crypto";
import type { LearnerProfile, LearnerSection } from "@/lib/learnerProfileTypes";

export const LEARNER_PROFILE_COOKIE = "eiu_ai_learner_profile";

function getSecret() {
  const secret = process.env.ACCESS_SESSION_SECRET;
  if (!secret) throw new Error("ACCESS_SESSION_SECRET is missing");
  return secret;
}

function signature(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeLearnerProfile(
  nameValue: unknown,
  emailValue: unknown,
  section: LearnerSection,
): LearnerProfile | null {
  const name = String(nameValue ?? "").trim().replace(/\s+/g, " ");
  const email = String(emailValue ?? "").trim().toLowerCase();
  if (!name || name.length > 80) return null;
  if (email.length > 100 || !/^[a-z0-9._%+-]+@eiu\.edu\.vn$/i.test(email)) return null;
  return { name, email, section };
}

export function createLearnerProfileToken(profile: LearnerProfile) {
  const payload = Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function parseLearnerProfileToken(token?: string): LearnerProfile | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra || !safeEqual(suppliedSignature, signature(payload))) return null;

  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<LearnerProfile>;
    if (raw.section !== "section1" && raw.section !== "section2") return null;
    return normalizeLearnerProfile(raw.name, raw.email, raw.section);
  } catch {
    return null;
  }
}
