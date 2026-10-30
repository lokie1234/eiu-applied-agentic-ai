// Generate only the self-contained MIS 301 lesson.
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const ts = require('typescript');
const { minify } = require('next/dist/compiled/terser');
const ExcelJS = require('exceljs');
const root = path.resolve('course-content/mis301');
const downloads = ['Demo_Pandas (Part 2).ipynb', 'Practice_Pandas (Part 2).ipynb', 'Course Offerings.xlsx'];
const csvFiles = ['student_data.csv', 'happiness_survey_data.csv'];
function compile(source, fileName) {
  const result = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'h', jsxFragmentFactory: 'Fragment', removeComments: true } });
  const errors = result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) || [];
  if (errors.length) throw Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }));
  return result.outputText;
}
(async () => {
  const storyboard = JSON.parse(fs.readFileSync(path.join(root, 'storyboard.json'), 'utf8'));
  storyboard.slides.forEach((slide, index) => { slide.number = index + 1; });
  // Keep original downloads intact; expand notebook archives only when clicked.
  const assets = Object.fromEntries(downloads.map(name => {
    const bytes = fs.readFileSync(path.join(root, name));
    return [name, name.endsWith('.ipynb') ? { gzip: gzipSync(bytes).toString('base64') } : bytes.toString('base64')];
  }));
  // CSV text serves both downloads and parsing. Avoid shipping it three times.
  const datasets = Object.fromEntries(csvFiles.map(name => [name, [{ csvSource: fs.readFileSync(path.join(root, name), 'utf8') }]]));
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile(path.join(root, 'Course Offerings.xlsx'));
  datasets['Course Offerings.xlsx'] = excel.worksheets.map(sheet => {
    const columns = sheet.getRow(1).values.slice(1);
    const rows = (sheet.getRows(2, Math.max(0, sheet.rowCount - 1)) || []).map(row => Array.from({ length: columns.length }, (_, i) => row.getCell(i + 1).value));
    while (rows.length && rows[rows.length - 1].every(value => value == null || value === '')) rows.pop();
    return { name: sheet.name, columns, rows };
  });
  const template = 'data:image/png;base64,' + fs.readFileSync('public/templates/eiu-business-v1/background.png').toString('base64');
  const courseFontCss = `@font-face{font-family:'MIS Inter';src:url(data:font/woff2;base64,${fs.readFileSync('course-content/web-app-development/fonts/Inter-Variable.woff2').toString('base64')}) format('woff2');font-weight:100 900;font-display:swap}.mis,.mis button,.mis input,.mis .question-name,.mis .wheel-setting input{font-family:'MIS Inter',Inter,Arial,sans-serif}`;
  const practiceExports = {}, demoExports = {};
  new Function('exports', compile(fs.readFileSync('lib/mis301Practice.ts', 'utf8'), 'mis301Practice.ts'))(practiceExports);
  new Function('exports', compile(fs.readFileSync('lib/classroomDemo.ts', 'utf8'), 'classroomDemo.ts'))(demoExports);
  const constants = { course: storyboard, assignmentParts: practiceExports.MIS301_QUESTION_FIELDS, questionDefaults: practiceExports.MIS301_QUESTION_DEFAULTS,
    demoLearners: demoExports.MIS301_DEMO_LEARNERS, assets, datasets, template, courseFontCss,
    conceptCss: fs.readFileSync(path.join(root, 'concept-slides.css'), 'utf8').replace(/\r\n/g, '\n'), wheelCss: fs.readFileSync(path.join(root, 'wheel.css'), 'utf8').replace(/\r\n/g, '\n'), practicePopupCss: fs.readFileSync(path.join(root, 'practice-popup.css'), 'utf8').replace(/\r\n/g, '\n') };
  const header = Object.entries(constants).map(([name,value]) => `const ${name} = ${JSON.stringify(value)};`).join('\n');
  const source = header + '\n' + ['wheel.tsx.txt', 'practice-popup.tsx.txt', 'concept-slides.tsx.txt', 'renderer.tsx.txt'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
  const result = await minify(compile(source, 'MIS301.tsx'), { ecma: 2020, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (!result.code) throw Error('The lesson compiler produced no code.');
  fs.writeFileSync(path.join(root, 'PandasPracticePart2.js'), result.code + '\n');
  const attachment = JSON.parse(fs.readFileSync(path.join(root, 'attachment.json'), 'utf8'));
  attachment.section.slide_count = storyboard.slides.length;
  attachment.section.learner_slide_count = storyboard.slides.filter(slide => !slide.adminOnly).length;
  fs.writeFileSync(path.join(root, 'attachment.json'), JSON.stringify(attachment, null, 2) + '\n');
  console.log(`Generated MIS 301: ${storyboard.slides.length} teaching slides, ${Buffer.byteLength(result.code)} bytes.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
