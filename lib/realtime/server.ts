import "server-only";
import { createPrivateKey, createPublicKey, sign, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AppUserAccess } from "@/lib/auth/types";

export function realtimeConfigured() {
  return process.env.REALTIME_PROVIDER === "convex" && Boolean(process.env.CONVEX_JWT_PRIVATE_KEY && process.env.CONVEX_SITE_URL && process.env.REALTIME_BRIDGE_SECRET);
}
export function bridgeAuthorized(request: Request) {
  const expected = process.env.REALTIME_BRIDGE_SECRET;
  if (!expected) return false;
  const value = request.headers.get("authorization") || "";
  const correct = Buffer.from(`Bearer ${expected}`), received = Buffer.from(value);
  return correct.length === received.length && timingSafeEqual(correct, received);
}
export function mintRealtimeToken(access: AppUserAccess, now = Date.now()) {
  const privateKey = createPrivateKey(process.env.CONVEX_JWT_PRIVATE_KEY!.replace(/\\n/g, "\n"));
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "eiu-realtime-v1" })).toString("base64url");
  const allowed = access.sections.filter(section => access.isAdmin || (!section.hidden && !access.courses.find(course => course.id === section.courseId)?.hidden));
  const body = Buffer.from(JSON.stringify({ iss: "https://eiu-learning.internal", aud: "eiu-interactive", sub: access.authUserId,
    iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 120,
    role: access.isAdmin ? "admin" : "learner", sections: JSON.stringify(allowed.map(section => section.id)), teaching: JSON.stringify(allowed.filter(section => section.canFacilitate).map(section => section.id)),
  })).toString("base64url");
  return `${header}.${body}.${sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url")}`;
}
export function realtimeJwks() {
  const key = createPublicKey(process.env.CONVEX_JWT_PRIVATE_KEY!.replace(/\\n/g, "\n")).export({ format: "jwk" });
  return { keys: [{ ...key, kid: "eiu-realtime-v1", alg: "RS256", use: "sig" }] };
}
export async function readRealtimeSignals(signal?: AbortSignal) {
  const rows: Array<{ sectionId: string; topic: string; revision: number }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await getSupabaseAdmin(signal).from("learning_realtime_signals").select("section_id,topic,revision").order("section_id").order("topic").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []).map(row => ({ sectionId: String(row.section_id), topic: String(row.topic), revision: Number(row.revision) })));
    if (!data || data.length < 1000) return rows;
  }
}
export async function publishRealtimeSignals() {
  if (!realtimeConfigured()) return;
  const rows = await readRealtimeSignals();
  for (let offset = 0; offset < rows.length; offset += 1000) {
    const response = await fetch(`${process.env.CONVEX_SITE_URL!.replace(/\/$/, "")}/signals`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REALTIME_BRIDGE_SECRET}` },
      body: JSON.stringify({ rows: rows.slice(offset, offset + 1000) }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Realtime signal delivery failed.");
  }
}
