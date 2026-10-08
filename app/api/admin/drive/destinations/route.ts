import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { authorizedDriveClient, driveConfig } from "@/lib/drive/connection";
import { driveDestinations, driveFolderId, verifyDriveFolder } from "@/lib/drive/destinations";
const headers = { "Cache-Control": "no-store, private" };
export async function GET() {
  if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  try { return NextResponse.json({ destinations: await driveDestinations() }, { headers }); }
  catch { return NextResponse.json({ message: "Apply the Drive destinations migration before managing folders." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(driveConfig().redirectUri).origin) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const payload = await request.json();
    const db = getSupabaseAdmin();
    const account = driveConfig().accountEmail;
    if (payload.action === "delete") {
      const { error } = await db.from("google_drive_destinations").delete().eq("id", String(payload.id)).eq("account_email", account);
      if (error) throw error;
    } else {
      const label = String(payload.label ?? "").trim();
      if (!label || label.length > 100) return NextResponse.json({ message: "Enter a folder label (up to 100 characters)." }, { status: 400 });
      const folderId = driveFolderId(String(payload.link ?? ""));
      await verifyDriveFolder(await authorizedDriveClient(), folderId);
      const row = { account_email: account, label, folder_id: folderId, updated_at: new Date().toISOString() };
      const { error } = payload.id
        ? await db.from("google_drive_destinations").update(row).eq("id", String(payload.id)).eq("account_email", account)
        : await db.from("google_drive_destinations").upsert(row, { onConflict: "account_email,folder_id" });
      if (error) throw error;
    }
    return NextResponse.json({ destinations: await driveDestinations() }, { headers });
  } catch { return NextResponse.json({ message: "Unable to save this folder. Browse Drive to grant access, then check the link and try again." }, { status: 400, headers }); }
}
