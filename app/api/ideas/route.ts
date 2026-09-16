import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, getAccessRole } from "@/lib/access";

type IdeaItem = {
  id: string;
  idea: string;
  submittedAt: string;
};

function webhookUrl() {
  return process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ?? "";
}

async function currentRole() {
  const cookieStore = await cookies();
  return getAccessRole(cookieStore.get(ACCESS_COOKIE)?.value);
}

async function readAppsScriptJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      /^\s*</.test(text)
        ? "Apps Script đang trả về HTML. Hãy triển khai Code.gs thành phiên bản Web app mới với quyền Bất kỳ ai."
        : "Apps Script trả về dữ liệu không hợp lệ.",
    );
  }
}

export async function GET() {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ admin mới có quyền xem danh sách ý tưởng." },
        { status: 403 },
      );
    }

    const endpoint = webhookUrl();
    if (!endpoint) {
      return NextResponse.json(
        { success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." },
        { status: 503 },
      );
    }

    const url = new URL(endpoint);
    url.searchParams.set("action", "idea.list");
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim() ?? "";
    if (secret) url.searchParams.set("secret", secret);

    const upstream = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });
    const payload = await readAppsScriptJson(upstream);
    if (!upstream.ok || payload.success !== true) {
      throw new Error(String(payload.message ?? "Không thể tải danh sách ý tưởng."));
    }

    const items: IdeaItem[] = (Array.isArray(payload.items) ? payload.items : [])
      .map((item: Partial<IdeaItem>) => ({
        id: String(item.id ?? "").slice(0, 100),
        idea: String(item.idea ?? "").trim().slice(0, 500),
        submittedAt: String(item.submittedAt ?? "").slice(0, 80),
      }))
      .filter((item: IdeaItem) => item.id && item.idea)
      .slice(0, 30);

    return NextResponse.json(
      { success: true, items },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Idea list error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Không thể tải danh sách ý tưởng.",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if ((await currentRole()) !== "section1") {
      return NextResponse.json(
        { success: false, message: "Chỉ phiên học viên Section 1 mới được gửi ý tưởng." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const idea = String(body.idea ?? "").trim();
    if (!idea || idea.length > 500) {
      return NextResponse.json(
        { success: false, message: "Ý tưởng phải có nội dung và không vượt quá 500 ký tự." },
        { status: 400 },
      );
    }

    const endpoint = webhookUrl();
    if (!endpoint) {
      return NextResponse.json(
        { success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." },
        { status: 503 },
      );
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "idea.submit",
        secret: process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "",
        idea,
      }),
      cache: "no-store",
      redirect: "follow",
    });
    const payload = await readAppsScriptJson(upstream);
    if (!upstream.ok || payload.success !== true) {
      throw new Error(String(payload.message ?? "Không thể gửi ý tưởng."));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Idea submit error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Không thể gửi ý tưởng.",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json(
        { success: false, message: "Chỉ admin mới có quyền xóa ý tưởng." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const clearAll = body.all === true;
    const id = String(body.id ?? "").trim();
    if (!clearAll && (!id || id.length > 100)) {
      return NextResponse.json(
        { success: false, message: "Mã ý tưởng không hợp lệ." },
        { status: 400 },
      );
    }

    const endpoint = webhookUrl();
    if (!endpoint) {
      return NextResponse.json(
        { success: false, message: "Chưa cấu hình GOOGLE_APPS_SCRIPT_URL trên Vercel." },
        { status: 503 },
      );
    }

    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET ?? "";

    async function deleteOne(targetId: string) {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "idea.delete", secret, id: targetId }),
        cache: "no-store",
        redirect: "follow",
      });
      const payload = await readAppsScriptJson(upstream);
      if (!upstream.ok || payload.success !== true) {
        throw new Error(String(payload.message ?? "Không thể xóa ý tưởng."));
      }
    }

    if (!clearAll) {
      await deleteOne(id);
      return NextResponse.json({ success: true });
    }

    // Apps Script hiện tại chỉ trả tối đa 30 ý tưởng/lần. Lặp list → delete
    // để nút "Xóa hết" hoạt động mà KHÔNG cần sửa/redeploy Code.gs.
    let deleted = 0;
    for (let pass = 0; pass < 100; pass += 1) {
      const listUrl = new URL(endpoint);
      listUrl.searchParams.set("action", "idea.list");
      if (secret) listUrl.searchParams.set("secret", secret);

      const listResponse = await fetch(listUrl, { cache: "no-store", redirect: "follow" });
      const listPayload = await readAppsScriptJson(listResponse);
      if (!listResponse.ok || listPayload.success !== true) {
        throw new Error(String(listPayload.message ?? "Không thể tải danh sách ý tưởng để xóa."));
      }

      const ids = (Array.isArray(listPayload.items) ? listPayload.items : [])
        .map((item: { id?: unknown }) => String(item?.id ?? "").trim())
        .filter((value: string) => value && value.length <= 100);

      if (ids.length === 0) break;
      for (const targetId of ids) {
        await deleteOne(targetId);
        deleted += 1;
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("Idea delete error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Không thể xóa ý tưởng.",
      },
      { status: 502 },
    );
  }
}
