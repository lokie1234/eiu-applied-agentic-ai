import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/access";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (verifyAccessToken(token)) redirect("/");
  return <LoginForm />;
}
