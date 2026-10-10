import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { OAuth2Client } from "google-auth-library";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { driveSectionName } from "@/lib/sectionSourceFiles";
import { saveDriveOriginal } from "./sourceUpload";

export async function saveBuiltinSection(client: OAuth2Client, input: { sectionId: string; folderId: string }) {
  const db = getSupabaseAdmin();
  const { data: section } = await db.from("course_sections").select("id,course_id,section_key,title,position").eq("id", input.sectionId).maybeSingle();
  if (!section || !["section1", "section2"].includes(section.section_key)) throw Error("Built-in section not found.");
  const { data: course } = await db.from("courses").select("slug,title").eq("id", section.course_id).maybeSingle();
  if (course?.slug !== "applied-agentic-ai") throw Error("Built-in course not found.");
  const body = await readFile(path.join(process.cwd(), "lib/drive/builtin-decks", `${section.section_key}.tsx.txt`));
  const hash = createHash("sha256").update(`builtin-tsx:${section.id}`).digest("hex").slice(0, 32);
  const sourceId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
  return saveDriveOriginal(client, {
    sourceId, sectionId: section.id, folderId: input.folderId,
    name: driveSectionName(section.position, section.title, "tsx"),
    mimeType: "text/plain", sha256: createHash("sha256").update(body).digest("hex"), body,
  });
}
