import { courseHierarchy } from "./courseHierarchy";
import { reportScope } from "./reportScopes";
import type { getSupabaseAdmin } from "./supabase/server";

type Row = Record<string, unknown>;
type Database = ReturnType<typeof getSupabaseAdmin>;
export type ResetScopeInput = { folderId: string; courseId: string; sectionId: string };
export class InvalidResetScope extends Error {}
const ACTIONS = ["PASSCODE_LOGIN", "SECTION_OPENED", "SECTION_TERMINATED", "IDEA_SUBMITTED", "SHOWCASE_SUBMITTED", "QUIZ_OPENED", "QUIZ_COMPLETED", "FEEDBACK_SUBMITTED", "ACTIVITY_SUBMITTED"];

async function readAll(db: Database, table: string, columns: string, learningOnly = false) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(table).select(columns).order("id");
    if (learningOnly) query = query.in("action", ACTIONS);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []) as unknown as Row[]);
    if (!data || data.length < 1000) return rows;
  }
}

export async function resolveResetScope(db: Database, input: ResetScopeInput) {
  const [rawCourses, sections] = await Promise.all([readAll(db,"courses","*"), readAll(db,"course_sections","*")]);
  const { courses: normalizedCourses, folders } = courseHierarchy(rawCourses);
  const courses: Row[] = normalizedCourses;
  const course = courses.find(course => course.id === input.courseId);
  const section = sections.find(section => section.id === input.sectionId);
  if (input.folderId !== "all" && !folders.some(folder => folder.id === input.folderId)
    || input.courseId !== "all" && (!course || input.folderId !== "all" && course.folderGroupId !== input.folderId)
    || input.sectionId !== "all" && (!section || input.courseId !== "all" && section.course_id !== input.courseId
      || input.folderId !== "all" && courses.find(course => course.id === section.course_id)?.folderGroupId !== input.folderId)) {
    throw new InvalidResetScope("The selected folder, course and section do not match the current catalog.");
  }
  const selected = sections.filter(section => (input.sectionId === "all" || section.id === input.sectionId)
    && (input.courseId === "all" || section.course_id === input.courseId)
    && (input.folderId === "all" || courses.find(course => course.id === section.course_id)?.folderGroupId === input.folderId));
  const all = Object.values(input).every(value => value === "all");
  if (!all && !selected.length) throw new InvalidResetScope("The selected scope has no sections to reset.");
  const ids = new Set(selected.map(section => String(section.id)));
  const coreId = courses.find(course => course.slug === "applied-agentic-ai")?.id;
  const legacySections = selected.filter(section => section.course_id === coreId && ["section1","section2"].includes(String(section.section_key))).map(section => String(section.section_key));
  const labels = [input.folderId === "all" ? "All folders" : folders.find(folder => folder.id === input.folderId)?.name,
    input.courseId === "all" ? "All courses" : course?.title,
    input.sectionId === "all" ? `All sections (${selected.length})` : section?.title];
  return { all, courses, sections, ids, legacySections, label: labels.join(" / ") };
}

export async function resetScopedLearningData(db: Database, scope: Awaited<ReturnType<typeof resolveResetScope>>) {
  const selected = (row: Row) => scope.ids.has(String(reportScope(row,scope.courses,scope.sections).sectionId));
  // Snapshot every page before mutations so deleting page one cannot skip page two.
  const activity = await readAll(db,"access_audit_logs","id,action,details,course_id",true);
  const deleteIds: unknown[] = [];
  const loginUpdates: Array<{ id: unknown; details: Row }> = [];
  for (const row of activity) {
    const details = (row.details || {}) as Row;
    if (row.action !== "PASSCODE_LOGIN") {
      if (selected({ ...details, courseId: details.courseId || row.course_id })) deleteIds.push(row.id);
      continue;
    }
    const scopes = Array.isArray(details.scopes) ? details.scopes as Row[]
      : (Array.isArray(details.sectionKeys) ? details.sectionKeys : []).map(section => ({ section }));
    const remaining = scopes.filter(item => !selected(item));
    if (remaining.length === scopes.length) continue;
    if (!remaining.length) deleteIds.push(row.id);
    else loginUpdates.push({ id: row.id, details: { ...details, scopes: remaining, sectionKeys: [...new Set(remaining.map(item => String(item.section || "")))] } });
  }
  const check = async (query: PromiseLike<{ error: { message: string } | null }>) => { const {error} = await query; if(error)throw error; };
  for (let i=0;i<deleteIds.length;i+=200) await check(db.from("access_audit_logs").delete().in("id",deleteIds.slice(i,i+200)));
  for (const login of loginUpdates) await check(db.from("access_audit_logs").update({details:login.details}).eq("id",login.id));
  // These physical tables predate scoped courses and belong only to Applied AI.
  if (scope.legacySections.length) {
    await Promise.all(["learner_profiles","ideas","showcase_items","quiz_results","feedback"].map(table => check(db.from(table).delete().in("section",scope.legacySections))));
    await check(db.from("presence_sessions").delete().in("section",scope.legacySections).not("client_id","like","v2:%"));
    const now = new Date().toISOString();
    await check(db.from("section_state").update({quiz_open:false,quiz_opened_at:null,termination_token:crypto.randomUUID(),session_started_at:now,updated_at:now}).in("section",scope.legacySections));
  }
  for (const id of scope.ids) {
    const escaped = id.replace(/[\\%_]/g, "\\$&");
    await check(db.from("presence_sessions").delete().like("client_id",`v2:${escaped}:%`));
  }
}
