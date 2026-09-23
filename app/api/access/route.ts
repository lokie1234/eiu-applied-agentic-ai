import { NextResponse } from "next/server";
import { ACCESS_COOKIE, createAccessToken, type AccessRole } from "@/lib/access";
import { LEARNER_PROFILE_COOKIE } from "@/lib/learnerProfile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "").trim();
    const sectionOneAccessCode = String(
      process.env.SECTION_1_ACCESS_CODE ?? process.env.ACCESS_CODE ?? ""
    ).trim();
    // Section routing: 8888 => Section 2
    const sectionTwoAccessCode = String(process.env.SECTION_2_ACCESS_CODE ?? "").trim();
    // Admin: 1103 => choose Section 1 or Section 2
    const adminAccessCode = String(process.env.ADMIN_ACCESS_CODE ?? "").trim();

    if (!sectionOneAccessCode) {
      return NextResponse.json(
        { success: false, message: "Mã truy cập Section 1 chưa được cấu hình trên Vercel." },
        { status: 500 }
      );
    }

    let role: AccessRole | null = null;
    if (adminAccessCode && code === adminAccessCode) role = "admin";
    else if (sectionTwoAccessCode && code === sectionTwoAccessCode) role = "section2";
    else if (code === sectionOneAccessCode) role = "section1";

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
    response.cookies.set({
      name: LEARNER_PROFILE_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
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
