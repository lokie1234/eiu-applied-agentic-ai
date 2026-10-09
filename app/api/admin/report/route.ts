import ExcelJS from "exceljs";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { collectReportLearners } from "@/lib/reportLearners";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
type ReportValue = string | number | boolean | null;
type ReportRow = Record<string, ReportValue>;
type ReportColumn = { header: string; key: string; width: number };
type TimeFilter = {
  column: string;
  startIso: string;
  endIso: string;
};

const DEFAULT_SECTIONS = ["section1", "section2"];

function getDateBounds(dateStr: string, tzOffsetMinutes = -420) {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;

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
) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: Row[] = [];

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: false });

    if (timeFilter) {
      query = query
        .gte(timeFilter.column, timeFilter.startIso)
        .lte(timeFilter.column, timeFilter.endIso);
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

const reportDateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

function iso(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : reportDateFormatter.format(date).replace(", ", " ");
}

function reportInformation(row: Row, omitEmail = false) {
  const fields = (row.fields || []) as Array<{ id: string; label: string; type?: string }>;
  return Object.entries((row.information || {}) as Record<string, string>).filter(([id]) => id !== "name" && id !== "email" && (!omitEmail || fields.find(field => field.id === id)?.type !== "email")).map(([id, value]) => `${fields.find(field => field.id === id)?.label || id}: ${value}`).join("\n");
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF082945" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ReportColumn[],
  rows: ReportRow[],
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 20 },
  });
  sheet.columns = columns;
  sheet.addRows(rows);
  styleHeader(sheet.getRow(1));
  sheet.autoFilter = { from: "A1", to: { row: 1, column: columns.length } };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "top", wrapText: true };
      let lines = 1;
      row.eachCell(cell => { if (typeof cell.value === "string") lines = Math.max(lines, cell.value.split("\n").length); });
      row.height = Math.max(20, lines * 15 + 6);
    }
  });
  return sheet;
}

function sectionKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function sectionLabel(section: string) {
  const match = section.match(/^section[\s_-]*(\d+)$/i);
  return match ? `Section ${match[1]}` : section;
}

function sectionSheetPrefix(section: string) {
  const match = section.match(/^section[\s_-]*(\d+)$/i);
  if (match) return `S${match[1]}`;
  return section.replace(/[^a-z0-9]+/gi, " ").trim().slice(0, 10) || "Other";
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

function rowsInSection(rows: Row[], section: string) {
  return rows.filter((row) => sectionKey(row.section) === section);
}

export async function GET(request: Request) {
  try {
    if ((await currentRole()) !== "admin") {
      return Response.json(
        { success: false, message: "Chỉ admin mới có quyền xuất report." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode")?.trim().toLowerCase() || "report";
    const requestedSection = sectionKey(searchParams.get("section")) || "all";

    if (mode === "sections") {
      const sectionStates = await fetchAll("section_state", "updated_at");
      const sections = collectSections([], sectionStates.map((row) => row.section));
      return Response.json({
        success: true,
        sections: sections.map((section) => ({ value: section, label: sectionLabel(section) })),
      }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    const dateParam = searchParams.get("date")?.trim() || "";
    const tzOffsetMinutes = Number(searchParams.get("tzOffset") ?? -420);
    const dateBounds =
      dateParam && dateParam !== "all"
        ? getDateBounds(dateParam, Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : -420)
        : null;

    const [legacyLearners, ideas, showcase, quiz, feedback, sectionStates, activity] = await Promise.all([
      fetchAll(
        "learner_profiles",
        "updated_at",
        dateBounds ? { column: "updated_at", startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null,
      ),
      fetchAll(
        "ideas",
        "submitted_at",
        dateBounds ? { column: "submitted_at", startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null,
      ),
      fetchAll(
        "showcase_items",
        "shared_at",
        dateBounds ? { column: "shared_at", startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null,
      ),
      fetchAll(
        "quiz_results",
        "completed_at",
        dateBounds ? { column: "completed_at", startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null,
      ),
      fetchAll(
        "feedback",
        "submitted_at",
        dateBounds ? { column: "submitted_at", startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null,
      ),
      fetchAll("section_state", "updated_at"),
      fetchAll("access_audit_logs", "created_at", dateBounds ? { column: "created_at", startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null),
    ]);

    const learners = collectReportLearners(legacyLearners, activity, [...ideas, ...showcase, ...quiz, ...feedback]);
    const availableSections = collectSections(
      [learners, ideas, showcase, quiz, feedback],
      sectionStates.map((row) => row.section),
    );
    if (requestedSection !== "all" && !availableSections.includes(requestedSection)) {
      return Response.json(
        { success: false, message: "Section được chọn không tồn tại." },
        { status: 400 },
      );
    }

    const sections = requestedSection === "all" ? availableSections : [requestedSection];
    const scopeRows = (rows: Row[]) =>
      requestedSection === "all" ? rows : rowsInSection(rows, requestedSection);
    const scopedLearners = scopeRows(learners);
    const scopedIdeas = scopeRows(ideas);
    const scopedShowcase = scopeRows(showcase);
    const scopedQuiz = scopeRows(quiz);
    const scopedFeedback = scopeRows(feedback);
    const dataGroups = [
      { label: "Học viên", rows: scopedLearners },
      { label: "Ý tưởng", rows: scopedIdeas },
      { label: "Bài làm chia sẻ", rows: scopedShowcase },
      { label: "Quiz", rows: scopedQuiz },
      { label: "Feedback", rows: scopedFeedback },
    ];
    const generatedAt = new Date().toISOString();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EIU Applied Agentic AI";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = "EIU Applied Agentic AI - Interactive Report";

    const summary = workbook.addWorksheet("Tong quan", {
      views: [{ state: "frozen", ySplit: 5 }],
    });
    summary.columns = [
      { key: "label", width: 34 },
      ...sections.map((_, index) => ({ key: `section${index + 1}`, width: 18 })),
      { key: "total", width: 14 },
    ];
    summary.mergeCells(1, 1, 1, sections.length + 2);
    summary.getCell("A1").value = "EIU APPLIED AGENTIC AI - INTERACTIVE REPORT";
    summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF082945" } };
    summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    summary.getRow(1).height = 32;

    const filterLabel = dateBounds
      ? `Ngày ${dateBounds.dateStr.split("-").reverse().join("/")} (Giờ VN - UTC+7)`
      : "Tất cả thời gian";
    summary.addRow(["Phạm vi báo cáo", filterLabel]);
    summary.addRow(["Xuất lúc (GMT+7)", generatedAt]);
    summary.addRow([]);
    summary.addRow(["Loại dữ liệu", ...sections.map(sectionLabel), "Tổng"]);
    styleHeader(summary.getRow(5));
    dataGroups.forEach(({ label, rows }) => {
      summary.addRow([
        label,
        ...sections.map((section) => rowsInSection(rows, section).length),
        rows.length,
      ]);
    });

    sections.forEach((section) => {
      const prefix = sectionSheetPrefix(section);
      const sectionLearners = rowsInSection(scopedLearners, section);
      const sectionIdeas = rowsInSection(scopedIdeas, section);
      const sectionShowcase = rowsInSection(scopedShowcase, section);
      const sectionQuiz = rowsInSection(scopedQuiz, section);
      const sectionFeedback = rowsInSection(scopedFeedback, section);

      addSheet(workbook, `${prefix} - Hoc vien`, [
        { header: "Họ tên", key: "name", width: 30 },
        { header: "Email", key: "email", width: 36 },
        ...(sectionLearners.some(row => reportInformation(row)) ? [{ header: "Learner information", key: "information", width: 60 }] : []),
        { header: "Tạo lúc (GMT+7)", key: "createdAt", width: 26 },
        { header: "Cập nhật lúc (GMT+7)", key: "updatedAt", width: 26 },
      ], sectionLearners.map((row) => ({
        sessionId: String(row.sessionId || ""),
        information: reportInformation(row),
        name: String(row.name ?? ""), email: String(row.email ?? ""), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
      })));

      addSheet(workbook, `${prefix} - Y tuong`, [
        { header: "Họ tên", key: "name", width: 28 },
        { header: "Ý tưởng", key: "idea", width: 80 },
        { header: "Gửi lúc (GMT+7)", key: "submittedAt", width: 26 },
      ], sectionIdeas.map((row) => ({
        name: String(row.name ?? ""), email: String(row.email ?? ""), idea: String(row.idea ?? ""), submittedAt: iso(row.submitted_at),
      })));

      addSheet(workbook, `${prefix} - Bai lam`, [
        { header: "Họ tên", key: "name", width: 28 },
        { header: "URL", key: "url", width: 70 },
        { header: "Chia sẻ lúc (GMT+7)", key: "sharedAt", width: 26 },
      ], sectionShowcase.map((row) => ({
        name: String(row.name ?? ""), email: String(row.email ?? ""), url: String(row.url ?? ""), sharedAt: iso(row.shared_at),
      })));

      addSheet(workbook, `${prefix} - Quiz`, [
        { header: "Họ tên", key: "name", width: 28 },
        { header: "Điểm", key: "score", width: 10 },
        { header: "Tổng điểm", key: "total", width: 12 },
        { header: "Hoàn thành lúc (GMT+7)", key: "completedAt", width: 26 },
      ], sectionQuiz.map((row) => ({
        name: String(row.name ?? ""), email: String(row.email ?? ""), score: Number(row.score ?? 0), total: Number(row.total ?? 0), completedAt: iso(row.completed_at),
      })));

      addSheet(workbook, `${prefix} - Feedback`, [
        { header: "Họ tên", key: "name", width: 28 },
        { header: "Nội dung phản hồi", key: "feedback", width: 80 },
        { header: "Gửi lúc (GMT+7)", key: "submittedAt", width: 26 },
      ], sectionFeedback.map((row) => ({
        name: String(row.name ?? ""), email: String(row.email ?? ""), feedback: String(row.feedback ?? ""), submittedAt: iso(row.submitted_at),
      })));
    });

    const activityRows = activity.filter(row => ["PASSCODE_LOGIN", "IDEA_SUBMITTED", "SHOWCASE_SUBMITTED", "QUIZ_COMPLETED", "FEEDBACK_SUBMITTED"].includes(String(row.action))).filter(row => requestedSection === "all" || (row.details as Row)?.section === requestedSection);
    addSheet(workbook, "Learner activity", [
      { header: "Name", key: "name", width: 28 },
      { header: "Action", key: "action", width: 26 },
      { header: "Section", key: "section", width: 16 },
      ...(activityRows.some(row => reportInformation((row.details || {}) as Row, true)) ? [{ header: "Learner information", key: "information", width: 60 }] : []),
      { header: "Time (GMT+7)", key: "createdAt", width: 26 },
    ], activityRows.map(row => {
      const details = (row.details || {}) as Row;
      const information = reportInformation(details, true);
      return { sessionId: String(details.sessionId || ""), name: String(details.name || ""), email: String(details.email || ""), action: String(row.action), section: String(details.section || ""), recordId: String(details.recordId || ""), information, createdAt: iso(row.created_at) };
    }));
    const output = await workbook.xlsx.writeBuffer();
    const dateSuffix = dateBounds ? dateBounds.dateStr : "all-time";
    const sectionSuffix = requestedSection === "all" ? "all-sections" : requestedSection;
    return new Response(new Uint8Array(output), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `attachment; filename="eiu-interactive-report-${sectionSuffix}-${dateSuffix}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("Report export error:", error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Không thể xuất report." },
      { status: 500 },
    );
  }
}
