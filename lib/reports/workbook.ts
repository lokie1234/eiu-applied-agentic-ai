import ExcelJS from "exceljs";

export type DataRow = Record<string, unknown>;
export type ReportDataset = {
  scopes: DataRow[]; learners: DataRow[]; ideas: DataRow[]; showcase: DataRow[];
  quiz: DataRow[]; feedback: DataRow[]; activity?: DataRow[]; date: string | null; exportedAt: Date;
};
type Column = { header: string; key: string; width: number };
const colors = { navy: "FF082945", gold: "FFB39159", pale: "FFF2F6FA", ink: "FF17324A", muted: "FF627487" };
const text = (value: unknown) => String(value ?? "");
const scopeKey = (row: DataRow) => `${row.courseId}:${row.sectionId || row.section}`;
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function timestamp(value: unknown) {
  if (!value) return null;
  const parsed = new Date(text(value));
  // Excel has no timezone: shift the stored serial to the report's VN wall time.
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getTime() + 7 * 3600_000);
}
function participantKey(row: DataRow) {
  if (row.sessionId) return `session:${row.sessionId}`;
  if (row.email) return `legacy:${text(row.email).trim().toLowerCase()}`;
  // Names alone cannot safely merge different people.
  return `record:${row.id || scopeKey(row) + ":" + text(row.name)}`;
}
export function cleanFilename(value: unknown) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "Bao-cao";
}
export function reportFilename(data: Pick<ReportDataset, "scopes" | "date" | "exportedAt">) {
  const courses = [...new Set(data.scopes.map(row => text(row.courseTitle)))];
  const course = courses.length === 1 ? cleanFilename(courses[0]) : "Tat-ca-khoa-hoc";
  const section = data.scopes.length === 1 ? cleanFilename(data.scopes[0].sectionTitle) : "Tat-ca-section";
  const day = data.date || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(data.exportedAt);
  return `${course}_${section}_${day}.xlsx`;
}

function uniqueRows(rows: DataRow[], kind: string) {
  const seen = new Set<string>();
  return rows.filter(row => {
    // recordId ties a legacy physical record to its audit reference. Never
    // collapse intentional repeated submissions just because their text matches.
    const key = `${kind}:${row.action || ""}:${scopeKey(row)}:${row.recordId || row.id || `${participantKey(row)}:${row.completed_at || row.shared_at || row.submitted_at}`}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export async function buildReportWorkbook(data: ReportDataset) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EIU Learning"; workbook.created = data.exportedAt; workbook.modified = data.exportedAt;
  workbook.title = "Báo cáo học tập";
  const scopeCourses = [...new Set(data.scopes.map(row => text(row.courseTitle)))];
  const scopeDescription = `${scopeCourses.length === 1 ? scopeCourses[0] : "Tất cả khóa học"} · ${data.scopes.length === 1 ? text(data.scopes[0].sectionTitle) : `${data.scopes.length} section`}`;
  const period = data.date ? `Ngày ${data.date} · Giờ Việt Nam (UTC+7)` : "Toàn bộ thời gian · Giờ Việt Nam (UTC+7)";
  function sheet(name: string, columns: Column[], rows: DataRow[]) {
    const ws = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 5, showGridLines: false }], pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5" } });
    ws.columns = columns.map(({ key, width }) => ({ key, width }));
    const width = Math.max(columns.length, 3);
    for (const [row, value] of [[1, name], [2, scopeDescription], [3, period]] as const) {
      ws.mergeCells(row, 1, row, width); ws.getCell(row, 1).value = value;
    }
    ws.getRow(1).height = 32; ws.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: colors.navy } };
    ws.getRow(2).height = 30; ws.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
    ws.getCell("A2").font = { name: "Arial", size: 10, color: { argb: colors.muted } };
    ws.getCell("A3").font = { name: "Arial", size: 10, italic: true, color: { argb: colors.muted } };
    columns.forEach((column, index) => { ws.getRow(5).getCell(index + 1).value = column.header; }); ws.getRow(5).height = 30;
    ws.getRow(5).eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.navy } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
    for (const record of rows) {
      const row = ws.addRow(record); let height = 24;
      row.eachCell((cell, index) => {
        cell.font = { name: "Arial", size: 10, color: { argb: colors.ink } };
        cell.alignment = { vertical: "top", horizontal: typeof cell.value === "number" || cell.value instanceof Date ? "right" : "left", wrapText: true };
        if (row.number % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.pale } };
        if (cell.value instanceof Date) cell.numFmt = "dd/mm/yyyy hh:mm:ss";
        const value = typeof cell.value === "string" ? cell.value : "";
        const length = Math.max(columns[index - 1]?.width || 30, 8);
        height = Math.max(height, 15 * value.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / (length * .9))), 0) + 8);
      }); row.height = height;
    }
    if (!rows.length) {
      ws.mergeCells(6, 1, 6, width); ws.getCell("A6").value = "Chưa có bản ghi trong phạm vi đã chọn.";
      ws.getRow(6).height = 32; ws.getCell("A6").font = { name: "Arial", size: 10, italic: true, color: { argb: colors.muted } };
      ws.getCell("A6").alignment = { wrapText: true, vertical: "middle" };
    }
    if (rows.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: columns.length } };
    ws.headerFooter.oddFooter = "&LEIU Learning&CTrang &P / &N&R" + dateFormat.format(data.exportedAt);
    return ws;
  }
  const sets = {
    ideas: uniqueRows(data.ideas, "idea"), showcase: uniqueRows(data.showcase, "showcase"),
    quiz: uniqueRows(data.quiz, "quiz"), feedback: uniqueRows(data.feedback, "feedback"),
  };
  const submitted = uniqueRows((data.activity || []).filter(row => row.action === "ACTIVITY_SUBMITTED"), "custom");
  const sources = [...data.learners, ...sets.ideas, ...sets.showcase, ...sets.quiz, ...sets.feedback, ...(data.activity || [])];
  const sessionsByEmail = new Map<string, Set<string>>();
  for (const row of sources) if (row.sessionId && row.email) {
    const email = text(row.email).trim().toLowerCase(), keys = sessionsByEmail.get(email) || new Set<string>();
    keys.add(participantKey(row)); sessionsByEmail.set(email, keys);
  }
  function personKey(row: DataRow) {
    if (row.sessionId) return participantKey(row);
    const matches = sessionsByEmail.get(text(row.email).trim().toLowerCase());
    return matches?.size === 1 ? [...matches][0] : participantKey(row);
  }
  const participants = new Map<string, DataRow>();
  for (const row of sources) {
    const key = personKey(row);
    if (!participants.has(key)) participants.set(key, { ...row });
    const person = participants.get(key)!;
    if (!person.name && row.name) person.name = row.name;
    if (!person.email && row.email) person.email = row.email;
    if (row.information) person.information = { ...(row.information as DataRow), ...((person.information || {}) as DataRow) };
    if (row.fields && !(person.fields as unknown[] | undefined)?.length) person.fields = row.fields;
    if (row.action === "PASSCODE_LOGIN" && (!person.loginAt || text(row.created_at) < text(person.loginAt))) person.loginAt = row.created_at;
  }

  type Bucket = { person: string; scope: DataRow; results: Map<string, DataRow[]> };
  const scopes = new Map(data.scopes.map(scope => [scopeKey(scope), scope]));
  const buckets = new Map<string, Bucket>();
  function bucketFor(row: DataRow, scope: DataRow = row) {
    const configured = scopes.get(scopeKey(scope));
    if (!configured) return null;
    const person = personKey(row), key = `${person}|${scopeKey(configured)}`;
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { person, scope: configured, results: new Map() }; buckets.set(key, bucket); }
    return bucket;
  }
  // A login seeds the selected granted sections, without fabricating visits.
  // Entry audit rows may identify a learner, but their log text is never exported.
  for (const row of sources) {
    if (row.action === "PASSCODE_LOGIN" && Array.isArray(row.scopes)) {
      for (const scope of row.scopes as DataRow[]) bucketFor(row, scope);
    } else bucketFor(row);
  }
  function distribute(rows: DataRow[], group: string, time: string) {
    for (const row of [...rows].sort((a, b) => text(a[time]).localeCompare(text(b[time])))) {
      const bucket = bucketFor(row); if (!bucket) continue;
      const records = bucket.results.get(group) || []; records.push(row); bucket.results.set(group, records);
    }
  }
  distribute(sets.ideas, "ideas", "submitted_at");
  distribute(sets.showcase, "showcase", "shared_at");
  distribute(sets.quiz, "quiz", "completed_at");
  distribute(sets.feedback, "feedback", "submitted_at");
  const customGroups = new Map<string, { label: string; fields: Map<string, string>; rows: DataRow[] }>();
  for (const row of submitted) {
    const type = text(row.activityType); if (!/^[a-z][a-z0-9_-]{0,39}$/.test(type)) continue;
    const group = customGroups.get(type) || { label: text(row.activityLabel || type), fields: new Map<string, string>(), rows: [] };
    const values = row.values && typeof row.values === "object" && !Array.isArray(row.values) ? row.values as DataRow : {};
    const labels = (Array.isArray(row.activityFields) ? row.activityFields : []) as Array<{ id: string; label: string }>;
    for (const key of Object.keys(values)) group.fields.set(key, labels.find(field => field.id === key)?.label || key);
    group.rows.push({ ...row, values }); customGroups.set(type, group);
  }
  for (const [type, group] of customGroups) distribute(group.rows, `custom:${type}`, "created_at");

  const summaryColumns: Column[] = [
    ...(scopeCourses.length > 1 ? [{ header: "Khóa học", key: "courseTitle", width: 32 }] : []),
    { header: "Section", key: "sectionTitle", width: 42 }, { header: "Học viên", key: "people", width: 16 },
    ...(sets.ideas.length ? [{ header: "Ý tưởng", key: "ideas", width: 14 }] : []),
    ...(sets.showcase.length ? [{ header: "Bài chia sẻ", key: "showcase", width: 16 }] : []),
    ...(sets.quiz.length ? [{ header: "Lượt quiz", key: "quiz", width: 14 }, { header: "Quiz trung bình", key: "mean", width: 20 }] : []),
    ...(sets.feedback.length ? [{ header: "Feedback", key: "feedback", width: 14 }] : []),
    ...[...customGroups].map(([key, group]) => ({ header: group.label, key: `custom:${key}`, width: 22 })),
  ];
  const summaryRows = data.scopes.map(scope => {
    const within = [...buckets.values()].filter(bucket => scopeKey(bucket.scope) === scopeKey(scope));
    const count = (kind: string) => within.reduce((sum, bucket) => sum + (bucket.results.get(kind)?.length || 0), 0);
    const attempts = within.flatMap(bucket => bucket.results.get("quiz") || []);
    const valid = attempts.filter(row => Number.isFinite(Number(row.score)) && Number(row.total) > 0);
    return { courseTitle: text(scope.courseTitle), sectionTitle: text(scope.sectionTitle), people: within.length,
      ideas: count("ideas"), showcase: count("showcase"), quiz: count("quiz"), feedback: count("feedback"),
      mean: valid.length ? valid.reduce((sum, row) => sum + Number(row.score) / Number(row.total), 0) / valid.length : null,
      ...Object.fromEntries([...customGroups.keys()].map(type => [`custom:${type}`, count(`custom:${type}`)])) };
  });
  const overview = sheet("Tổng quan", summaryColumns, summaryRows);
  if (sets.quiz.length) overview.getColumn("mean").numFmt = "0.0%";
  overview.mergeCells(4, 1, 4, Math.max(overview.columnCount, 3));
  overview.getCell("A4").value = `${new Set([...buckets.values()].map(bucket => bucket.person)).size} phiên học viên trong phạm vi báo cáo.`;
  overview.getCell("A4").font = { name: "Arial", size: 10, color: { argb: colors.muted } };
  for (const note of [
    "Mỗi dòng Thống kê là một học viên trong một section. Các phiên đăng nhập khác nhau được giữ riêng; các lần gửi thêm được đánh số.",
    `Xuất lúc ${dateFormat.format(data.exportedAt)} (UTC+7).`,
  ]) {
    const row = overview.addRow({}); row.getCell(1).value = note;
    overview.mergeCells(row.number, 1, row.number, Math.max(overview.columnCount, 3)); row.height = Math.max(32, Math.ceil(note.length / (summaryColumns.reduce((sum, column) => sum + column.width, 0) * .9)) * 15 + 8);
    row.getCell(1).alignment = { wrapText: true, vertical: "middle" }; row.getCell(1).font = { name: "Arial", size: 10, color: { argb: colors.muted } };
  }

  const fields = new Map<string, string>();
  for (const person of participants.values()) {
    const configured = (person.fields || []) as Array<{ id: string; label: string }>;
    for (const [id, value] of Object.entries((person.information || {}) as DataRow)) {
      if (!["name", "email"].includes(id) && value !== "" && value !== null) fields.set(id, configured.find(field => field.id === id)?.label || id);
    }
  }
  const columns: Column[] = [{ header: "Họ tên", key: "name", width: 30 }, { header: "Email", key: "email", width: 36 },
    ...[...fields].map(([id, label]) => ({ header: label, key: `info:${id}`, width: 28 })),
    { header: "Đăng nhập lúc", key: "loginAt", width: 24 },
    ...(scopeCourses.length > 1 ? [{ header: "Khóa học", key: "courseTitle", width: 32 }] : []),
    ...(data.scopes.length > 1 ? [{ header: "Section", key: "sectionTitle", width: 36 }] : []),
  ];
  const orderedBuckets = [...buckets.values()].sort((a, b) =>
    text(participants.get(a.person)?.name).localeCompare(text(participants.get(b.person)?.name), "vi") ||
    text(a.scope.courseTitle).localeCompare(text(b.scope.courseTitle)) || text(a.scope.sectionTitle).localeCompare(text(b.scope.sectionTitle), undefined, { numeric: true }) || a.person.localeCompare(b.person));
  const rows: DataRow[] = orderedBuckets.map(bucket => {
    const person = participants.get(bucket.person)!;
    return { name: text(person.name), email: /@passcode\.eiu$/.test(text(person.email)) ? "" : text(person.email), loginAt: timestamp(person.loginAt),
      courseTitle: text(bucket.scope.courseTitle), sectionTitle: text(bucket.scope.sectionTitle),
      ...Object.fromEntries([...fields.keys()].map(id => [`info:${id}`, text(((person.information || {}) as DataRow)[id])])) };
  });
  type ResultField = { label: string; width: number; value: (row: DataRow) => unknown };
  function resultColumns(group: string, definitions: ResultField[]) {
    const max = orderedBuckets.reduce((max, bucket) => Math.max(max, bucket.results.get(group)?.length || 0), 0);
    for (let index = 0; index < max; index++) for (const [fieldIndex, definition] of definitions.entries()) {
      const key = `${group}:${index}:${fieldIndex}`;
      columns.push({ header: `${definition.label}${max > 1 ? ` ${index + 1}` : ""}`, key, width: definition.width });
      orderedBuckets.forEach((bucket, rowIndex) => {
        const record = bucket.results.get(group)?.[index];
        rows[rowIndex][key] = record ? definition.value(record) : null;
      });
    }
  }
  resultColumns("ideas", [{ label: "Ý tưởng", width: 65, value: row => text(row.idea) }, { label: "Gửi ý tưởng lúc", width: 24, value: row => timestamp(row.submitted_at) }]);
  resultColumns("showcase", [{ label: "Bài chia sẻ", width: 70, value: row => text(row.url) }, { label: "Chia sẻ lúc", width: 24, value: row => timestamp(row.shared_at) }]);
  resultColumns("quiz", [{ label: "Điểm quiz", width: 14, value: row => Number(row.score) }, { label: "Quiz tối đa", width: 14, value: row => Number(row.total) },
    { label: "Tỷ lệ đúng", width: 16, value: row => Number(row.total) > 0 ? Number(row.score) / Number(row.total) : null },
    { label: "Hoàn thành quiz lúc", width: 24, value: row => timestamp(row.completed_at) }]);
  resultColumns("feedback", [{ label: "Feedback", width: 70, value: row => text(row.feedback) }, { label: "Gửi feedback lúc", width: 24, value: row => timestamp(row.submitted_at) }]);
  for (const [type, group] of customGroups) {
    resultColumns(`custom:${type}`, [...[...group.fields].map(([key, label]) => ({ label: `${group.label} - ${label}`, width: 40, value: (row: DataRow) => {
      const value = (row.values as DataRow)[key];
      return value == null ? null : ["string", "number", "boolean"].includes(typeof value) ? value : JSON.stringify(value);
    } })), { label: `${group.label} - Gửi lúc`, width: 24, value: row => timestamp(row.created_at) }]);
  }
  if (columns.length > 16384) throw new Error("Báo cáo có quá nhiều lần tương tác. Vui lòng xuất theo từng ngày.");
  const headers = new Set<string>();
  for (const column of columns) {
    const original = column.header; let suffix = 2;
    while (headers.has(column.header.trim().toLowerCase())) column.header = `${original} (${suffix++})`;
    headers.add(column.header.trim().toLowerCase());
  }
  const statistics = sheet("Thống kê", columns, rows);
  statistics.views = [{ state: "frozen", ySplit: 5, xSplit: 2, showGridLines: false }];
  for (const column of columns) if (/^quiz:\d+:2$/.test(column.key)) statistics.getColumn(column.key).numFmt = "0.0%";
  return workbook;
}
