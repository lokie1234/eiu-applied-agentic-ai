import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import {
  createLearnerProfileToken,
  LEARNER_PROFILE_COOKIE,
  normalizeLearnerProfile,
} from "@/lib/learnerProfile";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const profile = await currentLearnerProfile();
  return NextResponse.json(
    { success: true, profile },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "section1" && role !== "section2") {
      return NextResponse.json(
        { success: false, message: "Chỉ học viên mới cần tạo hồ sơ phiên học." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const profile = normalizeLearnerProfile(body.name, body.email, role);
    if (!profile) {
      return NextResponse.json(
        { success: false, message: "Họ tên hoặc email EIU không hợp lệ." },
        { status: 400 },
      );
    }

    const { error } = await getSupabaseAdmin().from("learner_profiles").upsert(
      {
        email: profile.email,
        name: profile.name,
        section: profile.section,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (error) throw error;

    const response = NextResponse.json({ success: true, profile });
    response.cookies.set({
      name: LEARNER_PROFILE_COOKIE,
      value: createLearnerProfileToken(profile),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
    return response;
  } catch (error) {
    console.error("Learner profile error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể lưu hồ sơ." },
      { status: 500 },
    );
  }
}
