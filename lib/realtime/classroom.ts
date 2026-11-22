import "server-only";
import { getCoursesAndSectionsData } from '@/lib/auth/courseAccessStorage';
import { sectionWheelEnabled, wheelLegacySection } from '@/lib/sectionWheel';
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MIS301_SECTION_ID, MIS301_COURSE_ID, mis301Part } from "@/lib/mis301Practice";
import { readSectionTermination } from "@/lib/sectionTermination";
import { realtimeConfigured } from "./server";
import { MIS311_SPOTLIGHT_COURSE_ID, MIS311_SPOTLIGHT_SECTION_ID } from '@/lib/mis311Spotlight';

export const spotlightScope = { courseId: MIS311_SPOTLIGHT_COURSE_ID, sectionId: MIS311_SPOTLIGHT_SECTION_ID };
const practiceScope = { courseId: MIS301_COURSE_ID, sectionId: MIS301_SECTION_ID };
type ClassroomScope={courseId:string;sectionId:string;wheelEnabled?:boolean;legacySection?:string};

export async function classroomSnapshot(signal?: AbortSignal, scope:ClassroomScope = practiceScope) {
  const version = Date.now(), db = getSupabaseAdmin(signal);
  const [termination, wheelEnabled, reset] = await Promise.all([
    readSectionTermination(scope.courseId, scope.sectionId, signal, scope.legacySection),
    scope.wheelEnabled!==undefined ? Promise.resolve(scope.wheelEnabled) : getCoursesAndSectionsData(signal).then(catalog=>sectionWheelEnabled(scope.sectionId,catalog.courses.find(course=>course.id===scope.courseId)?.metadata.sectionWheel)),
    db.from('access_audit_logs').select('details').eq('action','WHEEL_RESET').contains('details',{courseId:scope.courseId,sectionId:scope.sectionId,clearNames:true}).order('id',{ascending:false}).limit(1).maybeSingle(),
  ]);
  const epoch = termination?.details.token || "initial";
  if(reset.error)throw reset.error;
  const clearedAt=reset.data?.details?.epoch===epoch?Number(reset.data.details.requestedAt)||0:0;
  const since = new Date(Math.max(version - 86400_000, termination ? Date.parse(termination.created_at) : 0,clearedAt)).toISOString();
  const cutoff = new Date(version).toISOString();
  const [entries, answers] = await Promise.all([
    db.from("access_audit_logs").select("id,details,created_at").eq("action", "SECTION_OPENED")
      .contains("details", { sectionId: scope.sectionId }).gte("created_at", since).lte("created_at", cutoff)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
    scope.sectionId === MIS301_SECTION_ID ? db.from("access_audit_logs").select("id,details,created_at").eq("action", "ACTIVITY_SUBMITTED")
      .contains("details", { sectionId: MIS301_SECTION_ID, practice: "mis301-pandas", practiceSession: epoch }).lte("created_at", cutoff)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  if (entries.error) throw entries.error;
  if (answers.error) throw answers.error;
  const identities = new Set<string>();
  const members: Array<{ subject: string; username: string }> = [];
  for (const row of entries.data || []) {
    const identity = row.details;
    const email = String(identity.email || "").trim().toLowerCase();
    const realEmail = Boolean(email && !email.endsWith('@passcode.eiu'));
    const username = String(identity.information?.name || identity.information?.username || (realEmail ? identity.name : '') || '').trim();
    // Signed sessions are distinct learners even when an email is shared.
    const key = `session:${identity.sessionId}`;
    if (!username || !identity.sessionId || identities.has(key)) continue;
    identities.add(key); members.push({ subject: String(identity.sessionId), username: username.slice(0, 200) });
  }
  return { sectionId: scope.sectionId, version, epoch, members, wheelEnabled,
    answers: (answers.data || []).filter(row => mis301Part(row.details.partId)).map(row => ({ recordId: String(row.id), subject: String(row.details.sessionId),
      username: String(row.details.name || "Learner"), partId: String(row.details.partId), values: row.details.values as Record<string, string>, submittedAt: row.created_at, ...(Number.isInteger(row.details.assignmentPart) ? { assignmentPart: Number(row.details.assignmentPart) } : {}), ...(Number.isInteger(row.details.questionNumber) ? { questionNumber: Number(row.details.questionNumber) } : {}), ...(typeof row.details.drawId === "string" ? { drawId: row.details.drawId } : {}) })),
  };
}
export async function publishClassroom(signal?: AbortSignal, scope:ClassroomScope = practiceScope) {
  if (!realtimeConfigured()) return false;
  const payload = await classroomSnapshot(signal, scope);
  const response = await fetch(`${process.env.CONVEX_SITE_URL!.replace(/\/$/, "")}/classroom`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REALTIME_BRIDGE_SECRET}` },
    body: JSON.stringify(payload), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Classroom synchronization pending.");
  return true;
}
// Persist section entry first, then publish eligible classroom names.
export async function syncClassroomEntry(sectionId = MIS301_SECTION_ID, courseId?: string, wheelEnabled?:boolean, legacySection?:string) {
  const scope = courseId ? {courseId,sectionId,wheelEnabled,legacySection} : sectionId === MIS311_SPOTLIGHT_SECTION_ID ? spotlightScope : practiceScope;
  try { await publishClassroom(AbortSignal.timeout(2000), scope); }
  catch { notifyClassroom(scope); }
}
export function notifyClassroom(scope:ClassroomScope = practiceScope) {
  if (!realtimeConfigured()) return;
  after(async () => { try { await publishClassroom(undefined, scope); } catch { console.error("Classroom projection pending reconciliation; report data remains saved."); } });
}
export function notifyAllWheelClassrooms(){
  if(!realtimeConfigured())return;
  after(async()=>{
    try{
      const catalog=await getCoursesAndSectionsData();
      const scopes=catalog.sections.filter(section=>section.status==='active'&&(section.id===MIS301_SECTION_ID||sectionWheelEnabled(section.id,catalog.courses.find(course=>course.id===section.course_id)?.metadata.sectionWheel))).map(section=>{const course=catalog.courses.find(course=>course.id===section.course_id);return {sectionId:section.id,courseId:section.course_id,wheelEnabled:sectionWheelEnabled(section.id,course?.metadata.sectionWheel),legacySection:wheelLegacySection(course?.slug,section.section_key)};});
      for(let i=0;i<scopes.length;i+=4)await Promise.allSettled(scopes.slice(i,i+4).map(scope=>publishClassroom(undefined,scope)));
    }catch{console.error('Classroom reset projections pending reconciliation.');}
  });
}
export function notifyClassroomAnswer(payload: { sectionId: string; epoch: string; answer: { recordId: string; subject: string; username: string; partId: string; values: Record<string, string>; submittedAt: string; assignmentPart?: number; questionNumber?: number; drawId?: string } }) {
  if (!realtimeConfigured()) return;
  after(async () => {
    try {
      const response = await fetch(`${process.env.CONVEX_SITE_URL!.replace(/\/$/, "")}/classroom/answer`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REALTIME_BRIDGE_SECRET}` },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Projection pending.");
    } catch { console.error("Practice answer notification pending reconciliation; durable answer remains saved."); }
  });
}
