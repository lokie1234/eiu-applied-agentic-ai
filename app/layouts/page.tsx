import { redirect } from "next/navigation";
import { requireCourseManager } from "@/lib/auth/currentUser";
export default async function Page() {
  const actor = await requireCourseManager();
  if (!actor) redirect("/");
  redirect(actor.isAdmin ? "/admin/access?tab=layouts" : "/teacher?tab=layouts");
}
