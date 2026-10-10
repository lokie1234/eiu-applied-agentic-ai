import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { authorizedDriveClient, driveConfig } from "@/lib/drive/connection";
import { selectedDestination, verifyDriveFolder } from "@/lib/drive/destinations";
import { exportDocument, exportPlan, webFolder } from "@/lib/drive/export";
import { saveBuiltinSection } from "@/lib/drive/builtinExport";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  if (!(await requireAdminAccess())) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(driveConfig().redirectUri).origin) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const input = await request.json();
    if (input.action === "plan") return NextResponse.json({ tasks: await exportPlan(input.groupId, input.sectionId, input.courseId) }, { headers: { "Cache-Control": "no-store" } });
    const destination = await selectedDestination(String(input.destinationId ?? ""));
    const client = await authorizedDriveClient();
    await verifyDriveFolder(client, destination.folder_id);
    if (input.action === "save_builtin" && typeof input.sectionId === "string" && !input.groupId && !input.courseId) {
      const fileId = await saveBuiltinSection(client, { sectionId: input.sectionId, folderId: destination.folder_id });
      return NextResponse.json({ success: true, fileId });
    }
    if (!["save", "save_builtin"].includes(input.action) || typeof input.sectionId !== "string") return NextResponse.json({ message: "Invalid export request." }, { status: 400 });
    let matchedTask: Awaited<ReturnType<typeof exportPlan>>[number] | undefined;
    if (input.groupId || input.courseId) {
      const tasks = await exportPlan(input.groupId, undefined, input.courseId);
      matchedTask = tasks.find(task => task.sectionId === input.sectionId && task.sourceId === input.sourceId && Boolean(task.builtin) === (input.action === "save_builtin"));
      if (!matchedTask) return NextResponse.json({ message: "Document does not belong to this web folder." }, { status: 400 });
    }
    let folderId = destination.folder_id;
    if (input.groupId) {
      folderId = await webFolder(client, folderId, input.groupId);
      folderId = await webFolder(client, folderId, undefined, matchedTask!.courseId);
    } else if (input.courseId) folderId = await webFolder(client, folderId, undefined, input.courseId);
    const fileId = input.action === "save_builtin"
      ? await saveBuiltinSection(client, { sectionId: input.sectionId, folderId })
      : await exportDocument(client, { sectionId: input.sectionId, sourceId: input.sourceId, folderId, name: input.name });
    revalidatePath("/learn");
    return NextResponse.json({ success: true, fileId, folderId });
  } catch (error) { return NextResponse.json({ message: error instanceof Error && /^(File saved to Drive, but|Drive file verification failed)/.test(error.message) ? error.message : "Unable to save this document. Check Drive folder access and stored source availability, then retry." }, { status: 502 }); }
}
