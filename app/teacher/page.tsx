import { redirect } from "next/navigation";
import { currentUserAccess } from "@/lib/auth/currentUser";
import TeacherPortal from "@/components/TeacherPortal";
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await currentUserAccess();
  if (access?.mustChangePassword) redirect("/change-password");
  if (!access?.isActive || !access.isTeacher) redirect("/");
  const query = await searchParams;
  return <TeacherPortal name={access.displayName} initialTab={query.tab === "layouts" ? "layouts" : undefined} />;
}
