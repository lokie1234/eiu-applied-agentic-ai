import { redirect } from "next/navigation";
import { currentUserAccess } from "@/lib/auth/currentUser";
import TeacherPortal from "@/components/TeacherPortal";
export default async function Page() {
  const access = await currentUserAccess();
  if (access?.mustChangePassword) redirect("/change-password");
  if (!access?.isActive || !access.isTeacher) redirect("/");
  return <TeacherPortal name={access.displayName} />;
}
