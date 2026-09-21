/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logoBuffer = fs.readFileSync(path.join(__dirname, '../public/branding/eiu-logo-uploaded.png'));
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>EIU Section 1 Handout - Applied Agentic AI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      width: 210mm;
      height: 297mm;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #17324a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 8mm 10mm 7mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    /* HEADER */
    .header {
      background: linear-gradient(135deg, #041c31 0%, #082945 60%, #123f68 100%);
      border-radius: 12px;
      padding: 16px 20px;
      color: #ffffff;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(179, 145, 89, 0.45);
      box-shadow: 0 4px 14px rgba(4, 28, 49, 0.15);
    }

    .header::after {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      width: 180px;
      height: 100%;
      background: radial-gradient(circle at 100% 0%, rgba(179, 145, 89, 0.25) 0%, transparent 70%);
      pointer-events: none;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .header-kicker {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
      color: #e9ca8b;
      text-transform: uppercase;
      background: rgba(179, 145, 89, 0.2);
      padding: 3.5px 9px;
      border-radius: 5px;
      border: 1px solid rgba(233, 202, 139, 0.35);
    }

    .header-logo {
      height: 32px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
    }

    .header h1 {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.15;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .header-subtitle {
      font-size: 11.5px;
      font-weight: 500;
      color: #e9ca8b;
      line-height: 1.3;
    }

    /* CORE MINDSET CALLOUT */
    .mindset-card {
      background: #fbfaf7;
      border: 1.2px solid rgba(179, 145, 89, 0.4);
      border-left: 4.5px solid #b39159;
      border-radius: 8px;
      padding: 8px 12px;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .mindset-tag {
      font-size: 8.5px;
      font-weight: 900;
      color: #ffffff;
      background: #082945;
      padding: 3px 7px;
      border-radius: 4px;
      white-space: nowrap;
      letter-spacing: 0.06em;
    }

    .mindset-body {
      font-size: 9.5px;
      line-height: 1.35;
      color: #17324a;
    }

    .mindset-body strong {
      color: #082945;
      font-weight: 800;
    }

    /* LAB 1 MAP - 4 PHASES */
    .lab-map-wrap {
      margin-top: 6px;
    }

    .section-title {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9d7944;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title::after {
      content: "";
      flex: 1;
      height: 1px;
      background: rgba(179, 145, 89, 0.25);
    }

    .lab-map {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
    }

    .map-step {
      background: #fbfaf7;
      border: 1px solid rgba(8, 41, 69, 0.1);
      border-radius: 7px;
      padding: 6px 8px;
      position: relative;
    }

    .map-step.active {
      border-color: rgba(179, 145, 89, 0.6);
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(8, 41, 69, 0.04);
    }

    .map-step-num {
      font-size: 8px;
      font-weight: 900;
      color: #b39159;
      margin-bottom: 2px;
    }

    .map-step h4 {
      font-size: 11px;
      font-weight: 800;
      color: #082945;
      margin-bottom: 2px;
      line-height: 1.2;
    }

    .map-step p {
      font-size: 8.8px;
      color: #687987;
      line-height: 1.3;
    }

    /* MAIN 2-COLUMN GRID */
    .main-grid {
      display: grid;
      grid-template-columns: 1.18fr 0.82fr;
      gap: 10px;
      margin-top: 6px;
      flex: 1;
      min-height: 0;
    }

    /* LEFT: 8 STEPS */
    .steps-column {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .steps-list {
      display: grid;
      grid-template-rows: repeat(8, minmax(0, 1fr));
      gap: 5px;
      flex: 1;
      min-height: 0;
    }

    .step-item {
      display: flex;
      gap: 8px;
      padding: 7px 9px;
      background: #ffffff;
      border: 1px solid rgba(8, 41, 69, 0.08);
      border-radius: 6px;
      align-items: center;
    }

    .step-badge {
      width: 22px;
      height: 22px;
      flex: 0 0 22px;
      background: #082945;
      color: #e9ca8b;
      font-size: 9.5px;
      font-weight: 900;
      display: grid;
      place-items: center;
      border-radius: 5px;
      margin-top: 1px;
    }

    .step-text {
      flex: 1;
    }

    .step-text h5 {
      font-size: 11.2px;
      font-weight: 800;
      color: #082945;
      margin-bottom: 1px;
      line-height: 1.2;
    }

    .step-text p {
      font-size: 9.5px;
      color: #687987;
      line-height: 1.3;
    }

    .step-text p strong {
      color: #17324a;
    }

    .step-text p em {
      color: #9d7944;
      font-style: normal;
      font-weight: 700;
    }

    /* RIGHT: ARCHITECTURE & STANDARDS */
    .side-column {
      display: grid;
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: 7px;
      min-height: 0;
    }

    .side-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #fbfaf7;
      border: 1px solid rgba(8, 41, 69, 0.09);
      border-radius: 7px;
      padding: 10px 11px;
    }

    .side-box h4 {
      font-size: 10.2px;
      font-weight: 900;
      color: #082945;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .side-box h4 span {
      font-size: 7.5px;
      color: #b39159;
      font-weight: 700;
    }

    /* ARCHITECTURE 4 ROWS */
    .arch-list {
      display: flex;
      flex-direction: column;
      gap: 3.5px;
    }

    .arch-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid rgba(8, 41, 69, 0.06);
      padding: 3.5px 7px;
      border-radius: 4px;
      font-size: 9px;
    }

    .arch-name {
      font-weight: 800;
      color: #082945;
    }

    .arch-desc {
      color: #687987;
      font-size: 8.5px;
    }

    /* ITERATIVE LOOP */
    .loop-flow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3px;
      margin: 4px 0 2px;
    }

    .loop-node {
      background: #082945;
      color: #ffffff;
      padding: 3.5px 4px;
      border-radius: 5px;
      text-align: center;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .loop-node.gold {
      background: #b39159;
      color: #041c31;
    }

    .loop-node-num {
      font-size: 7px;
      font-weight: 900;
      opacity: 0.85;
      line-height: 1;
      margin-bottom: 2px;
    }

    .loop-node-name {
      font-size: 8.5px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
    }

    .loop-arrow {
      color: #b39159;
      font-size: 8px;
      font-weight: 900;
      flex: 0 0 auto;
    }

    /* PROMPT FORMULA */
    .formula-tag {
      background: rgba(179, 145, 89, 0.12);
      border: 1px solid rgba(179, 145, 89, 0.3);
      padding: 4px 7px;
      border-radius: 5px;
      font-size: 9px;
      color: #17324a;
      line-height: 1.35;
      margin-top: 2px;
    }

    .formula-tag strong {
      color: #082945;
    }

    /* DELIVERABLES CHECKLIST */
    .deliver-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3.5px;
    }

    .deliver-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 8.5px;
      font-weight: 700;
      color: #17324a;
      background: #ffffff;
      padding: 3px 5px;
      border-radius: 4px;
      border: 1px solid rgba(8, 41, 69, 0.05);
    }

    .deliver-check {
      color: #b39159;
      font-weight: 900;
      font-size: 9px;
    }

    .side-box > p {
      font-size: 8.8px !important;
      line-height: 1.38 !important;
    }

    /* KEY TAKEAWAY FOOTER BANNER */
    .takeaway-banner {
      background: linear-gradient(135deg, #082945 0%, #041c31 100%);
      border: 1.2px solid rgba(179, 145, 89, 0.4);
      border-radius: 8px;
      padding: 8px 14px;
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #ffffff;
    }

    .takeaway-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .takeaway-badge {
      font-size: 8px;
      font-weight: 900;
      color: #041c31;
      background: #e9ca8b;
      padding: 2.5px 6px;
      border-radius: 4px;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .takeaway-quote {
      font-size: 10px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .takeaway-quote strong {
      color: #e9ca8b;
    }

    /* FOOTER */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px solid rgba(8, 41, 69, 0.1);
      font-size: 7.5px;
      font-weight: 600;
      color: #687987;
    }

    .footer-gold {
      color: #b39159;
      font-weight: 800;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header class="header">
    <div class="header-top">
      <span class="header-kicker">EIU BA HUB · SECTION 1 HANDOUT</span>
      <img class="header-logo" src="${logoBase64}" alt="EIU Logo" />
    </div>
    <h1>Applied Agentic AI for Business</h1>
    <div class="header-subtitle">Từ yêu cầu nghiệp vụ đến Business Web App hoàn chỉnh bằng Gemini</div>
  </header>

  <!-- CORE MINDSET CALLOUT -->
  <div class="mindset-card">
    <span class="mindset-tag">TƯ DUY CỐT LÕI</span>
    <div class="mindset-body">
      <strong>Hiểu nghiệp vụ → Mô tả yêu cầu → Kiểm thử → Ra quyết định</strong><br/>
      Đây không phải khóa học lập trình. AI là trợ thủ viết code và dựng giao diện; con người làm chủ bài toán kinh doanh và kiểm soát chất lượng giải pháp.
    </div>
  </div>

  <!-- LAB 1 FLOW MAP -->
  <div class="lab-map-wrap">
    <div class="section-title">BẢN ĐỒ THỰC HÀNH LAB 1 · 4 CHẶNG TRIỂN KHAI</div>
    <div class="lab-map">
      <div class="map-step">
        <div class="map-step-num">CHẶNG 01</div>
        <h4>1. Nghiệp vụ</h4>
        <p>Ai dùng? Nhập gì? Ai phê duyệt? Cần báo cáo thống kê gì?</p>
      </div>
      <div class="map-step">
        <div class="map-step-num">CHẶNG 02</div>
        <h4>2. Prompt + Gemini</h4>
        <p>5 thành phần nghiệp vụ + đính kèm file design-dna.txt</p>
      </div>
      <div class="map-step">
        <div class="map-step-num">CHẶNG 03</div>
        <h4>3. Sheets + Apps Script</h4>
        <p>Cơ sở dữ liệu Sheets + 4 file mã nguồn trong Script Editor</p>
      </div>
      <div class="map-step active">
        <div class="map-step-num">CHẶNG 04</div>
        <h4>4. Deploy & Kiểm thử</h4>
        <p>New deployment > Anyone > URL /exec & test ghi dòng mới</p>
      </div>
    </div>
  </div>

  <!-- MAIN 2-COLUMN GRID -->
  <div class="main-grid">

    <!-- LEFT COLUMN: 8 STEPS -->
    <div class="steps-column">
      <div class="section-title">QUY TRÌNH 8 BƯỚC THỰC CHIẾN TỪ IDEA ĐẾN WEB APP</div>
      <div class="steps-list">

        <div class="step-item">
          <div class="step-badge">01</div>
          <div class="step-text">
            <h5>Xác định bài toán & người dùng</h5>
            <p>Chốt rõ: <strong>Ai sử dụng?</strong> Dữ liệu đầu vào gồm những trường nào? Luồng duyệt ra sao và người quản lý cần xem bảng dữ liệu nào?</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">02</div>
          <div class="step-text">
            <h5>Chuẩn bị Google Drive & Google Sheets</h5>
            <p>Tạo thư mục <em>Applied Agentic AI</em> trên Drive. Tạo 1 Google Sheet làm <strong>Database trung tâm</strong> để lưu trữ toàn bộ dữ liệu ứng dụng.</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">03</div>
          <div class="step-text">
            <h5>Thiết kế cấu trúc bảng dữ liệu (Schema)</h5>
            <p>Đặt tên các cột rõ ràng: <strong>Họ tên, Ngày bắt đầu, Ngày kết thúc, Lý do, Trạng thái (Chờ duyệt/Đã duyệt/Từ chối), Timestamp</strong>.</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">04</div>
          <div class="step-text">
            <h5>Viết Prompt chuẩn 5 thành phần</h5>
            <p>Cấu trúc: <strong>Mục tiêu</strong> + <strong>Người dùng</strong> + <strong>Dữ liệu</strong> + <strong>Quy trình</strong> + <strong>Công nghệ yêu cầu</strong> (Google Apps Script + HTML/CSS/JS).</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">05</div>
          <div class="step-text">
            <h5>Đính kèm EIU Design DNA (design-dna.txt)</h5>
            <p>Tải file <em>design-dna.txt</em> và gửi kèm Prompt để Gemini tự động thiết kế giao diện chuẩn <strong>Navy #082945 & Gold #B39159</strong>, responsive và sang trọng.</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">06</div>
          <div class="step-text">
            <h5>Tạo cấu trúc 4 file trong Apps Script</h5>
            <p>Mở Extensions > Apps Script. Tạo đủ 4 file: <strong>Code.gs</strong> (Backend), <strong>JavaScript.html</strong>, <strong>Style.html</strong> và <strong>Index.html</strong> (Frontend).</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">07</div>
          <div class="step-text">
            <h5>Lưu ý tạo file & xóa sạch code mặc định</h5>
            <p><strong>Bắt buộc:</strong> Tên file phân biệt hoa/thường (<em>Case-sensitive</em>). Phải <strong>xóa sạch nội dung mặc định</strong> trong file vừa tạo trước khi dán code mới.</p>
          </div>
        </div>

        <div class="step-item">
          <div class="step-badge">08</div>
          <div class="step-text">
            <h5>Triển khai (Deploy) & Kiểm thử</h5>
            <p>Chọn <em>Deploy > New deployment > Web app</em>. Cấu hình <strong>Who has access: Anyone</strong>. Sao chép URL kết thúc bằng <strong>/exec</strong> và nhập form thử nghiệm.</p>
          </div>
        </div>

      </div>
    </div>

    <!-- RIGHT COLUMN: ARCHITECTURE & EIU STANDARDS -->
    <div class="side-column">

      <!-- ARCHITECTURE -->
      <div class="side-box">
        <h4>4 THÀNH PHẦN PHẦN MỀM <span>KIẾN TRÚC</span></h4>
        <div class="arch-list">
          <div class="arch-row">
            <div><span class="arch-name">Frontend</span> <span class="arch-desc">(Giao diện)</span></div>
            <strong>Index.html / Style.html</strong>
          </div>
          <div class="arch-row">
            <div><span class="arch-name">Business Logic</span> <span class="arch-desc">(Xử lý)</span></div>
            <strong>Code.gs / Quy tắc duyệt</strong>
          </div>
          <div class="arch-row">
            <div><span class="arch-name">Database</span> <span class="arch-desc">(Lưu trữ)</span></div>
            <strong>Google Sheets</strong>
          </div>
          <div class="arch-row">
            <div><span class="arch-name">Integrations</span> <span class="arch-desc">(Mở rộng)</span></div>
            <strong>Gmail / Google Drive</strong>
          </div>
        </div>
      </div>

      <!-- ITERATIVE DEVELOPMENT -->
      <div class="side-box">
        <h4>VÒNG LẶP CẢI TIẾN AI <span>ITERATIVE</span></h4>
        <div class="loop-flow">
          <div class="loop-node">
            <span class="loop-node-num">01</span>
            <strong class="loop-node-name">Requirement</strong>
          </div>
          <span class="loop-arrow">→</span>
          <div class="loop-node gold">
            <span class="loop-node-num">02</span>
            <strong class="loop-node-name">Generate</strong>
          </div>
          <span class="loop-arrow">→</span>
          <div class="loop-node">
            <span class="loop-node-num">03</span>
            <strong class="loop-node-name">Test</strong>
          </div>
          <span class="loop-arrow">→</span>
          <div class="loop-node gold">
            <span class="loop-node-num">04</span>
            <strong class="loop-node-name">Improve</strong>
          </div>
        </div>
        <p style="font-size: 7.6px; color: #687987; line-height: 1.3; margin-top: 4px;">
          Luôn bắt đầu từ phiên bản tối giản (MVP). Chạy thử, phát hiện lỗi rồi mới yêu cầu Gemini hoàn thiện từng tính năng.
        </p>
      </div>

      <!-- PROMPT FORMULA -->
      <div class="side-box">
        <h4>CÔNG THỨC PROMPT CHUẨN <span>EIU DNA</span></h4>
        <div class="formula-tag">
          <strong>Mục tiêu</strong> + <strong>Người dùng</strong> + <strong>Dữ liệu</strong> + <strong>Quy trình duyệt</strong> + <strong>Design DNA</strong>
        </div>
        <p style="font-size: 7.5px; color: #687987; line-height: 1.3; margin-top: 3px;">
          Đính kèm file <em>design-dna.txt</em> để AI áp dụng bảng màu Navy 900, viền EIU Gold và typography Inter.
        </p>
      </div>

      <!-- DELIVERABLES -->
      <div class="side-box">
        <h4>KẾT QUẢ LAB 1 THU ĐƯỢC <span>DELIVERABLES</span></h4>
        <div class="deliver-grid">
          <div class="deliver-item"><span class="deliver-check">✓</span> Business Web App</div>
          <div class="deliver-item"><span class="deliver-check">✓</span> Google Sheets Database</div>
          <div class="deliver-item"><span class="deliver-check">✓</span> Dashboard chuẩn EIU</div>
          <div class="deliver-item"><span class="deliver-check">✓</span> URL Web App chia sẻ</div>
          <div class="deliver-item"><span class="deliver-check">✓</span> Source Code hoàn chỉnh</div>
          <div class="deliver-item"><span class="deliver-check">✓</span> Kỹ năng làm chủ AI</div>
        </div>
      </div>

    </div>

  </div>

  <!-- KEY TAKEAWAY FOOTER BANNER -->
  <div class="takeaway-banner">
    <div class="takeaway-left">
      <span class="takeaway-badge">ĐIỀU QUAN TRỌNG NHẤT</span>
      <span class="takeaway-quote">Không phải Prompt. Không phải Code. Mà là <strong>khả năng mô tả đúng bài toán</strong>.</span>
    </div>
  </div>

  <!-- FOOTER -->
  <footer class="footer">
    <div>EIU BA Hub — Applied Agentic AI | Section 1</div>
    <div class="footer-gold">ONE-PAGE HANDOUT · EIU DESIGN DNA COMPLIANT</div>
  </footer>

</body>
</html>
`;

const outputPathHtml = path.join(__dirname, '../tmp/handout-s1.html');
fs.writeFileSync(outputPathHtml, htmlContent, 'utf8');
console.log('Saved HTML to', outputPathHtml);

const pdfDest = path.join(__dirname, '../public/downloads/eiu-applied-agentic-ai-section-1-handout.pdf');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const cmd = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfDest}" "${outputPathHtml}"`;
console.log('Generating PDF via Edge...');
execSync(cmd);
console.log('Successfully generated PDF at', pdfDest);
