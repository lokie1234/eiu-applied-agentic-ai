import "server-only";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { currentRole } from "@/lib/currentRole";

export async function currentLearnerProfile() {
  const [role, access] = await Promise.all([currentRole(), currentUserAccess()]);
  if (role !== "section1" && role !== "section2") return null;
  if (!access?.isActive) return null;
  return { name: access.displayName, email: access.email, section: role, identity: access.learnerIdentity || { sessionId: access.authUserId, name: access.displayName, email: access.email, information: {} } };
}
