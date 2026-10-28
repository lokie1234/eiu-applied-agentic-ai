import { buildReportWorkbook, reportFilename } from "@/lib/reports/workbook";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { collectReportLearners } from "@/lib/reportLearners";
import { reportScope, reportScopeKey, scopedReportActivity } from "@/lib/reportScopes";
import { courseHierarchy } from "@/lib/courseHierarchy";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
type TimeFilter = {
  column: string;
  startIso: string;
  endIso: string;
};

const DEFAULT_SECTIONS = ["section1", "section2"];
const REPORT_ACTIONS = ["PASSCODE_LOGIN", "SECTION_OPENED", "IDEA_SUBMITTED", "SHOWCASE_SUBMITTED", "QUIZ_COMPLETED", "FEEDBACK_SUBMITTED", "ACTIVITY_SUBMITTED"];
const REPORT_COLUMNS: Record<string, string> = {
  courses: "id,slug,title,description", course_sections: "id,course_id,section_key,title,position",
  learner_profiles: "email,name,section,created_at,updated_at", ideas: "id,section,name,email,idea,submitted_at",
  showcase_items: "id,section,name,email,url,shared_at", quiz_results: "id,section,name,email,score,total,answers,completed_at",
  feedback: "id,section,name,email,feedback,submitted_at", section_state: "section,updated_at",
  access_audit_logs: "id,action,details,created_at,course_id",
};

function getDateBounds(dateStr: string, tzOffsetMinutes = -420) {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const valid = new Date(Date.UTC(year, month - 1, day));
  if (valid.getUTCFullYear() !== year || valid.getUTCMonth() !== month - 1 || valid.getUTCDate() !== day) return null;

  // Local time = UTC - tzOffsetMinutes => UTC = Local time + tzOffsetMinutes
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000;
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
    dateStr,
  };
}

async function fetchAll(
  table: string,
  orderColumn: string,
  timeFilter?: TimeFilter | null,
  snapshot?: string,
) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: Row[] = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from(table)
      .select(REPORT_COLUMNS[table])
      .order(orderColumn, { ascending: false });
    if (table === "access_audit_logs") query = query.in("action", REPORT_ACTIONS);

    if (snapshot && timeFilter?.column !== orderColumn) query = query.lte(orderColumn, snapshot);
    if (timeFilter) {
      query = query
        .gte(timeFilter.column, timeFilter.startIso)
        .lte(timeFilter.column, timeFilter.endIso);
    }

    const tie = table === "learner_profiles" ? "email" : table === "section_state" ? "section" : "id";
    if (tie !== orderColumn) query = query.order(tie, { ascending: true });
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function sectionKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function sectionLabel(section: string) {
  const match = section.match(/^section[\s_-]*(\d+)$/i);
  return match ? `Section ${match[1]}` : section;
}

function collectSections(groups: Row[][], configuredSections: unknown[]) {
  const configured = configuredSections.map(sectionKey).filter(Boolean);
  const sections = new Set(configured.length > 0 ? configured : DEFAULT_SECTIONS);
  groups.forEach((rows) => {
    rows.forEach((row) => {
      const section = sectionKey(row.section);
      if (section) sections.add(section);
    });
  });
  return [...sections].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
  );
}

export async function GET(request: Request) {
  try {
    const exportedAt = new Date();
    if ((await currentRole()) !== "admin") return Response.json({ success: false, message: "Chỉ admin mới có quyền xuất report." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode")?.trim().toLowerCase() || "report";
    const requestedSection = sectionKey(searchParams.get("section")) || "all";
    const requestedCourse = searchParams.get("courseId")?.trim() || "all";
    const requestedSectionId = searchParams.get("sectionId")?.trim() || "all";
    const requestedFolder = searchParams.get("folderId")?.trim() || "all";
    const [rawCourses, courseSections] = await Promise.all([fetchAll("courses", "created_at"), fetchAll("course_sections", "position")]);
    const { courses, folders } = courseHierarchy(rawCourses);
    const configuredScopes = courseSections.length ? courseSections.map(section => reportScope({ sectionId: section.id, courseId: section.course_id, section: section.section_key }, courses, courseSections))
      : DEFAULT_SECTIONS.map(section => reportScope({ section }, courses, courseSections));
    if (mode === "sections") {
      const sectionStates = await fetchAll("section_state", "updated_at");
      const sections = collectSections([], sectionStates.map(row => row.section));
      return Response.json({ success: true, sections: sections.map(section => ({ value: section, label: sectionLabel(section) })),
        folders: folders.map(folder=>({value:folder.id,label:folder.name})),
        courses: [...new Map(configuredScopes.map(scope => [String(scope.courseId), { value: String(scope.courseId), label: String(scope.courseTitle), folderGroupId:scope.folderGroupId }])).values()],
        courseSections: configuredScopes.map(scope => ({ value: scope.sectionId, label: scope.sectionTitle, courseId: scope.courseId, courseTitle: scope.courseTitle, folderGroupId:scope.folderGroupId })),
      }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const dateParam = searchParams.get("date")?.trim() || "";
    const tzOffsetMinutes = Number(searchParams.get("tzOffset") ?? -420);
    const dateBounds = dateParam && dateParam !== "all" ? getDateBounds(dateParam, Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : -420) : null;
    if (dateParam && dateParam !== "all" && !dateBounds) return Response.json({ success: false, message: "Ngày báo cáo không hợp lệ." }, { status: 400 });
    const timed = (column: string) => dateBounds ? { column, startIso: dateBounds.startIso, endIso: dateBounds.endIso < exportedAt.toISOString() ? dateBounds.endIso : exportedAt.toISOString() } : null;
    const snapshot = exportedAt.toISOString();
    const [legacyRows, ideaRows, showcaseRows, quizRows, feedbackRows, sectionStates, rawActivity] = await Promise.all([
      fetchAll("learner_profiles", "updated_at", timed("updated_at"), snapshot), fetchAll("ideas", "submitted_at", timed("submitted_at"), snapshot),
      fetchAll("showcase_items", "shared_at", timed("shared_at"), snapshot), fetchAll("quiz_results", "completed_at", timed("completed_at"), snapshot),
      fetchAll("feedback", "submitted_at", timed("submitted_at"), snapshot), fetchAll("section_state", "updated_at"), fetchAll("access_audit_logs", "created_at", timed("created_at"), snapshot),
    ]);
    const normalize = (rows: Row[]) => rows.map(row => reportScope(row, courses, courseSections));
    const activity = scopedReportActivity(rawActivity, courses, courseSections);
    const audited = (action: string, timestamp: string) => activity.filter(row => row.action === action && (row.details as Row).submissionStorage === "audit")
      .map(row => ({ ...(row.details as Row), id: row.id, [timestamp]: row.created_at }));
    const linkIdentity = (rows: Row[], action: string) => normalize(rows.map(row => {
      const reference = activity.find(event => event.action === action && String((event.details as Row).recordId || "") === String(row.id));
      return reference ? { ...row, ...(reference.details as Row), id: row.id } : row;
    }));
    const ideas = linkIdentity(ideaRows, "IDEA_SUBMITTED"), quiz = [...linkIdentity(quizRows, "QUIZ_COMPLETED"), ...audited("QUIZ_COMPLETED", "completed_at")],
      feedback = [...linkIdentity(feedbackRows, "FEEDBACK_SUBMITTED"), ...audited("FEEDBACK_SUBMITTED", "submitted_at")];
    const submissions: Row[] = activity.filter(row => row.action === "SHOWCASE_SUBMITTED" && (row.details as Row).submissionStorage === "audit")
      .map(row => ({ ...(row.details as Row), id: row.id, shared_at: row.created_at }));
    const showcase = [...linkIdentity(showcaseRows, "SHOWCASE_SUBMITTED"), ...submissions];
    const learners = collectReportLearners(normalize(legacyRows), activity, [...ideas, ...showcase, ...quiz, ...feedback]);
    const scopeMap = new Map<string, Row>();
    for (const scope of [...configuredScopes, ...sectionStates.map(row => reportScope(row, courses, courseSections)), ...learners, ...ideas, ...showcase, ...quiz, ...feedback]) {
      if (scope.section) scopeMap.set(reportScopeKey(scope), scope);
    }
    const availableScopes = [...scopeMap.values()].sort((a,b) => String(a.courseTitle).localeCompare(String(b.courseTitle)) || String(a.section).localeCompare(String(b.section), undefined, { numeric: true }));
    if (requestedFolder !== "all" && !folders.some(folder=>folder.id===requestedFolder)
      || requestedCourse !== "all" && !availableScopes.some(scope => scope.courseId === requestedCourse && (requestedFolder === "all" || scope.folderGroupId === requestedFolder))
      || requestedSectionId !== "all" && !availableScopes.some(scope => scope.sectionId === requestedSectionId && (requestedCourse === "all" || scope.courseId === requestedCourse) && (requestedFolder === "all" || scope.folderGroupId === requestedFolder))
      || requestedSection !== "all" && !availableScopes.some(scope => sectionKey(scope.section) === requestedSection)) {
      return Response.json({ success: false, message: "Course hoặc Section được chọn không tồn tại." }, { status: 400 });
    }
    const selected = (row: Row) => (requestedFolder === "all" || row.folderGroupId === requestedFolder) && (requestedCourse === "all" || row.courseId === requestedCourse) && (requestedSectionId === "all" || row.sectionId === requestedSectionId) && (requestedSection === "all" || sectionKey(row.section) === requestedSection);
    const sections = availableScopes.filter(selected);
    const scopedLearners = learners.filter(selected), scopedIdeas = ideas.filter(selected), scopedShowcase = showcase.filter(selected), scopedQuiz = quiz.filter(selected), scopedFeedback = feedback.filter(selected);
    const interactions = activity.flatMap<Row>(row => {
      const details = row.details as Row;
      if (details.accessMode === "facilitator") return [];
      if (row.action === "PASSCODE_LOGIN") {
        const grant = ((details.scopes || []) as Row[]).find(selected);
        // Record a login once, without pretending every granted section was visited.
        return grant ? [{ ...details, ...grant, sectionTitle: "Quyền truy cập", id: row.id, action: row.action, created_at: row.created_at }] : [];
      }
      const event = { ...details, id: row.id, action: row.action, created_at: row.created_at };
      return selected(event) ? [event] : [];
    });
    const dataset = { scopes: sections, learners: scopedLearners, ideas: scopedIdeas, showcase: scopedShowcase, activity: interactions,
      quiz: scopedQuiz, feedback: scopedFeedback, date: dateBounds?.dateStr || null, exportedAt };
    const workbook = await buildReportWorkbook(dataset);
    const output = await workbook.xlsx.writeBuffer();
    const filename = reportFilename(dataset);
    return new Response(new Uint8Array(output), { headers: {
      "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } });
  } catch(error) {
    console.error("Report export error:",error);return Response.json({success:false,message:error instanceof Error?error.message:"Không thể xuất report."},{status:500});
  }
}
