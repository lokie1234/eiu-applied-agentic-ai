import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LessonPortal from "@/components/LessonPortal";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  const role = getAccessRole(token);
  if (!role) redirect("/login");
  return <LessonPortal role={role} />;
}
