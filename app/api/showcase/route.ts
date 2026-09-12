import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";

type ShowcaseItem = { id: string; name: string; url: string; sharedAt: string };

function webhookUrl() {
  return process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ?? "";
}

async function readAppsScriptJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const isHtml = /^\s*</.test(text);
    throw new Error(isHtml
      ? "Apps Script đang trả về trang HTML. Hãy triển khai phiên bản mới và chọn quyền truy cập Bất kỳ ai."
      : "Apps Script trả về dữ liệu không hợp lệ.");
  }
}

function validAppsScriptUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && (host === "script.google.com" || host.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const endpoint = webhookUrl();
    if (!endpoint) return NextResponse.json({ success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." }, { status: 503 });
    const url = new URL(endpoint);
    url.searchParams.set("action", "showcase.list");
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "";
    if (secret) url.searchParams.set("secret", secret);
    const response = await fetch(url, { cache: "no-store", redirect: "follow" });
    const payload = await readAppsScriptJson(response);
    if (!response.ok || payload.success === false) throw new Error(String(payload.message ?? "Không thể tải danh sách."));
    const items: ShowcaseItem[] = (Array.isArray(payload.items) ? payload.items : [])
      .map((item: Partial<ShowcaseItem>) => ({
        id: String(item.id ?? ""),
        name: String(item.name ?? "").trim().slice(0, 80),
        url: String(item.url ?? "").trim().slice(0, 500),
        sharedAt: String(item.sharedAt ?? ""),
      }))
      .filter((item: ShowcaseItem) => item.id && item.name && validAppsScriptUrl(item.url))
      .slice(0, 50);
    return NextResponse.json({ success: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Showcase GET error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể tải danh sách." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const url = String(body.url ?? "").trim();
    const endpoint = webhookUrl();
    if (body.website) return NextResponse.json({ success: true });
    if (!name || name.length > 80) return NextResponse.json({ success: false, message: "Vui lòng nhập tên hợp lệ." }, { status: 400 });
    if (url.length > 500 || !validAppsScriptUrl(url)) return NextResponse.json({ success: false, message: "Liên kết phải là ứng dụng Google Apps Script hợp lệ." }, { status: 400 });
    if (!endpoint) return NextResponse.json({ success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." }, { status: 503 });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "showcase.submit", secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "", name, url }),
      cache: "no-store",
      redirect: "follow",
    });
    const payload = await readAppsScriptJson(response);
    if (!response.ok || payload.success === false) throw new Error(String(payload.message ?? "Không thể chia sẻ ứng dụng."));
    const item = payload.item as ShowcaseItem;
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Showcase POST error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể chia sẻ ứng dụng." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const role = getAccessRole(cookieStore.get(ACCESS_COOKIE)?.value);
    if (role !== "admin") {
      return NextResponse.json({ success: false, message: "Chỉ quản trị viên mới có quyền xóa." }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();
    const endpoint = webhookUrl();
    if (!id || id.length > 100) {
      return NextResponse.json({ success: false, message: "Mã bài chia sẻ không hợp lệ." }, { status: 400 });
    }
    if (!endpoint) {
      return NextResponse.json({ success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." }, { status: 503 });
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "showcase.delete", secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "", id }),
      cache: "no-store",
      redirect: "follow",
    });
    const payload = await readAppsScriptJson(response);
    if (!response.ok || payload.success !== true) throw new Error(String(payload.message ?? "Không thể xóa bài chia sẻ."));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Showcase DELETE error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể xóa bài chia sẻ." }, { status: 500 });
  }
}
