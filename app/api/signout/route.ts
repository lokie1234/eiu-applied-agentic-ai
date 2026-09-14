import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/access";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
