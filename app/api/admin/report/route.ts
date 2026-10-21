import ExcelJS from "exceljs";
import { currentRole } from "@/lib/currentRole";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { collectReportLearners } from "@/lib/reportLearners";
import { reportScope, reportScopeKey, scopedReportActivity } from "@/lib/reportScopes";
import { courseHierarchy } from "@/lib/courseHierarchy";

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
  columns = [...columns, { header: "Course", key: "course", width: 38 }, { header: "Section", key: "sectionTitle", width: 40 }, { header: "Folder", key: "folder", width: 34 }];
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

function scopeValues(row: Row) {
  return { folder: String(row.folderGroupName || ""), course: String(row.courseTitle || ""), sectionTitle: String(row.sectionTitle || row.section || "") };
}

export async function GET(request: Request) {
  try {
    if ((await currentRole()) !== "admin") return Response.json({ success: false, message: "Chỉ admin mới có quyền xuất report." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode")?.trim().toLowerCase() || "report";
    const requestedSection = sectionKey(searchParams.get("section")) || "all";
    const requestedCourse = searchParams.get("courseId")?.trim() || "all";
    const requestedSectionId = searchParams.get("sectionId")?.trim() || "all";
    const requestedFolder = searchParams.get("folderId")?.trim() || "all";
    const [rawCourses, courseSections] = await Promise.all([fetchAll("courses", "created_at"), fetchAll("course_sections", "position")]);
    const { courses, folders } = courseHierarchy(rawCourses);
    const configuredScopes = courseSections.length ? courseSections.map(section => reportScope({ sectionId: section.id, courseId: section.course_id, section: section.section_key }, courses, courseSections))
      : DEFAULT_SECTIONS.map(section => reportScope({ section }, courses, courseSections));
    if (mode === "sections") {
      const sectionStates = await fetchAll("section_state", "updated_at");
      const sections = collectSections([], sectionStates.map(row => row.section));
      return Response.json({ success: true, sections: sections.map(section => ({ value: section, label: sectionLabel(section) })),
        folders: folders.map(folder=>({value:folder.id,label:folder.name})),
        courses: [...new Map(configuredScopes.map(scope => [String(scope.courseId), { value: String(scope.courseId), label: String(scope.courseTitle), folderGroupId:scope.folderGroupId }])).values()],
        courseSections: configuredScopes.map(scope => ({ value: scope.sectionId, label: scope.sectionTitle, courseId: scope.courseId, courseTitle: scope.courseTitle, folderGroupId:scope.folderGroupId })),
      }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const dateParam = searchParams.get("date")?.trim() || "";
    const tzOffsetMinutes = Number(searchParams.get("tzOffset") ?? -420);
    const dateBounds = dateParam && dateParam !== "all" ? getDateBounds(dateParam, Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : -420) : null;
    const timed = (column: string) => dateBounds ? { column, startIso: dateBounds.startIso, endIso: dateBounds.endIso } : null;
    const [legacyRows, ideaRows, showcaseRows, quizRows, feedbackRows, sectionStates, rawActivity] = await Promise.all([
      fetchAll("learner_profiles", "updated_at", timed("updated_at")), fetchAll("ideas", "submitted_at", timed("submitted_at")),
      fetchAll("showcase_items", "shared_at", timed("shared_at")), fetchAll("quiz_results", "completed_at", timed("completed_at")),
      fetchAll("feedback", "submitted_at", timed("submitted_at")), fetchAll("section_state", "updated_at"), fetchAll("access_audit_logs", "created_at", timed("created_at")),
    ]);
    const normalize = (rows: Row[]) => rows.map(row => reportScope(row, courses, courseSections));
    const activity = scopedReportActivity(rawActivity, courses, courseSections);
    const ideas = normalize(ideaRows), quiz = normalize(quizRows), feedback = normalize(feedbackRows);
    const submissions: Row[] = activity.filter(row => row.action === "SHOWCASE_SUBMITTED" && (row.details as Row).submissionStorage === "audit")
      .map(row => ({ ...(row.details as Row), id: row.id, shared_at: row.created_at }));
    const showcase = [...normalize(showcaseRows), ...submissions];
    const learners = collectReportLearners(normalize(legacyRows), activity, [...ideas, ...showcase, ...quiz, ...feedback]);
    const scopeMap = new Map<string, Row>();
    for (const scope of [...configuredScopes, ...sectionStates.map(row => reportScope(row, courses, courseSections)), ...learners, ...ideas, ...showcase, ...quiz, ...feedback]) {
      if (scope.section) scopeMap.set(reportScopeKey(scope), scope);
    }
    const availableScopes = [...scopeMap.values()].sort((a,b) => String(a.courseTitle).localeCompare(String(b.courseTitle)) || String(a.section).localeCompare(String(b.section), undefined, { numeric: true }));
    if (requestedFolder !== "all" && !folders.some(folder=>folder.id===requestedFolder)
      || requestedCourse !== "all" && !availableScopes.some(scope => scope.courseId === requestedCourse && (requestedFolder === "all" || scope.folderGroupId === requestedFolder))
      || requestedSectionId !== "all" && !availableScopes.some(scope => scope.sectionId === requestedSectionId && (requestedCourse === "all" || scope.courseId === requestedCourse) && (requestedFolder === "all" || scope.folderGroupId === requestedFolder))
      || requestedSection !== "all" && !availableScopes.some(scope => sectionKey(scope.section) === requestedSection)) {
      return Response.json({ success: false, message: "Course hoặc Section được chọn không tồn tại." }, { status: 400 });
    }
    const selected = (row: Row) => (requestedFolder === "all" || row.folderGroupId === requestedFolder) && (requestedCourse === "all" || row.courseId === requestedCourse) && (requestedSectionId === "all" || row.sectionId === requestedSectionId) && (requestedSection === "all" || sectionKey(row.section) === requestedSection);
    const sections = availableScopes.filter(selected);
    const scopedLearners = learners.filter(selected), scopedIdeas = ideas.filter(selected), scopedShowcase = showcase.filter(selected), scopedQuiz = quiz.filter(selected), scopedFeedback = feedback.filter(selected);
    const inScope = (rows: Row[], scope: Row) => rows.filter(row => reportScopeKey(row) === reportScopeKey(scope));
    const dataGroups = [{ label: "Học viên", rows: scopedLearners }, { label: "Ý tưởng", rows: scopedIdeas }, { label: "Bài làm chia sẻ", rows: scopedShowcase }, { label: "Quiz", rows: scopedQuiz }, { label: "Feedback", rows: scopedFeedback }];
    const workbook = new ExcelJS.Workbook();workbook.creator = "EIU Learning";workbook.created = new Date();workbook.modified = new Date();workbook.title = "EIU - Course and Section Report";
    const summary = workbook.addWorksheet("Tong quan", { views: [{ state: "frozen", ySplit: 5 }] });
    summary.columns = [{ key: "label", width: 34 }, ...sections.map((_,i)=>({ key: `section${i+1}`, width: 36 })), { key: "total", width: 14 }];
    summary.mergeCells(1,1,1,sections.length+2);summary.getCell("A1").value = "EIU - COURSE & SECTION REPORT";
    summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF082945" } };summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };summary.getRow(1).height=32;
    summary.addRow(["Phạm vi báo cáo", dateBounds ? `Ngày ${dateBounds.dateStr.split("-").reverse().join("/")} (Giờ VN - UTC+7)` : "Tất cả thời gian"]);
    summary.addRow(["Xuất lúc (GMT+7)", iso(new Date().toISOString())]);summary.addRow([]);
    summary.addRow(["Loại dữ liệu", ...sections.map(scope=>`${scope.folderGroupName} · ${scope.courseTitle} · ${scope.sectionTitle}`), "Tổng"]);styleHeader(summary.getRow(5));summary.getRow(5).height=64;summary.getRow(5).alignment={wrapText:true,vertical:"middle"};
    dataGroups.forEach(({label,rows})=>summary.addRow([label,...sections.map(scope=>inScope(rows,scope).length),rows.length]));
    const courseIds=[...new Set(sections.map(scope=>String(scope.courseId)))];
    const usedPrefixes = new Set<string>();
    sections.forEach((scope,index)=>{
      const prefix = `${courseIds.length>1 ? 'C'+(courseIds.indexOf(String(scope.courseId))+1)+' ' : ''}${sectionSheetPrefix(String(scope.section))}`;
      let sheetPrefix = prefix;
      for (let suffix = index + 1; usedPrefixes.has(sheetPrefix); suffix++) sheetPrefix = prefix + '-' + suffix;
      usedPrefixes.add(sheetPrefix);
      const sectionLearners=inScope(scopedLearners,scope);
      addSheet(workbook,`${sheetPrefix} - Hoc vien`,[
        {header:"Họ tên",key:"name",width:30},{header:"Email",key:"email",width:36},
        ...(sectionLearners.some(row=>reportInformation(row))?[{header:"Learner information",key:"information",width:60}]:[]),
        {header:"Tạo lúc (GMT+7)",key:"createdAt",width:26},{header:"Cập nhật lúc (GMT+7)",key:"updatedAt",width:26},
      ],sectionLearners.map(row=>({...scopeValues(row),name:String(row.name??""),email:String(row.email??""),information:reportInformation(row),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)})));
      addSheet(workbook,`${sheetPrefix} - Y tuong`,[{header:"Họ tên",key:"name",width:28},{header:"Ý tưởng",key:"idea",width:80},{header:"Gửi lúc (GMT+7)",key:"submittedAt",width:26}],inScope(scopedIdeas,scope).map(row=>({...scopeValues(row),name:String(row.name??""),idea:String(row.idea??""),submittedAt:iso(row.submitted_at)})));
      addSheet(workbook,`${sheetPrefix} - Bai lam`,[{header:"Họ tên",key:"name",width:28},{header:"URL",key:"url",width:70},{header:"Chia sẻ lúc (GMT+7)",key:"sharedAt",width:26}],inScope(scopedShowcase,scope).map(row=>({...scopeValues(row),name:String(row.name??""),url:String(row.url??""),sharedAt:iso(row.shared_at)})));
      addSheet(workbook,`${sheetPrefix} - Quiz`,[{header:"Họ tên",key:"name",width:28},{header:"Điểm",key:"score",width:10},{header:"Tổng điểm",key:"total",width:12},{header:"Hoàn thành lúc (GMT+7)",key:"completedAt",width:26}],inScope(scopedQuiz,scope).map(row=>({...scopeValues(row),name:String(row.name??""),score:Number(row.score??0),total:Number(row.total??0),completedAt:iso(row.completed_at)})));
      addSheet(workbook,`${sheetPrefix} - Feedback`,[{header:"Họ tên",key:"name",width:28},{header:"Nội dung phản hồi",key:"feedback",width:80},{header:"Gửi lúc (GMT+7)",key:"submittedAt",width:26}],inScope(scopedFeedback,scope).map(row=>({...scopeValues(row),name:String(row.name??""),feedback:String(row.feedback??""),submittedAt:iso(row.submitted_at)})));
    });
    const activityRows: Row[] = activity.filter(row=>["PASSCODE_LOGIN","SECTION_OPENED","IDEA_SUBMITTED","SHOWCASE_SUBMITTED","QUIZ_COMPLETED","FEEDBACK_SUBMITTED"].includes(String(row.action))).flatMap(row=>{
      const details=(row.details||{}) as Row;
      if(details.accessMode==="facilitator")return [];
      return (row.action==="PASSCODE_LOGIN"?(details.scopes||[]) as Row[]:[details]).filter(selected).map(scope=>({...row,details:{...details,...scope}}));
    });
    addSheet(workbook,"Learner activity",[{header:"Name",key:"name",width:28},{header:"Action",key:"action",width:26},{header:"Section key",key:"section",width:16},
      ...(activityRows.some(row=>reportInformation((row.details||{}) as Row,true))?[{header:"Learner information",key:"information",width:60}]:[]),{header:"Time (GMT+7)",key:"createdAt",width:26},
    ],activityRows.map(row=>{const details=(row.details||{}) as Row;return {...scopeValues(details),name:String(details.name||""),action:String(row.action),section:String(details.section||""),information:reportInformation(details,true),createdAt:iso(row.created_at)};}));
    const output=await workbook.xlsx.writeBuffer();
    const dateSuffix=dateBounds?dateBounds.dateStr:"all-time";
    const sectionSuffix=requestedSectionId!=="all"?requestedSectionId:requestedSection==="all"?"all-sections":requestedSection;
    const courseSuffix=requestedCourse==="all"?"all-courses":requestedCourse.replace(/[^a-zA-Z0-9_-]/g,"");
    const folderSuffix=requestedFolder==="all"?"all-folders":requestedFolder.replace(/[^a-zA-Z0-9_-]/g,"");
    return new Response(new Uint8Array(output),{headers:{"Cache-Control":"no-store, max-age=0","Content-Disposition":`attachment; filename="eiu-interactive-report-${folderSuffix}-${courseSuffix}-${sectionSuffix}-${dateSuffix}.xlsx"`,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
  } catch(error) {
    console.error("Report export error:",error);return Response.json({success:false,message:error instanceof Error?error.message:"Không thể xuất report."},{status:500});
  }
}
