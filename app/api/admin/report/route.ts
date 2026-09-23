import ExcelJS from "exceljs";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";

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

function iso(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? String(value ?? "") : date.toISOString();
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
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
  });
  return sheet;
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
    const dateParam = searchParams.get("date")?.trim() || "";
    const tzOffsetMinutes = Number(searchParams.get("tzOffset") ?? -420);
    const dateBounds =
      dateParam && dateParam !== "all"
        ? getDateBounds(dateParam, Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : -420)
        : null;

    const [learners, ideas, showcase, quiz, feedback] = await Promise.all([
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
    ]);

    const countBySection = (rows: Row[], section: string) =>
      rows.filter((row) => row.section === section).length;
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
      { key: "section1", width: 18 },
      { key: "section2", width: 18 },
      { key: "total", width: 14 },
    ];
    summary.mergeCells("A1:D1");
    summary.getCell("A1").value = "EIU APPLIED AGENTIC AI - INTERACTIVE REPORT";
    summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF082945" } };
    summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    summary.getRow(1).height = 32;

    const filterLabel = dateBounds
      ? `Ngày ${dateBounds.dateStr.split("-").reverse().join("/")} (Giờ VN - UTC+7)`
      : "Tất cả thời gian";
    summary.addRow(["Phạm vi báo cáo", filterLabel]);
    summary.addRow(["Xuất lúc (UTC)", generatedAt]);
    summary.addRow([]);
    summary.addRow(["Loại dữ liệu", "Section 1", "Section 2", "Tổng"]);
    styleHeader(summary.getRow(5));
    [
      ["Học viên", countBySection(learners, "section1"), countBySection(learners, "section2"), learners.length],
      ["Ý tưởng", countBySection(ideas, "section1"), countBySection(ideas, "section2"), ideas.length],
      ["Showcase", countBySection(showcase, "section1"), countBySection(showcase, "section2"), showcase.length],
      ["Quiz", countBySection(quiz, "section1"), countBySection(quiz, "section2"), quiz.length],
      ["Feedback", countBySection(feedback, "section1"), countBySection(feedback, "section2"), feedback.length],
    ].forEach((row) => summary.addRow(row));

    addSheet(workbook, "Learners", [
      { header: "Họ tên", key: "name", width: 30 },
      { header: "Email EIU", key: "email", width: 36 },
      { header: "Section", key: "section", width: 12 },
      { header: "Tạo lúc (UTC)", key: "createdAt", width: 26 },
      { header: "Cập nhật lúc (UTC)", key: "updatedAt", width: 26 },
    ], learners.map((row) => ({
      name: String(row.name ?? ""), email: String(row.email ?? ""), section: String(row.section ?? ""), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    })));

    addSheet(workbook, "Y tuong", [
      { header: "Section", key: "section", width: 12 },
      { header: "Họ tên", key: "name", width: 28 },
      { header: "Email EIU", key: "email", width: 34 },
      { header: "Ý tưởng", key: "idea", width: 80 },
      { header: "Gửi lúc (UTC)", key: "submittedAt", width: 26 },
    ], ideas.map((row) => ({
      section: String(row.section ?? ""), name: String(row.name ?? ""), email: String(row.email ?? ""), idea: String(row.idea ?? ""), submittedAt: iso(row.submitted_at),
    })));

    addSheet(workbook, "Showcase", [
      { header: "Section", key: "section", width: 12 },
      { header: "Họ tên", key: "name", width: 28 },
      { header: "Email EIU", key: "email", width: 34 },
      { header: "URL", key: "url", width: 70 },
      { header: "Chia sẻ lúc (UTC)", key: "sharedAt", width: 26 },
    ], showcase.map((row) => ({
      section: String(row.section ?? ""), name: String(row.name ?? ""), email: String(row.email ?? ""), url: String(row.url ?? ""), sharedAt: iso(row.shared_at),
    })));

    addSheet(workbook, "Quiz", [
      { header: "Section", key: "section", width: 12 },
      { header: "Họ tên", key: "name", width: 28 },
      { header: "Email", key: "email", width: 34 },
      { header: "Điểm", key: "score", width: 10 },
      { header: "Tổng điểm", key: "total", width: 12 },
      { header: "Hoàn thành lúc (UTC)", key: "completedAt", width: 26 },
    ], quiz.map((row) => ({
      section: String(row.section ?? ""), name: String(row.name ?? ""), email: String(row.email ?? ""), score: Number(row.score ?? 0), total: Number(row.total ?? 0), completedAt: iso(row.completed_at),
    })));

    addSheet(workbook, "Feedback", [
      { header: "Section", key: "section", width: 12 },
      { header: "Họ tên", key: "name", width: 28 },
      { header: "Email", key: "email", width: 34 },
      { header: "Nội dung phản hồi", key: "feedback", width: 80 },
      { header: "Gửi lúc (UTC)", key: "submittedAt", width: 26 },
    ], feedback.map((row) => ({
      section: String(row.section ?? ""), name: String(row.name ?? ""), email: String(row.email ?? ""), feedback: String(row.feedback ?? ""), submittedAt: iso(row.submitted_at),
    })));

    const output = await workbook.xlsx.writeBuffer();
    const fileSuffix = dateBounds ? dateBounds.dateStr : "all-time";
    return new Response(new Uint8Array(output), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `attachment; filename="eiu-interactive-report-${fileSuffix}.xlsx"`,
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
