import { redirect } from "next/navigation";
import AdminAiPortal from "@/components/admin/AdminAiPortal";
import { requireAdminAccess } from "@/lib/auth/currentUser";

export const metadata = {
  title: "EIU Applied Agentic AI · Private Knowledge AI",
};

export default async function AdminAiPage() {
  if (!(await requireAdminAccess())) redirect("/login");

  return <AdminAiPortal />;
}
