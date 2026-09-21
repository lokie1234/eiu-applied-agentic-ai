/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const logo = fs.readFileSync(path.join(root, "public/branding/eiu-logo-uploaded.png")).toString("base64");
const tmpDir = path.join(root, "tmp/pdfs");
const htmlPath = path.join(tmpDir, "section2-handout.html");
const pdfPath = path.join(root, "public/downloads/eiu-applied-agentic-ai-section-2-handout.pdf");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

fs.mkdirSync(tmpDir, { recursive: true });

const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>EIU Applied Agentic AI - Section 2 Handout</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 210mm; height: 297mm; }
    body {
      padding: 9mm 10mm 7mm;
      background: #fbfaf7;
      color: #17324a;
      font-family: "Segoe UI", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { height: 281mm; display: grid; grid-template-rows: 40mm minmax(0, 1fr) 8mm; gap: 2.8mm; }
    .hero {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: 1fr 43mm;
      align-items: center;
      padding: 7mm 8mm;
      border-radius: 7mm;
      color: white;
      background: linear-gradient(135deg, #041c31 0%, #082945 61%, #123f68 100%);
      box-shadow: 0 4mm 11mm rgba(4, 28, 49, .17);
    }
    .hero::before, .hero::after {
      content: "";
      position: absolute;
      border: .3mm solid rgba(233, 202, 139, .22);
      border-radius: 50%;
    }
    .hero::before { width: 52mm; height: 52mm; right: -15mm; top: -24mm; }
    .hero::after { width: 30mm; height: 30mm; right: 16mm; bottom: -20mm; }
    .eyebrow { color: #e9ca8b; font-size: 7.2pt; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
    h1 { margin: 2.3mm 0 1.4mm; font-size: 23pt; line-height: 1.03; letter-spacing: -.035em; }
    .hero p { margin: 0; max-width: 118mm; color: rgba(255,255,255,.76); font-size: 8.4pt; line-height: 1.4; }
    .logoBox { position: relative; z-index: 1; justify-self: end; width: 31mm; height: 31mm; display: grid; place-items: center; border: .3mm solid rgba(255,255,255,.18); border-radius: 50%; background: rgba(255,255,255,.08); }
    .logoBox img { width: 24mm; height: 24mm; object-fit: contain; }
    .content {
      display: grid;
      grid-template-columns: 1.02fr .98fr;
      grid-template-rows: minmax(0, 1.24fr) minmax(0, .82fr) minmax(0, 1fr);
      grid-template-areas: "requirement lab" "core ideas" "framework output";
      gap: 2.7mm 3.5mm;
      min-height: 0;
    }
    .column { display: contents; }
    .column:first-child > .section:nth-child(1) { grid-area: requirement; }
    .column:first-child > .section:nth-child(2) { grid-area: core; }
    .column:first-child > .section:nth-child(3) { grid-area: framework; }
    .column:last-child > .section:nth-child(1) { grid-area: lab; }
    .column:last-child > .section:nth-child(2) { grid-area: ideas; }
    .column:last-child > .section:nth-child(3) { grid-area: output; }
    .section { min-height: 0; height: 100%; display: flex; flex-direction: column; justify-content: center; overflow: hidden; padding: 3.3mm; border: .3mm solid rgba(8,41,69,.12); border-radius: 5mm; background: #fff; box-shadow: 0 2mm 6mm rgba(8,41,69,.055); }
    .section.gold { background: linear-gradient(145deg, #fff 0%, #f7f4ed 100%); border-color: rgba(179,145,89,.27); }
    .section.dark { color: white; border-color: transparent; background: linear-gradient(145deg, #123f68, #082945); }
    .sectionHead { display: flex; align-items: center; gap: 2.4mm; margin-bottom: 2.5mm; }
    .num { flex: 0 0 auto; display: grid; place-items: center; width: 7mm; height: 7mm; border-radius: 50%; background: #b39159; color: white; font-size: 7pt; font-weight: 800; }
    h2 { margin: 0; color: #082945; font-size: 11.5pt; line-height: 1.16; letter-spacing: -.018em; }
    .dark h2 { color: white; }
    .lead { margin: -1mm 0 2.7mm 9.4mm; color: #687987; font-size: 7.5pt; line-height: 1.35; }
    .dark .lead { color: rgba(255,255,255,.68); }
    .chips { display: flex; flex-wrap: wrap; gap: 1.5mm; }
    .chip { padding: 1.4mm 2mm; border-radius: 99mm; background: #f7f4ed; color: #17324a; font-size: 7pt; font-weight: 650; }
    .chip.navy { background: #e7eef4; color: #123f68; }
    .testList { display: grid; grid-template-columns: 1fr 1fr; gap: 1.7mm; margin-top: 2.7mm; }
    .test { min-height: 12mm; display: grid; grid-template-columns: 12mm 1fr; gap: 1.6mm; align-items: start; padding: 2mm; border-radius: 3mm; background: #fbfaf7; font-size: 7pt; line-height: 1.3; }
    .test b { color: #b39159; font-size: 6.2pt; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
    .split > div { padding: 2.8mm; border-radius: 3.4mm; background: #f7f4ed; }
    .split > div:first-child { color: white; background: #082945; }
    .label { display: block; margin-bottom: 1.7mm; color: #9d7944; font-size: 6.2pt; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
    .split ul { margin: 0; padding-left: 3.5mm; font-size: 7pt; line-height: 1.5; }
    .split > div:first-child .label { color: #e9ca8b; }
    .framework { display: grid; grid-template-columns: 1fr 8mm 1fr; align-items: stretch; gap: 1mm; }
    .frameworkBox { padding: 3mm; border-radius: 3.5mm; background: #f7f4ed; }
    .frameworkBox:last-child { color: white; background: #082945; }
    .frameworkBox strong { display: block; margin-bottom: 1mm; font-size: 8pt; }
    .frameworkBox p { margin: 0; font-size: 6.9pt; line-height: 1.38; color: #687987; }
    .frameworkBox:last-child p { color: rgba(255,255,255,.7); }
    .arrow { align-self: center; text-align: center; color: #b39159; font-size: 15pt; font-weight: 300; }
    .formula { margin-top: 2.5mm; padding: 2.5mm 3mm; border-radius: 3mm; background: #efe7d8; color: #082945; font-size: 7pt; font-weight: 800; text-align: center; }
    .formula span { color: #9d7944; }
    .roadmap { display: grid; grid-template-columns: 1fr 1fr; gap: 1.7mm; }
    .step { position: relative; min-height: 14mm; padding: 2.4mm 2.5mm 2.2mm 9mm; border-radius: 3mm; background: rgba(255,255,255,.08); font-size: 6.9pt; line-height: 1.3; }
    .step b { position: absolute; left: 2.4mm; top: 2.5mm; color: #e9ca8b; font-size: 7pt; }
    .step strong { display: block; margin-bottom: .8mm; color: white; font-size: 7pt; }
    .prompt { margin-top: 2.5mm; padding: 2.5mm 3mm; border-left: 1.2mm solid #b39159; background: rgba(255,255,255,.075); color: rgba(255,255,255,.82); font-size: 7pt; line-height: 1.4; }
    .prompt strong { color: #f4dfb0; }
    .practice { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4mm; }
    .practice span { padding: 1.6mm 1.4mm; border: .25mm solid rgba(8,41,69,.1); border-radius: 2.4mm; background: #fbfaf7; text-align: center; font-size: 6.7pt; font-weight: 650; }
    .gemParts { grid-template-columns: 1fr 1fr; gap: 2mm; }
    .gemParts span { min-height: 14mm; display: flex; flex-direction: column; justify-content: center; text-align: left; padding: 2.2mm 2.5mm; color: #687987; font-size: 7pt; font-weight: 500; }
    .gemParts b { margin-bottom: .8mm; color: #082945; font-size: 7.6pt; }
    .output { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5mm; }
    .output div { padding: 1.7mm 2mm; border-radius: 2.7mm; background: #f7f4ed; font-size: 7pt; font-weight: 700; }
    .output div::before { content: "✓"; margin-right: 1.4mm; color: #b39159; font-weight: 900; }
    .advanced { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4mm; margin-top: 2.3mm; }
    .advanced div { padding: 1.8mm; border-radius: 2.5mm; background: #082945; color: rgba(255,255,255,.76); font-size: 6.2pt; line-height: 1.3; }
    .advanced b { display: block; margin-bottom: .6mm; color: #e9ca8b; font-size: 6.45pt; }
    .takeaway { margin-top: 2.5mm; padding-top: 2.5mm; border-top: .3mm solid rgba(8,41,69,.11); color: #082945; font-size: 7.7pt; line-height: 1.4; }
    .takeaway strong { color: #9d7944; }
    footer { display: flex; align-items: center; justify-content: space-between; border-top: .35mm solid rgba(8,41,69,.15); color: #687987; font-size: 6.5pt; }
    footer strong { color: #9d7944; letter-spacing: .09em; text-transform: uppercase; }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div>
        <div class="eyebrow">EIU · Applied Agentic AI · Section 2</div>
        <h1>AI Business Framework<br>&amp; Gemini Gems</h1>
        <p>Từ Requirement có thể kiểm thử đến một bộ tiêu chuẩn tái sử dụng để AI tạo nhiều Web App theo cùng chuẩn doanh nghiệp.</p>
      </div>
      <div class="logoBox"><img src="data:image/png;base64,${logo}" alt="EIU"></div>
    </header>

    <section class="content">
      <div class="column">
        <article class="section gold">
          <div class="sectionHead"><span class="num">01</span><h2>Requirement phải mô tả được cách hệ thống vận hành</h2></div>
          <p class="lead">Bắt đầu từ bài toán nghiệp vụ. Mỗi tiêu chí phải kiểm tra được bằng một hành động cụ thể.</p>
          <div class="chips">
            <span class="chip navy">Mục tiêu</span><span class="chip">Người dùng</span><span class="chip navy">Dữ liệu</span><span class="chip">Workflow</span><span class="chip navy">Quy tắc nghiệp vụ</span><span class="chip">Tiêu chí chấp nhận</span><span class="chip navy">Báo cáo</span>
          </div>
          <div class="testList">
            <div class="test"><b>TEST 01</b><span>Không thể nộp form nếu thiếu trường bắt buộc.</span></div>
            <div class="test"><b>TEST 02</b><span>Sau khi nộp, dữ liệu và Dashboard phải cập nhật đúng.</span></div>
          </div>
        </article>

        <article class="section">
          <div class="sectionHead"><span class="num">02</span><h2>Tách lõi dùng chung khỏi phần thay đổi theo ứng dụng</h2></div>
          <div class="split">
            <div>
              <span class="label">Dùng chung</span>
              <ul><li>Kiến trúc hệ thống</li><li>Tiêu chuẩn UI</li><li>Quy tắc viết code</li><li>Thiết kế cơ sở dữ liệu</li><li>Kiểm thử và triển khai</li></ul>
            </div>
            <div>
              <span class="label">Thay đổi theo app</span>
              <ul><li>Mục tiêu nghiệp vụ</li><li>Vai trò người dùng</li><li>Dữ liệu cần thu thập</li><li>Workflow và ngoại lệ</li><li>Chỉ số Dashboard</li></ul>
            </div>
          </div>
        </article>

        <article class="section gold">
          <div class="sectionHead"><span class="num">03</span><h2>Framework là nội dung tiêu chuẩn, Gem là cách đóng gói</h2></div>
          <div class="framework">
            <div class="frameworkBox"><strong>AI Business Framework</strong><p>UI, mã nguồn, dữ liệu, bảo mật, kiểm thử và quy trình triển khai.</p></div>
            <div class="arrow">→</div>
            <div class="frameworkBox"><strong>Gem</strong><p>Name, Instructions, Knowledge và Preview giúp Gemini áp dụng đúng Framework.</p></div>
          </div>
          <div class="formula">Persona <span>+</span> Task <span>+</span> Context <span>+</span> Format <span>+</span> AI Business Framework</div>
        </article>
      </div>

      <div class="column">
        <article class="section dark">
          <div class="sectionHead"><span class="num">04</span><h2>Lab 2: xây Gem từ hai ứng dụng mẫu</h2></div>
          <p class="lead">Dùng bộ 3 file thực hành có sẵn để phân tích, cài đặt và kiểm tra.</p>
          <div class="roadmap">
            <div class="step"><b>01</b><strong>Phân tích</strong>Tách Framework từ hai app mẫu.</div>
            <div class="step"><b>02</b><strong>Cài đặt</strong>Điền Name, Instructions và Knowledge.</div>
            <div class="step"><b>03</b><strong>Kiểm tra</strong>Chạy thử bằng Requirement mới.</div>
            <div class="step"><b>04</b><strong>Lưu và chia sẻ</strong>Hoàn thiện rồi đưa bài làm lên lớp.</div>
          </div>
          <div class="prompt"><strong>Prompt kiểm thử rút gọn:</strong> “Tạo app để…” rồi nêu đúng bài toán. Gem phải hỏi thêm thông tin còn thiếu trước khi tạo code.</div>
        </article>

        <article class="section">
          <div class="sectionHead"><span class="num">05</span><h2>Bên trong một Gem</h2></div>
          <div class="practice gemParts">
            <span><b>Name</b>Tên và mục đích</span>
            <span><b>Instructions</b>Vai trò và quy tắc</span>
            <span><b>Knowledge</b>Tài liệu tham chiếu</span>
            <span><b>Preview</b>Kiểm thử trước khi lưu</span>
          </div>
        </article>

        <article class="section gold">
          <div class="sectionHead"><span class="num">06</span><h2>Đầu ra cần hoàn thành</h2></div>
          <div class="output">
            <div>Framework tái sử dụng</div><div>Gem đã cài đặt</div>
            <div>Prompt kiểm thử</div><div>Bài làm để chia sẻ</div>
          </div>
          <p class="takeaway">Bài làm cuối: một Gem biết hỏi làm rõ trước khi tạo code và áp dụng đúng <strong>AI Business Framework</strong> của doanh nghiệp.</p>
        </article>
      </div>
    </section>

    <footer><span>EIU BA Hub · Applied Agentic AI</span><strong>One-page handout · Section 2</strong></footer>
  </main>
</body>
</html>`;

fs.writeFileSync(htmlPath, html, "utf8");
execFileSync(edgePath, [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${pdfPath}`,
  htmlPath,
], { stdio: "inherit" });

console.log(`Generated ${pdfPath}`);
