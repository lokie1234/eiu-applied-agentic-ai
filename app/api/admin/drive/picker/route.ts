import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { authorizedDriveClient, driveConfig } from "@/lib/drive/connection";
import { SECTION_SOURCE_DESTINATIONS, type SectionSourceType } from "@/lib/sectionSourceFiles";

export const runtime = "nodejs";
const responseHeaders = { "Cache-Control": "no-store, private" };

export async function POST(request: Request) {
  if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403, headers: responseHeaders });
  try {
    // The access token must never be issued to a cross-origin caller.
    if (request.headers.get("origin") !== new URL(driveConfig().redirectUri).origin) {
      return NextResponse.json({ message: "Invalid request origin." }, { status: 403, headers: responseHeaders });
    }
    const payload = await request.json() as { action?: unknown; type?: unknown; folderId?: unknown };
    if (typeof payload.type !== "string" || !Object.hasOwn(SECTION_SOURCE_DESTINATIONS, payload.type)) {
      return NextResponse.json({ message: "Invalid source type." }, { status: 400, headers: responseHeaders });
    }
    const type = payload.type as SectionSourceType;
    const folderId = SECTION_SOURCE_DESTINATIONS[type];
    if (payload.action === "open") {
      const apiKey = process.env.GOOGLE_DRIVE_PICKER_API_KEY?.trim();
      if (!apiKey) return NextResponse.json({ message: "Thêm GOOGLE_DRIVE_PICKER_API_KEY vào .env.local trước khi chọn folder." }, { status: 503, headers: responseHeaders });
      const client = await authorizedDriveClient();
      const { token } = await client.getAccessToken();
      if (!token) throw new Error("Missing access token.");
      const appId = process.env.GOOGLE_DRIVE_PROJECT_NUMBER?.trim() || driveConfig().clientId.split("-")[0];
      if (!/^\d+$/.test(appId)) throw new Error("Invalid Google project number.");
      return NextResponse.json({ accessToken: token, apiKey, appId, folderId }, { headers: responseHeaders });
    }
    if (payload.action === "verify") {
      if (payload.folderId !== folderId) return NextResponse.json({ message: "Bạn chọn khác folder đã cấu hình cho loại file này. Hãy chọn đúng folder đích." }, { status: 400, headers: responseHeaders });
      const client = await authorizedDriveClient();
      const { data } = await client.request<{ name: string; mimeType: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean } }>({
        url: `https://www.googleapis.com/drive/v3/files/${folderId}`, timeout: 10000,
        params: { supportsAllDrives: true, fields: "name,mimeType,trashed,capabilities(canAddChildren)" },
      });
      if (data.mimeType !== "application/vnd.google-apps.folder" || data.trashed || !data.capabilities?.canAddChildren) {
        return NextResponse.json({ message: "Folder chưa có quyền thêm file. Kiểm tra quyền Drive rồi thử lại." }, { status: 403, headers: responseHeaders });
      }
      return NextResponse.json({ folder: { type, id: folderId, name: data.name, available: true } }, { headers: responseHeaders });
    }
    return NextResponse.json({ message: "Invalid action." }, { status: 400, headers: responseHeaders });
  } catch {
    // Provider exceptions can include access tokens; do not return/log them.
    return NextResponse.json({ message: "Không thể mở hoặc xác minh folder. Kiểm tra Google Picker API, API key và kết nối tài khoản." }, { status: 502, headers: responseHeaders });
  }
}
