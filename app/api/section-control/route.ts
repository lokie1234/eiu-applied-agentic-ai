import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";
import { callAppsScript } from "@/lib/googleAppsScript";

type SectionId = "section1" | "section2";

function validSection(value: string): value is SectionId {
  return value === "section1" || value === "section2";
}

async function currentRole() {
  const cookieStore = await cookies();
  return getAccessRole(cookieStore.get(ACCESS_COOKIE)?.value);
}

export async function GET(request: Request) {
  try {
    const role = await currentRole();
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Phiên đăng nhập đã hết hạn." },
        { status: 401 },
      );
    }

    const section = new URL(request.url).searchParams.get("section") ?? "";
    if (!validSection(section)) {
      return NextResponse.json(
        { success: false, message: "Section không hợp lệ." },
        { status: 400 },
      );
    }
    if (role !== "admin" && role !== section) {
      return NextResponse.json(
        { success: false, message: "Không có quyền truy cập Section này." },
        { status: 403 },
      );
    }

    const payload = await callAppsScript(
      "section.status",
      { section },
      "GET",
    );
    if (payload.success !== true || !payload.token) {
      throw new Error(
        String(payload.message ?? "Không thể kiểm tra trạng thái Section."),
      );
    }

    return NextResponse.json(
      { success: true, section, token: String(payload.token) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Section status error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Không thể kiểm tra trạng thái Section.",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const role = await currentRole();
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ admin mới có quyền terminate." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const section = String(body.section ?? "");
    if (!validSection(section)) {
      return NextResponse.json(
        { success: false, message: "Section không hợp lệ." },
        { status: 400 },
      );
    }

    const payload = await callAppsScript("section.terminate", { section });
    if (payload.success !== true || !payload.token) {
      throw new Error(
        String(payload.message ?? "Không thể kết thúc Section."),
      );
    }

    return NextResponse.json({
      success: true,
      section,
      token: String(payload.token),
    });
  } catch (error) {
    console.error("Section terminate error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Không thể kết thúc Section.",
      },
      { status: 502 },
    );
  }
}
