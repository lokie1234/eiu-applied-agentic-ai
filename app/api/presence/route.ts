import { realtimeConfigured } from "@/lib/realtime/server";
import { NextResponse } from "next/server";
import { currentRole, teachingSections } from "@/lib/currentRole";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { SCOPED_PRESENCE_TTL_MS, scopedPresenceKey, summarizeScopedPresence } from "@/lib/scopedPresence";

type TrackedSection = "section1" | "section2";
const PRESENCE_TTL_MS = 35_000;

function validSection(value: string): value is TrackedSection {
  return value === "section1" || value === "section2";
}

async function getPresenceCounts(allowed: readonly string[], signal?: AbortSignal) {
  const supabase = getSupabaseAdmin(signal);
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();

  const countSection = (section: TrackedSection) => supabase
    .from("presence_sessions")
    .select("client_id", { count: "exact", head: true })
    .eq("section", section)
    .is("left_at", null)
    .gt("last_seen_at", cutoff);

  const [section1Result, section2Result] = await Promise.all([
    allowed.includes("section1") ? countSection("section1") : { count: 0, error: null },
    allowed.includes("section2") ? countSection("section2") : { count: 0, error: null },
  ]);
  if (section1Result.error) throw section1Result.error;
  if (section2Result.error) throw section2Result.error;

  const section1 = section1Result.count ?? 0;
  const section2 = section2Result.count ?? 0;
  return { section1, section2, total: section1 + section2 };
}

export async function GET(request?: Request) {
  try {
    if (request && new URL(request.url).searchParams.get("scope") === "all") {
      const access = await currentUserAccess(request.signal);
      const sections = access?.sections.filter(section => access.isAdmin || section.canFacilitate) || [];
      if (!access?.isActive || (!access.isAdmin && !sections.length)) return NextResponse.json({ message: "Không có quyền xem learner." }, { status: 403 });
      const rows: Array<{ client_id: string; section: string }> = [];
      const db = getSupabaseAdmin(request.signal);
      const cutoff = new Date(Date.now() - SCOPED_PRESENCE_TTL_MS).toISOString();
      // One paginated stream of active rows, not one count query per section.
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.from("presence_sessions").select("client_id,section").in("section", ["section1","section2"])
          .is("left_at",null).gt("last_seen_at",cutoff).order("client_id").range(offset,offset+999);
        if (error) throw error;
        rows.push(...(data || []));if (!data || data.length < 1000) break;
      }
      return NextResponse.json({ success:true,counts:summarizeScopedPresence(rows,sections,access.courses) },{headers:{"Cache-Control":"no-store, max-age=0"}});
    }
    const allowed = await teachingSections(undefined, request?.signal);
    if (!allowed.length) {
      return NextResponse.json({ success: false, message: "Chỉ admin mới xem được số người đang học." }, { status: 403 });
    }

    return NextResponse.json(
      { success: true, counts: await getPresenceCounts(allowed, request?.signal) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (request?.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled." }, { status: 499, headers: { "Cache-Control": "no-store" } });
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
    const access = await currentUserAccess(request.signal);
    if (typeof payload.sectionId === "string") {
      const scope = access?.sections.find(section => section.id === payload.sectionId);
      const course = access?.courses.find(course => course.id === scope?.courseId);
      if (!access?.isActive || !scope || !course || scope.hidden || course.hidden) return NextResponse.json({ message:"Không có quyền mở section này." },{status:403});
      // Admin/teaching visits must not inflate learner counts or learner exports.
      if (access.isAdmin || scope.canFacilitate) return NextResponse.json({success:true,tracked:false});
      if (!clientId || !["enter","heartbeat","leave"].includes(action)) return NextResponse.json({message:"Thông tin hiện diện không hợp lệ."},{status:400});
      const identity = access.learnerIdentity || {sessionId:access.authUserId,name:access.displayName,email:access.email,information:{}};
      const key = scopedPresenceKey(scope.id,access.authUserId,clientId);
      const db = getSupabaseAdmin(request.signal), now = new Date().toISOString();
      if (action === "leave") {
        const {error} = await db.from("presence_sessions").update({left_at:now,last_seen_at:now}).eq("client_id",key);
        if(error)throw error;
      } else {
        const entryId = String(payload.entryId || "").slice(0,120);
        if (action === "enter" && !entryId) return NextResponse.json({message:"Thiếu thông tin mở section."},{status:400});
        const saveEntry = async () => {
          if(action !== "enter") return;
          const eventId = scopedPresenceKey(scope.id,access.authUserId,entryId);
          const {data:existing,error:readError} = await db.from("access_audit_logs").select("id").eq("action","SECTION_OPENED").gte("created_at",new Date(Date.now()-300_000).toISOString()).contains("details",{eventId}).limit(1).maybeSingle();
          if(readError)throw readError;
          if(!existing){
            const {error} = await db.from("access_audit_logs").insert({action:"SECTION_OPENED",actor_email:identity.email,course_id:course.id,
              details:{...identity,eventId,courseId:course.id,courseTitle:course.title,sectionId:scope.id,section:scope.sectionKey,sectionTitle:scope.title,folderGroupId:course.folderGroupId,folderGroupName:course.folderGroupName}});
            if(error)throw error;
          }
        };
        const savePresence = async () => {
          if (payload.realtime === true && realtimeConfigured()) return;
          const {error} = await db.from("presence_sessions").upsert({client_id:key,section:scope.sectionKey === "section2" ? "section2" : "section1",name:identity.name.slice(0,80),email:identity.email.slice(0,100),last_seen_at:now,left_at:null},{onConflict:"client_id"});
          if(error)throw error;
        };
        // Live presence must not wait for the durable entry-history lookup.
        await Promise.all([savePresence(), saveEntry()]);
      }
      return NextResponse.json({success:true},{headers:{"Cache-Control":"no-store"}});
    }
    const role = await currentRole(access);

    if (!clientId || !validSection(section)) {
      return NextResponse.json({ success: false, message: "Thông tin hiện diện không hợp lệ." }, { status: 400 });
    }
    if (role !== "admin" && role !== section) {
      return NextResponse.json({ success: false, message: "Không có quyền cập nhật Section này." }, { status: 403 });
    }
    const profile = role === "admin" ? null : await currentLearnerProfile(access);
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
    if (request.signal.aborted) return NextResponse.json({ success: false, message: "Request cancelled." }, { status: 499, headers: { "Cache-Control": "no-store" } });
    console.error("Presence POST error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lỗi cập nhật hiện diện." },
      { status: 500 },
    );
  }
}
