import { createHash } from "node:crypto";

export type ScopedPresenceCounts = {
  section1: number; section2: number; total: number;
  bySection: Record<string, number>; byCourse: Record<string, number>; byFolder: Record<string, number>;
};
type Section = { id: string; courseId: string; sectionKey: string };
type Course = { id: string; slug?: string; folderGroupId?: string };
type Presence = { client_id: string; section: string };

export const SCOPED_PRESENCE_TTL_MS = 50_000;

export function scopedPresenceKey(sectionId: string, sessionId: string, clientId: string) {
  const hash = (text: string, length: number) => createHash("sha256").update(text).digest("hex").slice(0,length);
  return `v2:${sectionId}:${hash(sessionId,24)}:${hash(clientId,12)}`;
}

// The existing table has a legacy Section 1/2 enum. Its v2 primary key carries
// the real authorized section ID plus session/tab hashes, without a schema
// migration. The legacy enum is never used to group scoped records.
export function summarizeScopedPresence(rows: Presence[], sections: Section[], courses: Course[]): ScopedPresenceCounts {
  const sectionMap = new Map(sections.map(section => [section.id,section]));
  const courseMap = new Map(courses.map(course => [course.id,course]));
  const legacySections = new Map(sections.filter(section=>courseMap.get(section.courseId)?.slug === "applied-agentic-ai").map(section=>[section.sectionKey,section]));
  const bySection = new Map<string,Set<string>>();
  const byCourse = new Map<string,Set<string>>(), byFolder = new Map<string,Set<string>>(), total = new Set<string>();
  const add = (map: Map<string,Set<string>>, key: string, learner: string) => { const set = map.get(key) || new Set<string>(); set.add(learner);map.set(key,set); };
  for (const row of rows) {
    const scoped = /^v2:([^:]+):([a-f0-9]{24}):[a-f0-9]{12}$/.exec(row.client_id);
    const section = scoped ? sectionMap.get(scoped[1]) : legacySections.get(row.section);
    if (!section) continue;
    const learner = scoped ? scoped[2] : `legacy:${row.client_id}`;
    const course = courseMap.get(section.courseId);
    add(bySection,section.id,learner);add(byCourse,section.courseId,learner);add(byFolder,course?.folderGroupId || "unassigned",learner);total.add(learner);
  }
  const counts = (map: Map<string,Set<string>>) => Object.fromEntries([...map].map(([key,value]) => [key,value.size]));
  const legacy = (key: string) => { const section = legacySections.get(key);return section ? bySection.get(section.id)?.size || 0 : 0; };
  return { section1:legacy("section1"),section2:legacy("section2"),total:total.size,bySection:counts(bySection),byCourse:counts(byCourse),byFolder:counts(byFolder) };
}
