import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RESET_CONFIRMATION = "Lovekjng123@@";
const LEARNING_ACTIONS = ["PASSCODE_LOGIN", "IDEA_SUBMITTED", "SHOWCASE_SUBMITTED", "QUIZ_COMPLETED", "FEEDBACK_SUBMITTED"];

async function resetLearningActivity(supabase: ReturnType<typeof getSupabaseAdmin>, section: string) {
  if (section === "all") {
    const { error } = await supabase.from("access_audit_logs").delete().in("action", LEARNING_ACTIONS);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("access_audit_logs").delete()
    .in("action", LEARNING_ACTIONS.filter(action => action !== "PASSCODE_LOGIN"))
    .eq("details->>section", section);
  if (error) throw error;

  // A global/folder login can appear in several learner sheets. Remove only
  // this section from its scope, retaining the identity for other sections.
  const logins: Array<{ id: number; details: Record<string, unknown> }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: readError } = await supabase.from("access_audit_logs").select("id,details")
      .eq("action", "PASSCODE_LOGIN").contains("details", { sectionKeys: [section] })
      .order("id").range(offset, offset + 999);
    if (readError) throw readError;
    logins.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  for (const login of logins) {
    const remaining = (login.details.sectionKeys as string[]).filter(key => key !== section);
    const result = remaining.length
      ? await supabase.from("access_audit_logs").update({ details: { ...login.details, sectionKeys: remaining } }).eq("id", login.id)
      : await supabase.from("access_audit_logs").delete().eq("id", login.id);
    if (result.error) throw result.error;
  }
}

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
    const password = typeof body.password === "string" ? body.password : "";
    const requestedSection = body.section?.trim().toLowerCase() || "all";

    if (password !== RESET_CONFIRMATION) {
      return NextResponse.json(
        { success: false, message: "Incorrect confirmation passcode." },
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
    const resetAll = requestedSection === "all";
    const results = await Promise.all([
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
    ]);

    const errors = results.map(result => result.error).filter(Boolean);
    if (errors.length > 0) {
      console.error("Reset data errors:", errors);
      throw new Error(errors[0]?.message || "Unable to delete data from Supabase.");
    }

    await resetLearningActivity(supabase, requestedSection);
    const resetAt = new Date().toISOString();
    const sectionStateUpdate = supabase.from("section_state").update({
      quiz_open: false,
      quiz_opened_at: null,
      termination_token: crypto.randomUUID(),
      session_started_at: resetAt,
      updated_at: resetAt,
    });
    const { error: stateError } = await (resetAll
      ? sectionStateUpdate.neq("section", "")
      : sectionStateUpdate.eq("section", requestedSection));
    if (stateError) throw stateError;

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
