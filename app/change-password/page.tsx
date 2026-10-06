import { redirect } from "next/navigation";
import { currentTeacher } from "@/lib/auth/teachers";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { currentAccessSession } from "@/lib/auth/session";
export default async function Page() {
  if ((await currentAccessSession())?.role === "admin") return <ChangePasswordForm required={false} isAdmin />;
  const teacher = await currentTeacher();
  if (!teacher) redirect("/");
  return <ChangePasswordForm required={teacher.must_change_password} />;
}
