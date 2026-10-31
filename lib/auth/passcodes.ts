import "server-only";
import { createHash, randomInt } from "node:crypto";
import { getCoursesAndSectionsData, saveFolderGroups, updateCourseMetadata, type CourseMetadata } from "./courseAccessStorage";

import { APPLIED_AGENTIC_AI_SLUG } from "./types";

export type AccessMode = "learner" | "facilitator";
export type AccessCodes = Partial<Record<AccessMode, string>>;
export type PasscodeTarget = { kind: "global" | "folder" | "course" | "section"; id: string };

export function hashPasscode(code: string) {
  return createHash("sha256").update(`eiu-passcode-v2:${code}`).digest("hex");
}

export function readAccessCodes(value: unknown): AccessCodes {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return Object.fromEntries(["learner", "facilitator"].flatMap(mode =>
    typeof row[mode] === "string" && row[mode].trim() ? [[mode, row[mode].trim()]] : []));
}

// A small, pure catalog view also makes role collisions and scope checks testable.
export function catalogCredentials(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>) {
  const entries: Array<PasscodeTarget & { mode: AccessMode; code: string }> = [];
  const add = (target: PasscodeTarget, codes: AccessCodes) => {
    for (const mode of ["learner", "facilitator"] as const) {
      if (codes[mode]) entries.push({ ...target, mode, code: codes[mode]! });
    }
  };
  add({ kind: "global", id: "all" }, readAccessCodes(catalog.globalAccessCodes));
  for (const folder of catalog.folderGroups) add({ kind: "folder", id: folder.id }, readAccessCodes(folder.accessCodes));
  const sections = new Map(catalog.sections.map(section => [section.id, section]));
  for (const course of catalog.courses) {
    add({ kind: "course", id: course.id }, { learner: course.metadata.passcode, facilitator: course.metadata.facilitatorPasscode });
    for (const [id, codes] of Object.entries(course.metadata.sectionAccessCodes || {})) {
      if (sections.get(id)?.course_id === course.id) add({ kind: "section", id }, readAccessCodes(codes));
    }
  }
  return entries;
}

function resolveCatalog(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>, hash?: string) {
  const entries = catalogCredentials(catalog);
  const matching = hash ? entries.filter(entry => hashPasscode(entry.code) === hash) : [];
  // A credential selects exactly one scope and role. Ambiguous old codes fail closed.
  if (hash && matching.length !== 1) return null;
  const credential = matching[0];
  const hiddenFolders = new Set(catalog.folderGroups.filter(folder => folder.hidden).map(folder => folder.id));
  const courses = catalog.courses.filter(course => course.status === "active" && !course.metadata.hidden && !hiddenFolders.has(course.folderGroupId));
  const courseById = new Map(courses.map(course => [course.id, course]));
  const hiddenSections = new Set(courses.flatMap(course => course.metadata.hiddenSectionIds || []));
  const locks = new Set(entries.filter(entry => entry.mode === "learner" && entry.kind !== "global").map(entry => `${entry.kind}:${entry.id}`));
  const accessible = catalog.sections.flatMap(section => {
    const course = courseById.get(section.course_id);
    if (!course || section.status !== "active" || section.hidden || hiddenSections.has(section.id)) return [];
    if (credential) {
      const covered = credential.kind === "global"
        || (credential.kind === "folder" && credential.id === course.folderGroupId)
        || (credential.kind === "course" && credential.id === course.id)
        || (credential.kind === "section" && credential.id === section.id);
      if (!covered) return [];
    } else if (locks.has(`folder:${course.folderGroupId}`) || locks.has(`course:${course.id}`) || locks.has(`section:${section.id}`)) return [];
    return [{ ...section, canFacilitate: credential?.mode === "facilitator" }];
  });
  if (!accessible.length) return null;
  const accessibleCourseIds = new Set(accessible.map(section => section.course_id));
  return { courses: courses.filter(course => accessibleCourseIds.has(course.id)), sections: accessible };
}

export function resolvePasscode(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>, hash: string) { return resolveCatalog(catalog, hash); }

export function resolveFreeAccess(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>) { return resolveCatalog(catalog); }

type Catalog = Awaited<ReturnType<typeof getCoursesAndSectionsData>>;

export function passcodeVisibility(catalog: Catalog, targets: PasscodeTarget[]) {
  const folderScopes = new Set(targets.filter(target => target.kind === "folder").map(target => target.id));
  const wideCourses = new Set(targets.filter(target => target.kind === "course").map(target => target.id));
  for (const course of catalog.courses) if (folderScopes.has(course.folderGroupId)) wideCourses.add(course.id);
  const sectionScopes = new Set(targets.filter(target => target.kind === "section").map(target => target.id));
  const courseIds = new Set(wideCourses);
  for (const section of catalog.sections) if (sectionScopes.has(section.id)) courseIds.add(section.course_id);
  const hiddenSections = new Set(catalog.courses.flatMap(course => course.metadata.hiddenSectionIds || []));
  const sectionIds = catalog.sections.filter(section => (wideCourses.has(section.course_id) || sectionScopes.has(section.id)) && (section.hidden || hiddenSections.has(section.id))).map(section => section.id);
  const selectedHiddenSectionIds = new Set(sectionIds);
  const affectedCourses = new Set(catalog.sections.filter(section => selectedHiddenSectionIds.has(section.id)).map(section => section.course_id));
  const folderIds = new Set(folderScopes);
  for (const course of catalog.courses) if (courseIds.has(course.id)) folderIds.add(course.folderGroupId);
  return {
    folderIds: catalog.folderGroups.filter(folder => folderIds.has(folder.id) && folder.hidden).map(folder => folder.id),
    courseIds: catalog.courses.filter(course => courseIds.has(course.id) && (course.metadata.hidden || affectedCourses.has(course.id))).map(course => course.id),
    sectionIds,
  };
}

export async function saveAccessPasscodes(targets: PasscodeTarget[], modes: AccessMode[], value: string | null, unhide = false) {
  const catalog = await getCoursesAndSectionsData();
  const core = catalog.courses.find(course => course.slug === APPLIED_AGENTIC_AI_SLUG);
  if (!targets.length || targets.length > 200 || !modes.length || modes.some(mode => !["learner", "facilitator"].includes(mode))) throw new Error("Choose valid scopes and access types.");
  const unique = new Set(targets.map(target => `${target.kind}:${target.id}`));
  if (unique.size !== targets.length) throw new Error("Duplicate scopes are not allowed.");
  for (const target of targets) {
    const exists = target.kind === "global" ? target.id === "all" && Boolean(core) : target.kind === "folder" ? catalog.folderGroups.some(item => item.id === target.id) : target.kind === "course" ? catalog.courses.some(item => item.id === target.id) : target.kind === "section" && catalog.sections.some(item => item.id === target.id);
    if (!exists) throw new Error("Folder, course or section no longer exists.");
  }
  const code = value?.trim() || "";
  if (code && !/^[A-Za-z0-9-]{4,32}$/.test(code)) throw new Error("Use 4-32 letters, numbers, or hyphens for the passcode.");
  if (code && targets.length * modes.length !== 1) throw new Error("Bulk generation creates a unique code for each scope and access type.");
  const visibility = value === null || code ? passcodeVisibility(catalog, targets) : { folderIds: [], courseIds: [], sectionIds: [] };
  if ((visibility.folderIds.length || visibility.courseIds.length) && !unhide) throw new Error("Hidden content needs confirmation. Confirm Unhide & generate to make the affected folders, courses, and sections visible.");
  const entries = catalogCredentials(catalog);
  const used = new Set(entries.map(entry => entry.code));
  const sectionOwners = new Map(catalog.sections.map(section => [section.id, section.course_id]));
  const updates = targets.flatMap(target => [...new Set(modes)].map(mode => {
    let next = code;
    if (value === null) { do { next = String(randomInt(100000, 1000000)); } while (used.has(next)); }
    if (next && entries.some(entry => entry.code === next && !(entry.kind === target.kind && entry.id === target.id && entry.mode === mode))) throw new Error("This passcode is already used by another scope or access type. Choose a different code.");
    if (next) used.add(next);
    return { ...target, mode, code: next };
  }));
  // Validate the entire request before changing visibility or credentials.
  let writes = 0;
  try {
    const folders = catalog.folderGroups.map(folder => {
      const changes = updates.filter(update => update.kind === "folder" && update.id === folder.id);
      return { ...folder, ...(visibility.folderIds.includes(folder.id) ? { hidden: false } : {}), accessCodes: { ...folder.accessCodes, ...Object.fromEntries(changes.map(change => [change.mode, change.code])) } };
    });
    if (updates.some(update => update.kind === "folder") || visibility.folderIds.length) { await saveFolderGroups(folders); writes++; }
    const courseIds = new Set([...visibility.courseIds, ...updates.filter(update => update.kind !== "folder").map(update => update.kind === "global" ? core!.id : update.kind === "section" ? sectionOwners.get(update.id)! : update.id)]);
    for (const id of courseIds) {
      await updateCourseMetadata(id, current => {
        const next: CourseMetadata = { ...current };
        if (visibility.courseIds.includes(id)) { next.hidden = false; next.hiddenSectionIds = (current.hiddenSectionIds || []).filter(id => !visibility.sectionIds.includes(id)); }
        for (const update of updates.filter(update => update.kind === "global" ? id === core?.id : (update.kind === "course" ? update.id === id : update.kind === "section" && sectionOwners.get(update.id) === id))) {
          if (update.kind === "global") next.globalAccessCodes = { ...next.globalAccessCodes, [update.mode]: update.code };
          else if (update.kind === "section") next.sectionAccessCodes = { ...next.sectionAccessCodes, [update.id]: { ...next.sectionAccessCodes?.[update.id], [update.mode]: update.code } };
          else if (update.mode === "learner") next.passcode = update.code;
          else next.facilitatorPasscode = update.code;
        }
        return next;
      });
      writes++;
    }
  } catch {
    throw new Error(writes ? "Some changes were saved, but the operation could not finish. Refresh the catalog and retry the remaining scopes." : "No passcodes were saved. Please try again.");
  }
  return updates;
}

export async function saveAccessPasscode(target: PasscodeTarget, mode: AccessMode, value: string | null, unhide = false) {
  return (await saveAccessPasscodes([target], [mode], value, unhide))[0].code;
}
