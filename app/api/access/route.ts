import { NextResponse } from "next/server";
import { ACCESS_COOKIE, createAccessToken } from "@/lib/access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "").trim();
    const accessCode = String(process.env.ACCESS_CODE ?? "").trim();

    if (!accessCode) {
      return NextResponse.json(
        { success: false, message: "ACCESS_CODE chưa được cấu hình." },
        { status: 500 }
      );
    }

    if (code !== accessCode) {
      return NextResponse.json(
        { success: false, message: "Incorrect access code" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: ACCESS_COOKIE,
      value: createAccessToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });

    return response;
  } catch (error) {
    console.error("Access API error:", error);
    return NextResponse.json(
      { success: false, message: "Invalid request" },
      { status: 400 }
    );
  }
}
