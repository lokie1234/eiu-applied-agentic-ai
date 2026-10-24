import "server-only";
import type { OAuth2Client } from "google-auth-library";

/** Recover a previous successful upload when its catalog write was interrupted. */
export async function saveDriveOriginal(client: OAuth2Client, input: {
  sourceId: string; sectionId: string; folderId: string; name: string;
  mimeType: string; sha256: string; body: Uint8Array;
}) {
  if (!/^[a-f0-9-]{36}$/i.test(input.sourceId)) throw new Error("Invalid source ID.");
  const existing = await client.request<{ files: { id: string; name?: string; appProperties?: Record<string, string> }[] }>({
    url: "https://www.googleapis.com/drive/v3/files", timeout: 10000,
    params: { q: `'${input.folderId}' in parents and trashed = false and appProperties has { key='eiuSourceId' and value='${input.sourceId}' }`, fields: "files(id,name,appProperties)", pageSize: 10 },
  });
  const recovered = existing.data.files.find(file => file.appProperties?.eiuSha256 === input.sha256 && file.appProperties?.eiuSectionId === input.sectionId);
  if (recovered) {
    if (recovered.name !== input.name) await client.request({
      url: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(recovered.id), method: "PATCH", timeout: 10000,
      params: { supportsAllDrives: true }, data: { name: input.name },
    });
    return recovered.id;
  }
  const start = await client.request({
    url: "https://www.googleapis.com/upload/drive/v3/files", method: "POST", timeout: 15000,
    params: { uploadType: "resumable", supportsAllDrives: true, fields: "id" },
    headers: { "X-Upload-Content-Type": input.mimeType, "X-Upload-Content-Length": String(input.body.byteLength) },
    data: { name: input.name, mimeType: input.mimeType, parents: [input.folderId], appProperties: { eiuSourceId: input.sourceId, eiuSectionId: input.sectionId, eiuSha256: input.sha256 } },
  });
  const location = start.headers.get("location");
  if (!location) throw new Error("Drive did not return an upload session.");
  const url = new URL(location);
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com") throw new Error("Unexpected upload endpoint.");
  const result = await client.request<{ id: string }>({
    url: location, method: "PUT", timeout: 90000,
    headers: { "Content-Type": input.mimeType, "Content-Length": String(input.body.byteLength) },
    data: Buffer.from(input.body.buffer, input.body.byteOffset, input.body.byteLength),
  });
  if (!result.data.id) throw new Error("Drive upload did not return a file ID.");
  return result.data.id;
}
