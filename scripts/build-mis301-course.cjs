// Generate only the MIS 301 section; never rebuild unrelated course sections.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ExcelJS = require('exceljs');
const esbuild = require('esbuild');
const root = path.resolve('course-content/mis301');
const names = ['Demo_Pandas (Part 2).ipynb', 'Practice_Pandas (Part 2).ipynb', 'Solution_Pandas (Part 2).ipynb', 'student_data.csv', 'happiness_survey_data.csv', 'Course Offerings.xlsx'];
function csv(text) {
  const records = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(value.replace(/\r$/, '')); value = ''; if (c === '\n') { records.push(row); row = []; } }
    else value += c;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); records.push(row); }
  const columns = records.shift(); columns[0] = columns[0].replace(/^\uFEFF/, '');
  return { columns, rows: records.filter(r => r.some(Boolean)).map(r => r.map(v => v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : v)) };
}
(async () => {
  const storyboard = JSON.parse(fs.readFileSync(path.join(root, 'storyboard.json'), 'utf8'));
  storyboard.slides.forEach((slide, index) => { slide.number = index + 1; });
  const assets = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(root, name)).toString('base64')]));
  const datasets = {};
  for (const name of names.filter(name => name.endsWith('.csv'))) datasets[name] = [csv(fs.readFileSync(path.join(root, name), 'utf8'))];
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile(path.join(root, 'Course Offerings.xlsx'));
  datasets['Course Offerings.xlsx'] = excel.worksheets.map(sheet => ({ name: sheet.name, columns: sheet.getRow(1).values.slice(1), rows: sheet.getRows(2, sheet.rowCount - 1).map(row => Array.from({ length: sheet.columnCount }, (_, i) => row.getCell(i + 1).value)) }));
  const template = 'data:image/png;base64,' + fs.readFileSync('public/templates/eiu-business-v1/background.png').toString('base64');
  const robotRuntime = await esbuild.build({ entryPoints: [path.join(root, 'robots3d.js')], bundle: true, write: false, format: 'iife', globalName: 'WheelRobots3D', platform: 'browser', target: 'es2020', minify: true, legalComments: 'inline' });
  const courseFontCss = `@font-face{font-family:'MIS Inter';src:url(data:font/woff2;base64,${fs.readFileSync('course-content/web-app-development/fonts/Inter-Variable.woff2').toString('base64')}) format('woff2');font-weight:100 900;font-display:swap}.mis,.mis button,.mis input,.mis .wheel-segment text,.mis .ground-name,.mis .wheel-setting input{font-family:'MIS Inter',Inter,Arial,sans-serif}`;
  const practiceSource = fs.readFileSync('lib/mis301Practice.ts', 'utf8');
  const practiceExports = {};
  const demoExports = {};
  new Function('exports', ts.transpileModule(fs.readFileSync('lib/classroomDemo.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(demoExports);
  // Only project-owned static configuration is compiled here, never uploaded input.
  new Function('exports', ts.transpileModule(practiceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(practiceExports);
  const source = `const robotRuntimeSource = ${JSON.stringify(robotRuntime.outputFiles[0].text)};\nlet robotEngine;\nfunction createWheelRobots(stage){ if(!robotEngine) robotEngine=new Function(robotRuntimeSource+';return WheelRobots3D;')(); return robotEngine.create(stage); }\nconst course = ${JSON.stringify(storyboard)};\nconst practiceParts = ${JSON.stringify(practiceExports.MIS301_PRACTICE)};\nconst demoLearners = ${JSON.stringify(demoExports.MIS301_DEMO_LEARNERS)};\nconst assets = ${JSON.stringify(assets)};\nconst datasets = ${JSON.stringify(datasets)};\nconst template = ${JSON.stringify(template)};\nconst wheelCss = ${JSON.stringify(fs.readFileSync(path.join(root, 'wheel.css'), 'utf8'))};\nconst courseFontCss = ${JSON.stringify(courseFontCss)};\nconst practicePopupCss = ${JSON.stringify(fs.readFileSync(path.join(root, 'practice-popup.css'), 'utf8'))};\n` + fs.readFileSync(path.join(root, 'wheel.tsx.txt'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'practice-popup.tsx.txt'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'renderer.tsx.txt'), 'utf8');
  const result = ts.transpileModule(source, { fileName: 'MIS301.tsx', compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'h', jsxFragmentFactory: 'Fragment' } });
  fs.writeFileSync(path.join(root, 'PandasPracticePart2.js'), result.outputText);
  const attachment = JSON.parse(fs.readFileSync(path.join(root, 'attachment.json'), 'utf8'));
  attachment.section.slide_count = storyboard.slides.length;
  attachment.section.learner_slide_count = storyboard.slides.filter(slide => !slide.adminOnly).length;
  fs.writeFileSync(path.join(root, 'attachment.json'), JSON.stringify(attachment, null, 2) + '\n');
  console.log(`Generated MIS 301 Section 1: ${storyboard.slides.length} slides, bundled source files and offline notebook demo.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
