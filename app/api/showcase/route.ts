import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSectionSessionStartedAt } from "@/lib/sectionSession";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ShowcaseSection = "section1" | "section2";
type ShowcaseRow = { id: string; name: string; url: string; shared_at: string };

function normalizeSection(value: unknown): ShowcaseSection {
  return String(value ?? "").trim() === "section2" ? "section2" : "section1";
}

function validAppsScriptUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" &&
      (host === "script.google.com" || host.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

function validHttpsUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function validShareUrl(value: string, section: ShowcaseSection) {
  return section === "section2" ? validHttpsUrl(value) : validAppsScriptUrl(value);
}

function toItem(row: ShowcaseRow) {
  return { id: row.id, name: row.name, url: row.url, sharedAt: row.shared_at };
}

async function canAccess(section: ShowcaseSection) {
  const role = await currentRole();
  return role === "admin" || role === section;
}

export async function GET(request: Request) {
  try {
    const section = normalizeSection(new URL(request.url).searchParams.get("section"));
    if (!(await canAccess(section))) {
      return NextResponse.json({ success: false, message: "Không có quyền truy cập Section này." }, { status: 403 });
    }

    const sessionStartedAt = await getSectionSessionStartedAt(section);
    const { data, error } = await getSupabaseAdmin()
      .from("showcase_items")
      .select("id, name, url, shared_at")
      .eq("section", section)
      .gte("shared_at", sessionStartedAt)
      .order("shared_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json(
      { success: true, items: (data as ShowcaseRow[]).map(toItem) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Showcase GET error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể tải danh sách." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const section = normalizeSection(body.section);
    if (!(await canAccess(section))) {
      return NextResponse.json({ success: false, message: "Không có quyền gửi bài vào Section này." }, { status: 403 });
    }

    const url = String(body.url ?? "").trim();
    if (body.website) return NextResponse.json({ success: true });
    const profile = await currentLearnerProfile();
    if (!profile || profile.section !== section) {
      return NextResponse.json(
        { success: false, message: "Vui lòng hoàn tất thông tin học viên trước khi chia sẻ." },
        { status: 403 },
      );
    }
    if (url.length > 500 || !validShareUrl(url, section)) {
      return NextResponse.json({
        success: false,
        message: section === "section2"
          ? "Liên kết bài làm phải là URL HTTPS hợp lệ."
          : "Liên kết phải là ứng dụng Google Apps Script hợp lệ.",
      }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("showcase_items")
      .insert({ section, name: profile.name, email: profile.email, url })
      .select("id, name, url, shared_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, item: toItem(data as ShowcaseRow) });
  } catch (error) {
    console.error("Showcase POST error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể chia sẻ bài làm." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json({ success: false, message: "Chỉ quản trị viên mới có quyền xóa." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: "Thao tác xóa trên slide chỉ ẩn dữ liệu cục bộ. Dữ liệu gốc chỉ được xóa bằng chức năng Reset dữ liệu.",
    });
  } catch (error) {
    console.error("Showcase DELETE error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể xóa bài chia sẻ." },
      { status: 500 },
    );
  }
}
