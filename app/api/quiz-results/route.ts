import { notifyRealtime } from "@/lib/realtime/publish";
import { recordLearnerActivity } from "@/lib/learnerActivity";
import { NextResponse } from "next/server";
import { currentRole } from "@/lib/currentRole";
import { currentLearnerProfile } from "@/lib/currentLearnerProfile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readQuizProgress } from "@/lib/quizProgress";
import { currentUserAccess } from "@/lib/auth/currentUser";

type SectionId = "section1" | "section2";
type AnswerRecord = {
  question: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
};

function normalizeAnswers(value: unknown): AnswerRecord[] | null {
  if (!Array.isArray(value) || value.length !== 10) return null;
  const answers = value.map((entry) => {
    const record = entry as Partial<AnswerRecord>;
    return {
      question: String(record.question ?? "").trim().slice(0, 500),
      selected: String(record.selected ?? "").trim().slice(0, 300),
      correct: String(record.correct ?? "").trim().slice(0, 300),
      isCorrect: record.isCorrect === true,
    };
  });
  return answers.every((answer) => answer.question && answer.selected && answer.correct)
    ? answers
    : null;
}

export async function GET(request: Request) {
  try {
    const section = new URL(request.url).searchParams.get("section");
    const profile = await currentLearnerProfile(undefined, request.signal);
    if (!profile || profile.section !== section) return NextResponse.json({ message: "Access denied." }, { status: 403 });
    return NextResponse.json({ success: true, result: await readQuizProgress(profile.identity, section, request.signal) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Unable to restore your quiz result." }, { status: 500 });
  }
}

async function handlePost(request: Request) {
  try {
    const body = await request.json();
    const section: SectionId = body.section === "section2" ? "section2" : "section1";
    const access = await currentUserAccess(request.signal);
    const role = await currentRole(access);
    if (role !== "admin" && role !== section) {
      return NextResponse.json({ success: false, message: "Không có quyền gửi kết quả cho Section này." }, { status: 403 });
    }

    const score = Number(body.score);
    const total = Number(body.total);
    const answers = normalizeAnswers(body.answers);

    if (body.website) return NextResponse.json({ success: true });
    const profile = await currentLearnerProfile(access);
    if (!profile || profile.section !== section) {
      return NextResponse.json(
        { success: false, message: "Vui lòng hoàn tất thông tin học viên trước khi gửi kết quả." },
        { status: 403 },
      );
    }
    if (!Number.isInteger(score) || !Number.isInteger(total) || total !== 10 || score < 0 || score > total) {
      return NextResponse.json({ success: false, message: "Kết quả bài kiểm tra không hợp lệ." }, { status: 400 });
    }
    if (!answers || answers.filter((answer) => answer.isCorrect).length !== score) {
      return NextResponse.json({ success: false, message: "Chi tiết câu trả lời không hợp lệ." }, { status: 400 });
    }

    const previous = await readQuizProgress(profile.identity, section);
    if (previous) return NextResponse.json({ success: true, ...previous });
    const requestedAt = new Date(String(body.completedAt ?? ""));
    const completedAt = Number.isNaN(requestedAt.getTime()) ? new Date().toISOString() : requestedAt.toISOString();
    const { data: saved, error } = await getSupabaseAdmin().from("quiz_results").insert({
      section,
      name: profile.name,
      email: profile.email,
      score,
      total,
      answers,
      completed_at: completedAt,
    }).select("id").single();
    if (error) throw error;
    await recordLearnerActivity(profile.identity, "QUIZ_COMPLETED", section, saved.id);

    return NextResponse.json({ success: true, learner: { name: profile.name, email: profile.email, information: profile.identity.information, fields: profile.identity.fields || [] } });
  } catch (error) {
    console.error("Quiz result API error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể gửi kết quả." },
      { status: 500 },
    );
  }
}

export async function POST(...args: Parameters<typeof handlePost>) {
  const response = await handlePost(...args);
  if (response.ok) notifyRealtime();
  return response;
}
