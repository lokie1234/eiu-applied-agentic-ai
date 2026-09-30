import { redirect } from "next/navigation";
import AdminAccessPortal from "@/components/admin/AdminAccessPortal";
import { requireAdminAccess } from "@/lib/auth/currentUser";

export const metadata = { title: "EIU · Quản lý quyền khóa học" };

export default async function AdminAccessPage() {
  const admin = await requireAdminAccess();
  if (!admin) redirect("/login");
  return <AdminAccessPortal adminEmail={admin.email} />;
}
