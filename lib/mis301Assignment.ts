import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { AppUserAccess } from "@/lib/auth/types";
import { mintRealtimeToken, realtimeConfigured } from "@/lib/realtime/server";
import { MIS301_SECTION_ID } from "@/lib/mis301Practice";

export type PracticeAssignment = { subject?: string; username?: string; question: number; part?: number; drawId: string; createdAt: number; config?: { number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> } };

export async function readPracticeAssignment(access: AppUserAccess, epoch: string): Promise<PracticeAssignment | null> {
  if (!realtimeConfigured() || !process.env.NEXT_PUBLIC_CONVEX_URL) throw Error("The classroom is reconnecting. Please retry shortly.");
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(mintRealtimeToken(access));
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const room = await Promise.race([client.query(makeFunctionReference<"query", { sectionId: string }, {
      ready: boolean; viewerSubject?: string; practiceSession?: string; assignment?: PracticeAssignment | null;
    }>("classroom:view"), { sectionId: MIS301_SECTION_ID }), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error("The live classroom is reconnecting.")), 8000); })]);
    if (!room.ready || room.practiceSession !== epoch || room.viewerSubject !== access.authUserId) return null;
    const assignment = room.assignment;
    return assignment && assignment.subject === access.authUserId && Number.isInteger(assignment.question) && assignment.question >= 1 && assignment.question <= 7
      && typeof assignment.drawId === "string" ? assignment : null;
  } finally { if (timeout) clearTimeout(timeout); }
}
