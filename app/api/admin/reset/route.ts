import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RESET_CONFIRMATION = "RESET";

function formatSectionLabel(section: string): string {
  const match = section.match(/^section\s*(\d+)$/i);
  return match ? `Section ${match[1]}` : section;
}

export async function POST(request: Request) {
  try {
    if ((await currentRole()) !== "admin") {
      return NextResponse.json(
        { success: false, message: "Administrator access is required to reset data." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
      section?: string;
    };
    const password = body.password?.trim() || "";
    const requestedSection = body.section?.trim().toLowerCase() || "all";

    if (password.toUpperCase() !== RESET_CONFIRMATION) {
      return NextResponse.json(
        { success: false, message: "Enter RESET to confirm." },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdmin();

    if (requestedSection !== "all") {
      const { data: configuredSection, error: sectionError } = await supabase
        .from("section_state")
        .select("section")
        .eq("section", requestedSection)
        .maybeSingle();

      if (sectionError) throw sectionError;
      if (!configuredSection) {
        return NextResponse.json(
          { success: false, message: "The selected section does not exist." },
          { status: 400 },
        );
      }
    }

    const learnerDelete = supabase.from("learner_profiles").delete();
    const ideasDelete = supabase.from("ideas").delete();
    const showcaseDelete = supabase.from("showcase_items").delete();
    const quizDelete = supabase.from("quiz_results").delete();
    const feedbackDelete = supabase.from("feedback").delete();
    const presenceDelete = supabase.from("presence_sessions").delete();
    const sectionStateUpdate = supabase.from("section_state").update({
      quiz_open: false,
      quiz_opened_at: null,
      session_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const resetAll = requestedSection === "all";
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      resetAll
        ? learnerDelete.neq("email", "")
        : learnerDelete.eq("section", requestedSection),
      resetAll ? ideasDelete.neq("id", "") : ideasDelete.eq("section", requestedSection),
      resetAll
        ? showcaseDelete.neq("id", "")
        : showcaseDelete.eq("section", requestedSection),
      resetAll ? quizDelete.neq("id", "") : quizDelete.eq("section", requestedSection),
      resetAll
        ? feedbackDelete.neq("id", "")
        : feedbackDelete.eq("section", requestedSection),
      resetAll
        ? presenceDelete.neq("client_id", "")
        : presenceDelete.eq("section", requestedSection),
      resetAll
        ? sectionStateUpdate.neq("section", "")
        : sectionStateUpdate.eq("section", requestedSection),
    ]);

    const errors = [r1.error, r2.error, r3.error, r4.error, r5.error, r6.error, r7.error].filter(Boolean);
    if (errors.length > 0) {
      console.error("Reset data errors:", errors);
      throw new Error(errors[0]?.message || "Unable to delete data from Supabase.");
    }

    const scopeLabel = resetAll ? "all sections" : formatSectionLabel(requestedSection);
    return NextResponse.json({
      success: true,
      message: `Data for ${scopeLabel} was deleted from Supabase.`,
    });
  } catch (error) {
    console.error("Reset data API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to delete data.",
      },
      { status: 500 },
    );
  }
}
