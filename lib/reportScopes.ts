type Row = Record<string, unknown>;

export function reportScope(row: Row, courses: Row[], sections: Row[]): Row {
  const explicitCourse = String(row.courseId || row.course_id || "");
  const explicitSection = String(row.sectionId || row.section_id || "");
  const sectionKey = String(row.section || row.sectionKey || "");
  const legacyCourse = courses.find(course => course.slug === "applied-agentic-ai");
  const keyMatches = sections.filter(section => section.section_key === sectionKey);
  const matchedSection = sections.find(section => explicitSection ? section.id === explicitSection : section.course_id === explicitCourse && section.section_key === sectionKey)
    || (!explicitCourse && !explicitSection ? keyMatches.find(section => section.course_id === legacyCourse?.id) || (keyMatches.length === 1 ? keyMatches[0] : undefined) : undefined);
  const courseId = explicitCourse || String(matchedSection?.course_id || legacyCourse?.id || "applied-agentic-ai");
  const course = courses.find(course => course.id === courseId);
  const section = matchedSection || sections.find(section => section.course_id === courseId && section.section_key === sectionKey);
  return { ...row, courseId, courseTitle: String(row.courseTitle || course?.title || (courseId === "applied-agentic-ai" ? "Applied Agentic AI" : courseId)),
    sectionId: explicitSection || String(section?.id || `${courseId}:${sectionKey}`), section: sectionKey || String(section?.section_key || ""),
    sectionTitle: String(row.sectionTitle || section?.title || sectionKey.replace(/^section(\d+)$/i, "Section $1")) };
}

export function scopedReportActivity(activity: Row[], courses: Row[], sections: Row[]): Row[] {
  return activity.map(row => {
    const details = (row.details || {}) as Row;
    if (row.action === "PASSCODE_LOGIN") {
      const scopes = Array.isArray(details.scopes) ? details.scopes as Row[] : (Array.isArray(details.sectionKeys) ? details.sectionKeys : []).map(section => ({ section }));
      return { ...row, details: { ...details, scopes: scopes.map(scope => reportScope(scope, courses, sections)) } };
    }
    return { ...row, details: reportScope(details, courses, sections) };
  });
}

export function reportScopeKey(row: Row) {
  return `${row.courseId || ""}:${row.sectionId || row.section || ""}`;
}
