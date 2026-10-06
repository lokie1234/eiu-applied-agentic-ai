import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scrypt as deriveKey, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentAccessSession } from "./session";

const scrypt = promisify(deriveKey);
export type TeacherAccount = {
  id: string; email: string; display_name: string; password_hash: string; password_ciphertext: string;
  must_change_password: boolean; status: "active" | "suspended"; session_version: number;
  created_at: string; updated_at: string;
};
export function temporaryPassword() { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function validPassword(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 1024; }
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function matchesPassword(password: string, hash: string) {
  if (!validPassword(password)) return false;
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(stored, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
function encryptionKey() {
  const secret = process.env.TEACHER_PASSWORD_ENCRYPTION_KEY?.trim() || process.env.PASSCODE_SESSION_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new Error("Teacher password encryption is not configured.");
  return createHash("sha256").update(`eiu-teacher-password-v1:${secret}`).digest();
}
export function encryptPassword(password: string, accountEmail: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(accountEmail));
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString("base64url")).join(".");
}
export function decryptPassword(ciphertext: string, accountEmail: string) {
  const [iv, tag, encrypted] = ciphertext.split(".").map(v => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(accountEmail));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8");
}
export async function passwordFields(password: string, email: string) {
  return { password_hash: await hashPassword(password), password_ciphertext: encryptPassword(password, email) };
}
export async function teacherByEmail(email: string): Promise<TeacherAccount | null> {
  const { data, error } = await getSupabaseAdmin().from("teacher_accounts").select("*").eq("email", email).maybeSingle();
  if (error) throw error;
  return data;
}
export async function currentTeacher(): Promise<TeacherAccount | null> {
  const session = await currentAccessSession();
  if (session?.role !== "teacher") return null;
  const { data, error } = await getSupabaseAdmin().from("teacher_accounts").select("*").eq("id", session.accountId).maybeSingle();
  if (error) throw error;
  return data?.status === "active" && data.session_version === session.sessionVersion ? data : null;
}
