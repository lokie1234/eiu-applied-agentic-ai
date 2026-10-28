import { notifyRealtime } from "@/lib/realtime/publish";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { APPLIED_AGENTIC_AI_SLUG } from "@/lib/auth/types";

type SectionId = "section1" | "section2";

function validSection(value: string): value is SectionId {
  return value === "section1" || value === "section2";
}

async function readOrCreateToken(section: SectionId, signal?: AbortSignal) {
  const supabase = getSupabaseAdmin(signal);
  const { data, error } = await supabase
    .from("section_state")
    .select("termination_token")
    .eq("section", section)
    .maybeSingle();
  if (error) throw error;
  if (data?.termination_token) return String(data.termination_token);

  const token = crypto.randomUUID();
  const { data: created, error: createError } = await getSupabaseAdmin()
    .from("section_state")
    .upsert({ section, termination_token: token }, { onConflict: "section" })
    .select("termination_token")
    .single();
  if (createError) throw createError;
  return String(created.termination_token);
}

export async function GET(request: Request) {
  try {
    const role = await currentRole(undefined, request.signal);
    if (!role) {
      return NextResponse.json({ success: false, message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
    }

    const section = new URL(request.url).searchParams.get("section") ?? "";
    if (!validSection(section)) {
      return NextResponse.json({ success: false, message: "Section không hợp lệ." }, { status: 400 });
    }
    if (role !== "admin" && role !== section) {
      return NextResponse.json({ success: false, message: "Không có quyền truy cập Section này." }, { status: 403 });
    }

    const token = await readOrCreateToken(section, request.signal);
    return NextResponse.json(
      { success: true, section, token, terminationToken: token },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Section status error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể kiểm tra trạng thái Section." },
      { status: 500 },
    );
  }
}

async function handlePost(request: Request) {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json({ success: false, message: "Chỉ admin mới có quyền terminate." }, { status: 403 });
    }

    const body = await request.json();
    const section = String(body.section ?? "");
    if (!validSection(section)) {
      return NextResponse.json({ success: false, message: "Section không hợp lệ." }, { status: 400 });
    }

    const access = await currentUserAccess(request.signal);
    const core = access?.courses.find(course => course.slug === APPLIED_AGENTIC_AI_SLUG);
    if (!access?.sections.some(item => item.courseId === core?.id && item.sectionKey === section && item.terminationEnabled)) {
      return NextResponse.json({ message: "Enable Terminate section in Admin Access Settings first." }, { status: 403 });
    }
    const token = crypto.randomUUID();
    const sessionStartedAt = new Date().toISOString();
    const { error } = await getSupabaseAdmin().from("section_state").upsert(
      {
        section,
        termination_token: token,
        session_started_at: sessionStartedAt,
        quiz_open: false,
        quiz_opened_at: null,
        updated_at: sessionStartedAt,
      },
      { onConflict: "section" },
    );
    if (error) throw error;

    return NextResponse.json({ success: true, section, token, sessionStartedAt });
  } catch (error) {
    console.error("Section terminate error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể kết thúc Section." },
      { status: 500 },
    );
  }
}

export async function POST(...args: Parameters<typeof handlePost>) {
  const response = await handlePost(...args);
  if (response.ok) notifyRealtime();
  return response;
}
