import { NextResponse } from "next/server";
import { ACCESS_COOKIE, createAccessToken, type AccessRole } from "@/lib/access";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "").trim();
    const accessCode = String(process.env.ACCESS_CODE ?? "").trim();
    const adminAccessCode = String(process.env.ADMIN_ACCESS_CODE ?? "").trim();

    if (!accessCode) {
      return NextResponse.json(
        { success: false, message: "Mã truy cập người học chưa được cấu hình trên Vercel." },
        { status: 500 }
      );
    }

    let role: AccessRole | null = null;
    if (adminAccessCode && code === adminAccessCode) role = "admin";
    else if (code === accessCode) role = "user";

    if (!role) {
      return NextResponse.json(
        { success: false, message: "Mã truy cập không đúng." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, role });
    response.cookies.set({
      name: ACCESS_COOKIE,
      value: createAccessToken(role),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: role === "admin" ? 60 * 60 * 12 : 60 * 60 * 24 * 400,
    });

    return response;
  } catch (error) {
    console.error("Access API error:", error);
    return NextResponse.json(
      { success: false, message: "Yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }
}
