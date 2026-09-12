import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PdfDeckClient from "@/components/PdfDeckClient";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  const role = getAccessRole(token);
  if (!role) redirect("/login");
  return <PdfDeckClient isAdmin={role === "admin"} />;
}
