import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";
import {
  getPresenceCounts,
  recordPresence,
  removePresence,
  type TrackedSection,
} from "@/lib/presence";

async function currentRole() {
  const cookieStore = await cookies();
  return getAccessRole(cookieStore.get(ACCESS_COOKIE)?.value);
}

export async function GET() {
  try {
    const role = await currentRole();
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Phiên đăng nhập đã hết hạn." },
        { status: 401 }
      );
    }

    const counts = getPresenceCounts();
    return NextResponse.json(
      { success: true, counts },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Presence GET error:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi kiểm tra số lượng truy cập." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let payload: Record<string, unknown> = {};

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    } else {
      const rawText = await request.text().catch(() => "");
      try {
        payload = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        // Fallback for simple string bodies
      }
    }

    const action = String(payload.action ?? "heartbeat");
    const clientId = String(payload.clientId ?? "").trim();
    const section = String(payload.section ?? "").trim() as TrackedSection;

    if (!clientId) {
      return NextResponse.json(
        { success: false, message: "Thiếu clientId." },
        { status: 400 }
      );
    }

    if (action === "leave") {
      removePresence(clientId);
      return NextResponse.json({ success: true, counts: getPresenceCounts() });
    }

    if (section === "section1" || section === "section2") {
      recordPresence(clientId, section);
    }

    return NextResponse.json(
      { success: true, counts: getPresenceCounts() },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Presence POST error:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi cập nhật hiện diện." },
      { status: 500 }
    );
  }
}

