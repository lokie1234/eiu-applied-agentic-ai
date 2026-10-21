type Row = Record<string, unknown>;
export function collectReportLearners(legacy: Row[], activity: Row[], submissions: Row[]) {
  const sessions = new Map<string, Row>();
  const ordered = [...activity].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const row of ordered) {
    if (!["PASSCODE_LOGIN", "SECTION_OPENED", "IDEA_SUBMITTED", "SHOWCASE_SUBMITTED", "QUIZ_COMPLETED", "FEEDBACK_SUBMITTED"].includes(String(row.action))) continue;
    const details = (row.details || {}) as Row;
    if (details.accessMode === "facilitator") continue;
    if (row.action === "PASSCODE_LOGIN" && details.scopeMode === "access") continue;
    const scopes: Row[] = row.action === "PASSCODE_LOGIN"
      ? Array.isArray(details.scopes) ? details.scopes as Row[] : (Array.isArray(details.sectionKeys) ? details.sectionKeys : []).map(section => ({ section }))
      : [details];
    if (!details.sessionId || !details.name) continue;
    for (const scope of scopes) {
      const section = scope.section;
      if (typeof section !== "string" || !section) continue;
      const key = `${scope.courseId || ""}:${scope.sectionId || section}:${details.sessionId}`;
      const previous = sessions.get(key);
      sessions.set(key, { ...details, ...scope, section, created_at: previous?.created_at || row.created_at, updated_at: row.created_at });
    }
  }
  const learners = [...sessions.values()];
  const known = new Set(learners.map(row => `${row.courseId || ""}:${row.sectionId || row.section}:${String(row.email).toLowerCase()}`));
  // Include existing participants, even before session identities were introduced.
  for (const row of [...legacy, ...submissions]) {
    const key = `${row.courseId || ""}:${row.sectionId || row.section}:${String(row.email || "").toLowerCase()}`;
    if (!row.section || !row.email || !row.name || known.has(key)) continue;
    known.add(key);
    const timestamp = row.updated_at || row.completed_at || row.submitted_at || row.shared_at || row.created_at;
    learners.push({ ...row, created_at: row.created_at || timestamp, updated_at: timestamp });
  }
  return learners;
}
