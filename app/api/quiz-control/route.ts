import { NextResponse } from "next/server";
import { currentRole, canFacilitateSection } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentUserAccess } from "@/lib/auth/currentUser";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { readQuizProgress } from "@/lib/quizProgress";

type SectionId = "section1" | "section2";

function isSectionId(value: string): value is SectionId {
  return value === "section1" || value === "section2";
}

export async function GET(request: Request) {
  try {
    const access = await currentUserAccess(request.signal);
    const role = await currentRole(access);
    const params = new URL(request.url).searchParams;
    const section = params.get("section") ?? "";

    if (!isSectionId(section)) {
      return NextResponse.json({ success: false, message: "Section không hợp lệ." }, { status: 400 });
    }
    const teaching = await canFacilitateSection(section, access);
    if (!teaching && role !== section) {
      return NextResponse.json({ success: false, message: "Không có quyền truy cập Quiz này." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin(request.signal);
    const includeProgress = params.get("includeProgress") === "1";
    const profile = includeProgress ? await currentLearnerProfile(access) : null;
    const [{ data: state, error: stateError }, result] = await Promise.all([supabase
      .from("section_state")
      .select("quiz_open, quiz_opened_at")
      .eq("section", section)
      .maybeSingle(),
      profile?.section === section ? readQuizProgress(profile.identity, section, request.signal) : Promise.resolve(null),
    ]);
    if (stateError) throw stateError;

    const isOpen = state?.quiz_open === true;
    if (!teaching) {
      return NextResponse.json(
        { success: true, section, isOpen, ...(includeProgress ? { result } : {}) },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    let resultsQuery = supabase
      .from("quiz_results")
      .select("name, email, completed_at")
      .eq("section", section)
      .order("completed_at", { ascending: false });

    if (state?.quiz_opened_at) {
      resultsQuery = resultsQuery.gte("completed_at", state.quiz_opened_at);
    }

    const { data: results, error: resultsError } = await resultsQuery;
    if (resultsError) throw resultsError;

    const seenEmails = new Set<string>();
    const completedLearners = (results ?? []).flatMap((result) => {
      const email = String(result.email ?? "").toLowerCase();
      if (!email || seenEmails.has(email)) return [];
      seenEmails.add(email);
      return [{
        name: String(result.name ?? "Học viên"),
        completedAt: String(result.completed_at ?? ""),
      }];
    });

    return NextResponse.json(
      { success: true, section, isOpen, completedLearners, ...(includeProgress ? { result } : {}) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Quiz control status error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể tải trạng thái Quiz." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const section = String(body.section ?? "");
    if (!isSectionId(section)) {
      return NextResponse.json({ success: false, message: "Section không hợp lệ." }, { status: 400 });
    }

    if (!(await canFacilitateSection(section))) {
      return NextResponse.json({ success: false, message: "Teaching access required for this section." }, { status: 403 });
    }

    const openedAt = new Date().toISOString();
    const { error } = await getSupabaseAdmin()
      .from("section_state")
      .upsert(
        { section, quiz_open: true, quiz_opened_at: openedAt, updated_at: openedAt },
        { onConflict: "section" },
      );
    if (error) throw error;

    return NextResponse.json({ success: true, section, isOpen: true, openedAt });
  } catch (error) {
    console.error("Quiz control open error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể mở Quiz." },
      { status: 500 },
    );
  }
}
