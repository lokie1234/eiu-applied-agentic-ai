import { NextResponse } from "next/server";
import { ACTIVE_SECTION_COOKIE } from "@/lib/auth/types";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";

export async function POST() {
  const supabase = await createSupabaseServerAuthClient();
  await supabase.auth.signOut();
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ACTIVE_SECTION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  for (const legacyCookie of ["eiu_ai_access", "eiu_ai_learner_profile"]) {
    response.cookies.set({
      name: legacyCookie,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}
