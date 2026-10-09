import "server-only";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { currentRole } from "@/lib/currentRole";
import type { AppUserAccess } from "@/lib/auth/types";

export async function currentLearnerProfile(resolvedAccess?: AppUserAccess | null, signal?: AbortSignal) {
  const access = resolvedAccess === undefined ? await currentUserAccess(signal) : resolvedAccess;
  const role = await currentRole(access);
  if (role !== "section1" && role !== "section2") return null;
  if (!access?.isActive) return null;
  return { name: access.displayName, email: access.email, section: role, identity: access.learnerIdentity || { sessionId: access.authUserId, name: access.displayName, email: access.email, information: {} } };
}
