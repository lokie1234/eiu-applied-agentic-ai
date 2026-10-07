import { redirect } from "next/navigation";
import AdminAccessPortal from "@/components/admin/AdminAccessPortal";
import { requireAdminAccess } from "@/lib/auth/currentUser";

export const metadata = { title: "EIU · Course Access Administration" };

export default async function AdminAccessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminAccess();
  if (!admin) redirect("/");
  const query = await searchParams;
  return <AdminAccessPortal adminEmail={admin.email} initialTab={query.tab === "layouts" ? "layouts" : undefined} />;
}
