import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LessonPortal from "@/components/LessonPortal";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";
import { LEARNER_PROFILE_COOKIE, parseLearnerProfileToken } from "@/lib/learnerProfile";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  const role = getAccessRole(token);
  if (!role) redirect("/login");
  const parsedProfile = parseLearnerProfileToken(
    cookieStore.get(LEARNER_PROFILE_COOKIE)?.value,
  );
  const learnerProfile = role !== "admin" && parsedProfile?.section === role
    ? parsedProfile
    : null;
  return <LessonPortal role={role} initialProfile={learnerProfile} />;
}
