type Row = Record<string, unknown>;

function metadata(course: Row): Row {
  if (course.metadata && typeof course.metadata === "object") return course.metadata as Row;
  try { const parsed=JSON.parse(String(course.description || "{}"));return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {}; } catch { return {}; }
}

// Uses the same persisted folder registry as the course chooser. New folders,
// courses and sections require no code-level list or reporting configuration.
export function courseHierarchy(rawCourses: Row[]) {
  const core = rawCourses.find(course => course.slug === "applied-agentic-ai");
  const master = (core && metadata(core).folderGroups) || rawCourses.map(metadata).find(meta => Array.isArray(meta.folderGroups))?.folderGroups;
  const folders = (Array.isArray(master) && master.length ? master as Row[] : [{ id: "fg-ai-agentic", name: "Chương Trình AI & Agentic", order: 1 }])
    .filter(folder => folder.id && folder.name).map(folder => ({ id: String(folder.id), name: String(folder.name), order: Number(folder.order) || 0 }))
    .sort((a,b) => a.order - b.order);
  const fallback = folders[0] || { id: "unassigned", name: "Other", order: 0 };
  const courses = rawCourses.map(course => {
    const meta = metadata(course);
    const folder = folders.find(folder => folder.id === (course.folderGroupId || meta.folderGroupId)) || fallback;
    return { ...course, folderGroupId: folder.id, folderGroupName: folder.name };
  });
  return { folders, courses };
}
