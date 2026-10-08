import "server-only";
import type { OAuth2Client } from "google-auth-library";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { driveConfig } from "./connection";
export type DriveDestination = { id: string; label: string; folder_id: string };
export function driveFolderId(value: string) {
  const text = value.trim();
  let id = text;
  if (text.startsWith("https://")) {
    const url = new URL(text);
    if (url.hostname !== "drive.google.com") throw new Error("Use a Google Drive folder link.");
    id = url.pathname.match(/\/folders\/([\w-]+)/)?.[1] ?? "";
  }
  if (!/^[\w-]{10,200}$/.test(id)) throw new Error("Use a valid Google Drive folder link or ID.");
  return id;
}
export async function verifyDriveFolder(client: OAuth2Client, id: string) {
  const { data } = await client.request<{ name: string; mimeType: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean } }>({
    url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveFolderId(id)), timeout: 10000,
    params: { supportsAllDrives: true, fields: "name,mimeType,trashed,capabilities(canAddChildren)" },
  });
  if (data.mimeType !== "application/vnd.google-apps.folder" || data.trashed || !data.capabilities?.canAddChildren) throw new Error("Choose a writable Drive folder.");
  return data.name;
}
export async function driveDestinations(): Promise<DriveDestination[]> {
  const { data, error } = await getSupabaseAdmin().from("google_drive_destinations").select("id,label,folder_id")
    .eq("account_email", driveConfig().accountEmail).order("label");
  if (error) throw new Error("Drive destinations are unavailable. Apply the Drive destinations migration.");
  return data ?? [];
}
export async function selectedDestination(id: string) {
  const destination = (await driveDestinations()).find(item => item.id === id);
  if (!destination) throw new Error("Choose a saved Drive destination.");
  return destination;
}
