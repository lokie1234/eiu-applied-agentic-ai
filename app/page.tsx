import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PdfDeckClient from "@/components/PdfDeckClient";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/access";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!verifyAccessToken(token)) redirect("/login");
  return <PdfDeckClient />;
}
