import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { authorizedDriveClient, driveConfig } from "@/lib/drive/connection";
import { selectedDestination, verifyDriveFolder } from "@/lib/drive/destinations";
import { exportDocument, exportPlan, webFolder } from "@/lib/drive/export";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(driveConfig().redirectUri).origin) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const input = await request.json();
    const destination = await selectedDestination(String(input.destinationId ?? ""));
    const client = await authorizedDriveClient();
    await verifyDriveFolder(client, destination.folder_id);
    if (input.action === "plan") return NextResponse.json({ tasks: await exportPlan(input.groupId, input.sectionId, input.courseId) }, { headers: { "Cache-Control": "no-store" } });
    if (input.action !== "save" || typeof input.sectionId !== "string") return NextResponse.json({ message: "Invalid export request." }, { status: 400 });
    if (input.groupId || input.courseId) {
      const tasks = await exportPlan(input.groupId, undefined, input.courseId);
      if (!tasks.some(task => task.sectionId === input.sectionId && task.sourceId === input.sourceId)) return NextResponse.json({ message: "Document does not belong to this web folder." }, { status: 400 });
    }
    const folderId = input.groupId || input.courseId ? await webFolder(client, destination.folder_id, input.groupId, input.courseId) : destination.folder_id;
    const fileId = await exportDocument(client, { sectionId: input.sectionId, sourceId: input.sourceId, folderId, name: input.name });
    return NextResponse.json({ success: true, fileId, folderId });
  } catch { return NextResponse.json({ message: "Unable to save this document. Check Drive folder access and stored source availability, then retry." }, { status: 502 }); }
}
