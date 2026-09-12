import { NextResponse } from "next/server";

type ShowcaseItem = { id: string; name: string; url: string; sharedAt: string };

function webhookUrl() {
  return process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ?? "";
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
    const text = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Apps Script đang trả về trang HTML. Hãy triển khai dạng Web app và chọn quyền truy cập Anyone.");
    }
    if (!response.ok || payload.success === false) throw new Error(String(payload.message ?? "Không thể tải Showcase."));
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
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể tải Showcase." }, { status: 500 });
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
    if (url.length > 500 || !validAppsScriptUrl(url)) return NextResponse.json({ success: false, message: "Link phải là Web App Google Apps Script hợp lệ." }, { status: 400 });
    if (!endpoint) return NextResponse.json({ success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." }, { status: 503 });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "showcase.submit", secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "", name, url }),
      cache: "no-store",
      redirect: "follow",
    });
    const text = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Apps Script đang trả về trang HTML. Hãy triển khai dạng Web app và chọn quyền truy cập Anyone.");
    }
    if (!response.ok || payload.success === false) throw new Error(String(payload.message ?? "Không thể chia sẻ Web App."));
    const item = payload.item as ShowcaseItem;
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Showcase POST error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không thể chia sẻ Web App." }, { status: 500 });
  }
}
