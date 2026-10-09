import "server-only";
import { createHash, randomInt } from "node:crypto";
import { getCoursesAndSectionsData, saveFolderGroups, updateCourseMetadata, type CourseMetadata } from "./courseAccessStorage";

import { APPLIED_AGENTIC_AI_SLUG } from "./types";

export type AccessMode = "learner" | "facilitator";
export type AccessCodes = Partial<Record<AccessMode, string>>;
export type PasscodeTarget = { kind: "global" | "folder" | "course"; id: string };

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
  for (const course of catalog.courses) {
    add({ kind: "course", id: course.id }, { learner: course.metadata.passcode, facilitator: course.metadata.facilitatorPasscode });

  }
  return entries;
}

function resolveCatalog(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>, hash?: string) {
  const entries = catalogCredentials(catalog);
  const matching = hash ? entries.filter(entry => hashPasscode(entry.code) === hash) : [];
  if (hash && !matching.length) return null;
  // Never let an ambiguous learner code become a teaching credential.
  if (new Set(matching.map(entry => entry.mode)).size > 1) return null;
  const hidden = new Set(catalog.folderGroups.filter(folder => folder.hidden).map(folder => folder.id));
  const courses = catalog.courses.filter(course => course.status === "active" && !course.metadata.hidden && !hidden.has(course.folderGroupId));
  const sections = catalog.sections.filter(section => section.status === "active" && !section.hidden && courses.some(course => course.id === section.course_id && !course.metadata.hiddenSectionIds?.includes(section.id)));
  const accessible = sections.flatMap(section => {
    const course = courses.find(item => item.id === section.course_id)!;
    const covers = (entry: PasscodeTarget) => entry.kind === "global" || (entry.kind === "course" ? entry.id === course.id : entry.id === course.folderGroupId);
    const credentials = matching.filter(covers);
    const locked = entries.some(entry => entry.kind !== "global" && entry.mode === "learner" && covers(entry));
    if (!credentials.length && locked) return [];
    return [{ ...section, canFacilitate: credentials.some(entry => entry.mode === "facilitator") }];
  });
  if (!accessible.length) return null;
  return { courses: courses.filter(course => accessible.some(section => section.course_id === course.id)), sections: accessible };
}

export function resolvePasscode(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>, hash: string) { return resolveCatalog(catalog, hash); }

export function resolveFreeAccess(catalog: Awaited<ReturnType<typeof getCoursesAndSectionsData>>) { return resolveCatalog(catalog); }

type Catalog = Awaited<ReturnType<typeof getCoursesAndSectionsData>>;

export function passcodeVisibility(catalog: Catalog, targets: PasscodeTarget[]) {
  const courseIds = new Set(targets.flatMap(target => target.kind === "course" ? [target.id] : target.kind === "folder" ? catalog.courses.filter(course => course.folderGroupId === target.id).map(course => course.id) : []));
  const folderIds = new Set(targets.filter(target => target.kind === "folder").map(target => target.id));
  for (const course of catalog.courses.filter(course => courseIds.has(course.id))) folderIds.add(course.folderGroupId);
  return {
    folderIds: catalog.folderGroups.filter(folder => folderIds.has(folder.id) && folder.hidden).map(folder => folder.id),
    courseIds: catalog.courses.filter(course => courseIds.has(course.id) && (course.metadata.hidden || course.metadata.hiddenSectionIds?.length || catalog.sections.some(section => section.course_id === course.id && section.hidden))).map(course => course.id),
  };
}

export async function saveAccessPasscodes(targets: PasscodeTarget[], modes: AccessMode[], value: string | null, unhide = false) {
  const catalog = await getCoursesAndSectionsData();
  const core = catalog.courses.find(course => course.slug === APPLIED_AGENTIC_AI_SLUG);
  if (!targets.length || targets.length > 200 || !modes.length || modes.some(mode => !["learner", "facilitator"].includes(mode))) throw new Error("Choose valid scopes and access types.");
  const unique = new Set(targets.map(target => `${target.kind}:${target.id}`));
  if (unique.size !== targets.length) throw new Error("Duplicate scopes are not allowed.");
  for (const target of targets) {
    const exists = target.kind === "global" ? target.id === "all" && Boolean(core) : target.kind === "folder" ? catalog.folderGroups.some(item => item.id === target.id) : target.kind === "course" && catalog.courses.some(item => item.id === target.id);
    if (!exists) throw new Error("Folder or course no longer exists. Section passcodes are no longer supported.");
  }
  const code = value?.trim() || "";
  if (code && !/^[A-Za-z0-9-]{4,32}$/.test(code)) throw new Error("Use 4-32 letters, numbers, or hyphens for the passcode.");
  if (code && targets.length * modes.length !== 1) throw new Error("Bulk generation creates a unique code for each scope and access type.");
  const visibility = value === null || code ? passcodeVisibility(catalog, targets) : { folderIds: [], courseIds: [] };
  if ((visibility.folderIds.length || visibility.courseIds.length) && !unhide) throw new Error("Hidden content needs confirmation. Confirm Unhide & generate to make the affected folders, courses, and sections visible.");
  const entries = catalogCredentials(catalog);
  const used = new Set(entries.map(entry => entry.code));
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
    const courseIds = new Set([...visibility.courseIds, ...updates.filter(update => update.kind !== "folder").map(update => update.kind === "global" ? core!.id : update.id)]);
    for (const id of courseIds) {
      await updateCourseMetadata(id, current => {
        const next: CourseMetadata = { ...current };
        if (visibility.courseIds.includes(id)) { next.hidden = false; next.hiddenSectionIds = []; }
        for (const update of updates.filter(update => update.kind === "global" ? id === core?.id : update.kind === "course" && update.id === id)) {
          if (update.kind === "global") next.globalAccessCodes = { ...next.globalAccessCodes, [update.mode]: update.code };
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
