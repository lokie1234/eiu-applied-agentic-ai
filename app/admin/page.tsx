import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/currentUser";

export default async function AdminRootPage() {
  const admin = await requireAdminAccess();
  if (admin) {
    redirect("/admin/access");
  }
  redirect("/");
}

