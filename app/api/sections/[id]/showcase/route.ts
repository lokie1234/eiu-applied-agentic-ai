import { randomUUID } from "node:crypto";
import { notifyRealtime } from "@/lib/realtime/publish";
import { NextResponse } from "next/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSectionTermination } from "@/lib/sectionTermination";
import { getCompiledSectionMetadata } from "@/lib/compiledSectionMetadata";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { prepareShowcaseImage, readShowcaseForm, readShowcaseBytes, showcaseImagePath, ShowcaseInputError, SHOWCASE_IMAGE_BUCKET, SHOWCASE_IMAGE_LIMIT } from "@/lib/showcaseImage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
type Row = { id: string | number; created_at: string; details: { name?: string; url?: string; imageId?: string } };
const item = (row: Row) => ({ id: String(row.id), name: row.details.name || "Learner", url: row.details.url || "", sharedAt: row.created_at, ...(row.details.imageId ? { kind: "image" } : {}) });

async function resolve(request: Request, context: Context) {
  const [{ id: sectionId }, access] = await Promise.all([context.params, currentUserAccess(request.signal)]);
  const section = access?.sections.find(section => section.id === sectionId);
  const course = access?.courses.find(course => course.id === section?.courseId);
  if (!access?.isActive || !section || !course || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  const metadata = getCompiledSectionMetadata(sectionId);
  const activityId = new URL(request.url).searchParams.get("activity");
  const practice = activityId ? Object.values(metadata?.showcasePractices || {}).find(entry => entry.activityId === activityId) : metadata?.showcasePractice;
  if (activityId && !practice) return null;
  return { access, section, course, practice };
}

export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "You do not have access to this section." }, { status: 403 });
    const imageId = new URL(request.url).searchParams.get("image");
    if (imageId !== null) {
      if (!/^[a-f0-9-]{36}$/i.test(imageId)) return NextResponse.json({ message: "Image not found." }, { status: 404 });
      const path = showcaseImagePath(scope.course.id, scope.section.id, imageId), db = getSupabaseAdmin(request.signal);
      // Terminate hides the board; durable report links survive until Reset.
      const { data, error } = await db.from("access_audit_logs").select("id").eq("action", "SHOWCASE_SUBMITTED")
        .contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit", imageId }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ message: "Image not found." }, { status: 404 });
      const stored = await db.storage.from(SHOWCASE_IMAGE_BUCKET).download(path);
      if (stored.error || !stored.data) throw new Error("Image storage unavailable.");
      return new Response(await stored.data.arrayBuffer(), { headers: {
        "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="shared-work.webp"', "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Content-Security-Policy": "default-src 'none'; sandbox",
      } });
    }
    const termination = await readSectionTermination(scope.course.id, scope.section.id, request.signal);
    let query = getSupabaseAdmin(request.signal).from("access_audit_logs").select("id, created_at, details").eq("action", "SHOWCASE_SUBMITTED")
      .contains("details", { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit" });
    if (termination) query = query.gt("id", termination.id);
    if (scope.practice) query = query.contains("details", { showcaseSession: termination?.details.token || "initial" });
    if (scope.practice?.activityId) query = query.contains("details", { showcaseActivity: scope.practice.activityId });
    else if (scope.practice) query = query.is("details->>showcaseActivity", null);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ success: true, items: (data as Row[]).map(item) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Section showcase GET:", error);
    return NextResponse.json({ message: "Unable to load shared work. Please try again." }, { status: 500 });
  }
}

async function handlePost(request: Request, context: Context) {
  let uploadedPath: string | null = null, committed = false;
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    const scope = await resolve(request, context);
    if (!scope) return NextResponse.json({ message: "You do not have access to this section." }, { status: 403 });
    const { access, course, section, practice } = scope;
    if (access.isAdmin || section.canFacilitate) return NextResponse.json({ message: "Use a learner session to share work." }, { status: 403 });
    const identity = access.learnerIdentity || { sessionId: access.authUserId, name: access.displayName, email: access.email, information: {} };
    if (!identity.sessionId || !identity.name?.trim()) return NextResponse.json({ message: "Sign in through Learning Access before sharing." }, { status: 403 });
    const termination = practice ? await readSectionTermination(course.id, section.id, request.signal) : null, epoch = termination?.details.token || "initial";
    let url = "", imageId: string | undefined;
    const db = getSupabaseAdmin(request.signal);
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (!practice?.allowImages) return NextResponse.json({ message: "Image sharing is not enabled for this section." }, { status: 400 });
      const limit = await consumeRateLimit(`showcase:${identity.sessionId}`, { group: "showcase-images", limit: 5, networkLimit: 500 }, request.headers, request.signal);
      if (!limit.allowed) return NextResponse.json({ message: "Too many uploads. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retry_after) } });
      const form = await readShowcaseForm(request);
      if (form.get("website")) throw new ShowcaseInputError("Invalid submission.");
      const file = form.get("image");
      if (!(file instanceof File)) throw new ShowcaseInputError("Choose an image to share.");
      const bytes = await prepareShowcaseImage(file);
      imageId = randomUUID();
      const path = showcaseImagePath(course.id, section.id, imageId);
      const bucket = await db.storage.getBucket(SHOWCASE_IMAGE_BUCKET);
      if (bucket.error) {
        if (!/not found|does not exist/i.test(bucket.error.message)) throw bucket.error;
        const created = await db.storage.createBucket(SHOWCASE_IMAGE_BUCKET, { public: false, fileSizeLimit: SHOWCASE_IMAGE_LIMIT, allowedMimeTypes: ["image/webp"] });
        if (created.error && !/already exists|duplicate/i.test(created.error.message)) throw created.error;
      }
      const configured = await db.storage.getBucket(SHOWCASE_IMAGE_BUCKET);
      if (configured.error || configured.data?.public !== false) throw new Error("Image sharing requires private storage.");
      const upload = await db.storage.from(SHOWCASE_IMAGE_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false });
      if (upload.error) throw upload.error;
      uploadedPath = path;
      url = new URL(`/api/sections/${section.id}/showcase?image=${imageId}`, request.url).href;
    } else {
      const raw = (await readShowcaseBytes(request, 2048)).toString("utf8");
      if (raw.length > 2048) throw new ShowcaseInputError("The link is too long.", 413);
      let body; try { body = JSON.parse(raw); } catch { throw new ShowcaseInputError("Invalid submission."); }
      if (body.website) throw new ShowcaseInputError("Invalid submission.");
      url = typeof body.url === "string" ? body.url.trim() : "";
      let valid = false;
      try { const parsed = new URL(url); valid = parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password; } catch { /* invalid URL */ }
      if (!valid || url.length > 500) throw new ShowcaseInputError("Paste a valid HTTPS link.");
    }
    request.signal.throwIfAborted();
    if (practice) {
      const current = await readSectionTermination(course.id, section.id, request.signal);
      if ((current?.details.token || "initial") !== epoch) throw new ShowcaseInputError("This classroom session has ended. Reload before sharing.", 409);
    }
    // One durable record: reuse the existing identity, report and revision feed.
    const { data, error } = await db.from("access_audit_logs").insert({
      action: "SHOWCASE_SUBMITTED", actor_email: identity.email, course_id: course.id,
      details: { ...identity, courseId: course.id, courseTitle: course.title, folderGroupId: course.folderGroupId, folderGroupName: course.folderGroupName, sectionId: section.id, sectionTitle: section.title, section: section.sectionKey, url, submissionStorage: "audit", ...(imageId ? { imageId } : {}), ...(practice ? { showcaseSession: epoch, ...(practice.activityId ? { showcaseActivity: practice.activityId, showcaseActivityLabel: practice.title } : {}) } : {}) },
    }).select("id, created_at, details").single();
    if (error) throw error;
    committed = true;
    return NextResponse.json({ success: true, item: item(data as Row) });
  } catch (error) {
    if (uploadedPath && !committed) {
      try { const removed = await getSupabaseAdmin().storage.from(SHOWCASE_IMAGE_BUCKET).remove([uploadedPath]); if (removed.error) console.error("Uncommitted showcase image cleanup failed."); } catch { console.error("Uncommitted showcase image cleanup failed."); }
    }
    if (error instanceof ShowcaseInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Section showcase POST:", error);
    return NextResponse.json({ message: "Unable to save your work. Please try again." }, { status: 500 });
  }
}

export async function POST(...args: Parameters<typeof handlePost>) {
  const response = await handlePost(...args);
  if (response.ok) notifyRealtime();
  return response;
}

export async function DELETE(request: Request, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    const scope = await resolve(request, context);
    if (!scope || !scope.practice?.allowDelete || (!scope.access.isAdmin && !scope.section.canFacilitate)) return NextResponse.json({ message: "Only this section's teacher or an administrator can delete shared work." }, { status: 403 });
    const limit = await consumeRateLimit(`showcase-delete:${scope.access.authUserId}`, { group: "showcase-delete", limit: 30, networkLimit: 1000 }, request.headers, request.signal);
    if (!limit.allowed) return NextResponse.json({ message: "Too many deletions. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retry_after) } });
    let body;
    try { body = JSON.parse((await readShowcaseBytes(request, 512)).toString("utf8")); } catch (error) {
      if (error instanceof ShowcaseInputError) throw error;
      throw new ShowcaseInputError("Invalid deletion request.");
    }
    const id = typeof body?.id === "string" ? body.id : "";
    if (!/^[1-9]\d{0,19}$/.test(id)) throw new ShowcaseInputError("Choose a valid submission to delete.");
    // Resolve the row using its complete server-owned scope, not a supplied URL.
    const activityId = scope.practice.activityId;
    const details = { courseId: scope.course.id, sectionId: scope.section.id, submissionStorage: "audit" };
    const db = getSupabaseAdmin();
    let selectedQuery = db.from("access_audit_logs").select("id, details").eq("id", id).eq("action", "SHOWCASE_SUBMITTED").eq("course_id", scope.course.id).contains("details", details);
    selectedQuery = activityId ? selectedQuery.contains("details", { showcaseActivity: activityId }) : selectedQuery.is("details->>showcaseActivity", null);
    const selected = await selectedQuery.maybeSingle();
    if (selected.error) throw selected.error;
    if (!selected.data) return NextResponse.json({ message: "This work is no longer available in this practice." }, { status: 404 });
    request.signal.throwIfAborted();
    // Finish an authorized deletion even if the presenter navigates away.
    // Remove the attachment first, leaving the record available for retry on failure.
    const imageId = (selected.data.details as Row["details"])?.imageId;
    if (imageId) {
      const removed = await db.storage.from(SHOWCASE_IMAGE_BUCKET).remove([showcaseImagePath(scope.course.id, scope.section.id, imageId)]);
      if (removed.error) throw removed.error;
    }
    let deleteQuery = db.from("access_audit_logs").delete().eq("id", id).eq("action", "SHOWCASE_SUBMITTED").eq("course_id", scope.course.id).contains("details", details);
    deleteQuery = activityId ? deleteQuery.contains("details", { showcaseActivity: activityId }) : deleteQuery.is("details->>showcaseActivity", null);
    const deleted = await deleteQuery.select("id").maybeSingle();
    if (deleted.error) throw deleted.error;
    if (!deleted.data) return NextResponse.json({ message: "This work is no longer available in this practice." }, { status: 404 });
    notifyRealtime();
    return NextResponse.json({ success: true, deletedId: id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ShowcaseInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Section showcase DELETE:", error);
    return NextResponse.json({ message: "Unable to finish deleting this work. Please retry." }, { status: 500 });
  }
}
