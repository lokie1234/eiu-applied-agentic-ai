import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type TrackedSection = "section1" | "section2";
const PRESENCE_TTL_MS = 35_000;

function validSection(value: string): value is TrackedSection {
  return value === "section1" || value === "section2";
}

async function getPresenceCounts() {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();

  await supabase
    .from("presence_sessions")
    .update({ left_at: new Date().toISOString() })
    .is("left_at", null)
    .lt("last_seen_at", cutoff);

  const countSection = (section: TrackedSection) => supabase
    .from("presence_sessions")
    .select("client_id", { count: "exact", head: true })
    .eq("section", section)
    .is("left_at", null)
    .gt("last_seen_at", cutoff);

  const [section1Result, section2Result] = await Promise.all([
    countSection("section1"),
    countSection("section2"),
  ]);
  if (section1Result.error) throw section1Result.error;
  if (section2Result.error) throw section2Result.error;

  const section1 = section1Result.count ?? 0;
  const section2 = section2Result.count ?? 0;
  return { section1, section2, total: section1 + section2 };
}

export async function GET() {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json({ success: false, message: "Chỉ admin mới xem được số người đang học." }, { status: 403 });
    }

    return NextResponse.json(
      { success: true, counts: await getPresenceCounts() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Presence GET error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi kiểm tra số lượng truy cập." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    let payload: Record<string, unknown> = {};
    const rawText = await request.text().catch(() => "");
    try {
      payload = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // sendBeacon may use text/plain; an invalid body is rejected below.
    }

    const action = String(payload.action ?? "heartbeat");
    const clientId = String(payload.clientId ?? "").trim().slice(0, 120);
    const section = String(payload.section ?? "").trim();
    const role = await currentRole();

    if (!clientId || !validSection(section)) {
      return NextResponse.json({ success: false, message: "Thông tin hiện diện không hợp lệ." }, { status: 400 });
    }
    if (role !== "admin" && role !== section) {
      return NextResponse.json({ success: false, message: "Không có quyền cập nhật Section này." }, { status: 403 });
    }
    const profile = role === "admin" ? null : await currentLearnerProfile();
    if (role !== "admin" && !profile) {
      return NextResponse.json(
        { success: false, message: "Chưa có thông tin học viên." },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    if (action === "leave") {
      const { error } = await supabase
        .from("presence_sessions")
        .update({ left_at: now, last_seen_at: now })
        .eq("client_id", clientId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("presence_sessions").upsert(
        {
          client_id: clientId,
          section,
          name: profile?.name ?? null,
          email: profile?.email ?? null,
          last_seen_at: now,
          left_at: null,
        },
        { onConflict: "client_id" },
      );
      if (error) throw error;
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Presence POST error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi cập nhật hiện diện." },
      { status: 500 },
    );
  }
}
