import { NextResponse } from "next/server";
import { ACTIVE_SECTION_COOKIE } from "@/lib/auth/types";
import { ACCESS_SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
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
  response.cookies.set({
    name: ACCESS_SESSION_COOKIE,
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
