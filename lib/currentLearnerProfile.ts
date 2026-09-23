import "server-only";
import { cookies } from "next/headers";
import { currentRole } from "@/lib/currentRole";
import {
  LEARNER_PROFILE_COOKIE,
  parseLearnerProfileToken,
} from "@/lib/learnerProfile";

export async function currentLearnerProfile() {
  const [role, cookieStore] = await Promise.all([currentRole(), cookies()]);
  if (role !== "section1" && role !== "section2") return null;
  const profile = parseLearnerProfileToken(cookieStore.get(LEARNER_PROFILE_COOKIE)?.value);
  return profile?.section === role ? profile : null;
}
