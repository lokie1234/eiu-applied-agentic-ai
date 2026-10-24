import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { OAuth2Client } from "google-auth-library";
import { authorizedDriveClient } from "./connection";
import { selectedDestination, verifyDriveFolder } from "./destinations";
import { saveDriveOriginal } from "./sourceUpload";
import { MAX_SECTION_BYTES } from "@/lib/sectionContent";

// Recheck Drive permissions/version on every read; reuse only verified media.
// Credential changes create a different client and therefore a separate cache.
const mediaCaches = new WeakMap<OAuth2Client, Map<string, { bytes: Uint8Array; revision: string }>>();
const mediaReads = new WeakMap<OAuth2Client, Map<string, Promise<Uint8Array>>>();
const MAX_MEDIA_CACHE_BYTES = 64 * 1024 * 1024;

export function driveFileId(value: string) {
  let id = value.trim();
  if (id.startsWith("drive:override:")) id = id.slice("drive:override:".length);
  else if (id.startsWith("drive:")) id = id.slice(6);
  if (id.startsWith("https://")) {
    const url = new URL(id);
    if (url.hostname !== "drive.google.com") throw new Error("Use a Google Drive file link or ID.");
    id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get("id") || "";
  }
  if (!/^[\w-]{10,200}$/.test(id)) throw new Error("Use a valid Google Drive file link or ID.");
  return id;
}
export async function readDriveFile(value: string, client?: OAuth2Client) {
  const id = driveFileId(value);
  try {
    client ??= await authorizedDriveClient();
    const { data: metadata } = await client.request<{ name: string; size?: string; version?: string; md5Checksum?: string; trashed?: boolean; mimeType: string; capabilities?: { canDownload?: boolean } }>({
      url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id), timeout: 15000,
      params: { supportsAllDrives: true, fields: "name,size,version,md5Checksum,mimeType,trashed,capabilities(canDownload)" },
    });
    if (metadata.trashed || metadata.capabilities?.canDownload === false || metadata.mimeType.startsWith("application/vnd.google-apps.")) throw Error();
    const size = Number(metadata.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_SECTION_BYTES) throw Error();
    const revision = metadata.version || metadata.md5Checksum;
    let cache = mediaCaches.get(client);
    if (!cache) { cache = new Map(); mediaCaches.set(client, cache); }
    const cached = cache.get(id);
    if (revision && cached?.revision === revision && cached.bytes.length === size) {
      cache.delete(id); cache.set(id, cached);
      return { id, name: metadata.name, bytes: cached.bytes };
    }
    cache.delete(id);
    let pending = mediaReads.get(client);
    if (!pending) { pending = new Map(); mediaReads.set(client, pending); }
    const key = JSON.stringify([id, revision, size]);
    const activeClient = client;
    const download = async () => {
      const result = await activeClient.request<ArrayBuffer>({ url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id), timeout: 90000, params: { alt: "media", supportsAllDrives: true }, responseType: "arraybuffer" });
      const bytes = new Uint8Array(result.data);
      if (!bytes.length || bytes.length > MAX_SECTION_BYTES || bytes.length !== size) throw Error();
      if (revision && bytes.length <= MAX_MEDIA_CACHE_BYTES) {
        while (cache.size && (cache.size >= 16 || [...cache.values()].reduce((total, item) => total + item.bytes.length, bytes.length) > MAX_MEDIA_CACHE_BYTES)) cache.delete(cache.keys().next().value!);
        cache.set(id, { bytes, revision });
      }
      return bytes;
    };
    let reading = revision ? pending.get(key) : undefined;
    if (!reading) {
      reading = download().finally(() => pending.delete(key));
      if (revision) pending.set(key, reading);
    }
    const bytes = await reading;
    return { id, name: metadata.name, bytes };
  } catch { throw new Error("Unable to read this Drive file. Check the connected account, file access, and the 50 MB limit."); }
}
export async function uploadDriveSection(input: { sectionId: string; destinationId: string; name: string; bytes: Uint8Array; mimeType: string }) {
  const client = await authorizedDriveClient();
  const destination = await selectedDestination(input.destinationId);
  await verifyDriveFolder(client, destination.folder_id);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const id = await saveDriveOriginal(client, { sourceId: randomUUID(), sectionId: input.sectionId, folderId: destination.folder_id, name: input.name, mimeType: input.mimeType, sha256, body: input.bytes });
  const verified = await readDriveFile(id, client);
  if (createHash("sha256").update(verified.bytes).digest("hex") !== sha256) throw new Error("Drive file verification failed. The existing lesson has not changed.");
  return id;
}
