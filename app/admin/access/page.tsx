import { redirect } from "next/navigation";
import AdminAccessPortal from "@/components/admin/AdminAccessPortal";
import { requireAdminAccess } from "@/lib/auth/currentUser";

export const metadata = { title: "EIU · Course Access Administration" };

export default async function AdminAccessPage() {
  const admin = await requireAdminAccess();
  if (!admin) redirect("/");
  return <AdminAccessPortal adminEmail={admin.email} />;
}
