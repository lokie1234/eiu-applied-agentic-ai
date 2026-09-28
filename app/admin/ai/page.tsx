import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";
import AdminAiPortal from "@/components/admin/AdminAiPortal";

export const metadata = {
  title: "EIU Applied Agentic AI · Private Knowledge AI",
};

export default async function AdminAiPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  const role = getAccessRole(token);

  if (role !== "admin") {
    redirect("/login");
  }

  return <AdminAiPortal />;
}
