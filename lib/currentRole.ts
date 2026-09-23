import "server-only";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";

export async function currentRole() {
  const cookieStore = await cookies();
  return getAccessRole(cookieStore.get(ACCESS_COOKIE)?.value);
}
