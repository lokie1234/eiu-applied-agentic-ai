import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUserAccess, requireAdminAccess } from "@/lib/auth/currentUser";
import { currentAccessSession } from "@/lib/auth/session";
import { getSlideTemplates, saveSlideTemplates } from "@/lib/auth/courseAccessStorage";

export const runtime = "nodejs";
export async function GET(request?: Request) {
  try {
    const [session, templates] = await Promise.all([
      currentAccessSession(request?.signal), getSlideTemplates(request?.signal),
    ]);
    const actor = session?.role === "admin" ? { isActive: true } : await currentUserAccess(request?.signal, session);
    if (!actor?.isActive) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    const templateId = request?.url ? new URL(request.url).searchParams.get("id") : null;
    const summaryOnly = request?.url ? new URL(request.url).searchParams.get("summary") === "1" : false;
    const selected = templateId ? templates.filter(template => template.id === templateId) : templates;
    return NextResponse.json({ templates: summaryOnly ? selected.map(({ id, name }) => ({ id, name, background: "" })) : selected }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (request?.signal.aborted) return NextResponse.json({ message: "Request cancelled." }, { status: 499, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ message: "Unable to load layouts." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  if (!await requireAdminAccess()) return NextResponse.json({ message: "Administrator access required." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 3_000_000) return NextResponse.json({ message: "Layout image must be under 2 MB." }, { status: 413 });
    const body = await request.json();
    const templates = await getSlideTemplates();
    if (body.action === "delete") {
      if (!templates.some(template => template.id === body.id)) return NextResponse.json({ message: "Layout not found." }, { status: 404 });
      const updated = templates.filter(template => template.id !== body.id);
      await saveSlideTemplates(updated);
      return NextResponse.json({ templates: updated });
    }
    if (body.action !== "create") return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
    const name = String(body.name ?? "").trim();
    const background = String(body.background ?? "");
    if (!name || name.length > 120 || background.length > 2_800_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(background)) return NextResponse.json({ message: "Enter a layout name and upload a PNG, JPG or WebP image under 2 MB." }, { status: 400 });
    if (templates.length >= 50) return NextResponse.json({ message: "Maximum 50 layouts." }, { status: 400 });
    const updated = [...templates, { id: randomUUID(), name, background }];
    await saveSlideTemplates(updated);
    return NextResponse.json({ templates: updated });
  } catch { return NextResponse.json({ message: "Unable to save layouts. Try again." }, { status: 500 }); }
}
