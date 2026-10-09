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
<html lang="vi"><head><meta charset="utf-8"><title>EIU · Section 2 Handout</title><style>
@page { size:A4 portrait; margin:0; }
* { box-sizing:border-box; }
html,body { margin:0; width:210mm; height:297mm; }
body { padding:8mm 10mm; background:#fbfaf7; color:#17324a; font-family:"Segoe UI",Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { height:281mm; display:grid; grid-template-rows:30mm 65mm 114mm 50mm 6mm; gap:4mm; }
h1,h2,h3,p { margin:0; }
.hero { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:space-between; padding:5mm 7mm; border-radius:5mm; background:linear-gradient(115deg,#041c31,#123f68); color:white; }
.hero::after { content:""; position:absolute; right:-10mm; top:-18mm; width:65mm; height:65mm; border:1px solid #e9ca8b44; border-radius:50%; }
.hero img { width:28mm; height:28mm; object-fit:contain; position:relative; z-index:1; }
.eyebrow { font-size:7pt; letter-spacing:1.4pt; color:#e9ca8b; font-weight:800; }
h1 { font-size:22pt; letter-spacing:-.5pt; line-height:1.1; margin:2mm 0; }
.hero p { font-size:8.5pt; color:#d6e3ee; }
.concepts { display:grid; grid-template-columns:1fr 1fr 1fr; gap:3mm; }
.concept { min-height:0; border:1px solid #ddd4c4; border-radius:4mm; padding:3mm; background:white; }
.concept h2 { font-size:12pt; color:#082945; margin:1mm 0 2.5mm; }
.tag { display:block; color:#9d7944; font-size:7pt; letter-spacing:.8pt; font-weight:800; }
.concept p,.concept li { font-size:8.5pt; line-height:1.45; }
.chips { display:flex; flex-wrap:wrap; gap:1.2mm; margin:2.5mm 0; }
.chips span { font-size:7.2pt; padding:1mm 1.8mm; border-radius:2mm; background:#eee6d8; color:#082945; font-weight:650; }
.small { font-size:7.8pt !important; color:#687987; }
.dark { background:linear-gradient(135deg,#123f68,#082945); border-color:#123f68; color:white; }
.dark h2,.dark b { color:white; }
.dark .tag { color:#e9ca8b; }
.parts { display:grid; gap:1.2mm; margin-top:2mm; }
.parts div { padding:1mm 2mm; background:#ffffff0d; border:1px solid #ffffff20; border-radius:2mm; font-size:8pt; line-height:1.35; }
.parts b { display:block; color:#e9ca8b; font-size:8.2pt; margin-bottom:.3mm; }
.workshop { display:grid; grid-template-columns:1.12fr .88fr; gap:4mm; padding:4.5mm; border:1px solid #d6c6a8; border-radius:4mm; background:#f3eee4; }
.workshop h2 { font-size:13pt; color:#082945; margin:1mm 0 2mm; }
.workshop .lead { font-size:8.2pt; line-height:1.4; color:#687987; margin-bottom:3mm; }
.steps { display:grid; gap:1.8mm; }
.step { display:grid; grid-template-columns:14mm 1fr; gap:2.3mm; align-items:start; padding:2mm; border:1px solid #ddd4c4; border-radius:2.7mm; background:#fff; }
.step > b { padding:1.2mm .7mm; background:#082945; color:#e9ca8b; border-radius:1.6mm; font-size:7.2pt; text-align:center; white-space:nowrap; }
.step h3 { font-size:9pt; margin-bottom:1mm; color:#082945; }
.step p { font-size:8pt; line-height:1.38; }
.notice { margin-top:2.4mm; padding:2mm 2.5mm; border-left:1mm solid #b39159; background:#e8dcc4; font-size:8pt; font-weight:700; line-height:1.4; }
.example { padding:3.8mm; border-radius:3mm; background:#082945; color:#eef4f7; }
.example h3 { font-size:12pt; color:#e9ca8b; margin:1.2mm 0 2.5mm; }
.example .tag { color:#e9ca8b; }
pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font:7.7pt/1.35 Consolas,"Courier New",monospace; }
.example .naming { margin-top:3mm; border-top:1px solid #ffffff22; padding-top:2.5mm; font-size:8pt; line-height:1.45; color:#d8e4ee; }
.extras { display:grid; grid-template-columns:1fr 1fr; gap:4mm; }
.extra { border:1px solid #ddd4c4; border-radius:4mm; padding:3mm; background:#fff; }
.extra h2 { font-size:12pt; margin:1mm 0 2mm; color:#082945; }
.extra p { font-size:8.4pt; line-height:1.35; }
.plans { display:grid; grid-template-columns:1fr 1fr; gap:2mm; margin:2mm 0; }
.plans div { padding:1.8mm; border-radius:2mm; background:#f3eee4; font-size:8pt; line-height:1.35; }
.plans strong { display:block; margin-bottom:1mm; color:#9d7944; }
.pipeline { display:flex; justify-content:space-between; align-items:center; gap:1.5mm; margin:2.5mm 0; padding:2mm; border-radius:2mm; background:#082945; color:white; font-size:7.8pt; font-weight:700; }
.pipeline i { color:#e9ca8b; font-style:normal; }
.outcomes { display:grid; gap:1mm; margin:2mm 0 0; padding:0; list-style:none; font-size:8.2pt; line-height:1.4; }
.outcomes li::before { content:"✓"; color:#9d7944; margin-right:1.5mm; font-weight:800; }
footer { display:flex; justify-content:space-between; align-items:center; border-top:1px solid #d6c6a8; color:#687987; font-size:7pt; }
footer strong { color:#9d7944; font-weight:800; }
</style></head><body><main class="page">
<header class="hero"><div><div class="eyebrow">EIU · APPLIED AGENTIC AI · SECTION 2</div><h1>AI Business Framework<br>& Gemini SKILLS</h1><p>Một bộ tiêu chuẩn tái sử dụng để tạo nhiều Web App.</p></div><img src="data:image/png;base64,${logo}" alt="EIU"></header>
<section class="concepts">
<article class="concept"><span class="tag">XÁC ĐỊNH BÀI TOÁN</span><h2>Requirement</h2><p>Mô tả được cách hệ thống vận hành và các tiêu chí kiểm thử.</p><div class="chips"><span>Mục tiêu</span><span>Người dùng</span><span>Dữ liệu</span><span>Workflow</span><span>Quy tắc</span><span>Báo cáo</span></div><p class="small">Ví dụ: Không nộp được form khi thiếu trường bắt buộc; dữ liệu và Dashboard cập nhật đúng sau khi nộp.</p></article>
<article class="concept"><span class="tag">TÁCH CHUẨN DÙNG CHUNG</span><h2>AI Framework</h2><p><b>Dùng chung:</b> kiến trúc, UI, mã nguồn, dữ liệu, bảo mật, kiểm thử và triển khai.</p><p style="margin-top:2mm"><b>Thay đổi theo app:</b> nghiệp vụ, vai trò, trường dữ liệu, workflow và chỉ số.</p><div class="chips"><span>Persona</span><span>Task</span><span>Context</span><span>Format</span></div></article>
<article class="concept dark"><span class="tag">ĐÓNG GÓI CÁCH LÀM</span><h2>Bên trong SKILL</h2><p>Gemini tự áp dụng hướng dẫn phù hợp, hoặc bạn gọi bằng <b>/</b>.</p><div class="parts"><div><b>NAME</b>Tên dạng kebab-case.</div><div><b>DESCRIPTION</b>Mục đích và khi nào sử dụng.</div><div><b>INSTRUCTIONS</b>Quy trình, quy tắc và đầu ra.</div></div></article>
</section>
<section class="workshop">
<div><span class="tag">LAB 2 · QUẢN LÝ NGHỈ PHÉP + BÁO CÁO SỰ CỐ</span><h2>Từ ứng dụng mẫu đến SKILL</h2><p class="lead">Bộ thực hành: Gemini-Prompt.txt, App-01-Source.txt và App-02-Source.txt.</p><div class="steps">
<article class="step"><b>Bước 1</b><div><h3>Phân tích, tách Framework, tạo SKILL</h3><p>Đưa 3 file vào Gemini, dùng Copy Prompt để rút ra chuẩn chung của hai app. Emergency có một file SKILL.md.</p></div></article>
<article class="step"><b>Bước 2</b><div><h3>Cài đặt SKILL</h3><p>Mở Gemini SKILLS → Upload. Tải file SKILL.md vào khung, kiểm tra nội dung rồi chọn Create.</p></div></article>
<article class="step"><b>Bước 3</b><div><h3>Kiểm tra</h3><p>Dùng “Tạo app để…” với yêu cầu mới, như đặt phòng họp. Kiểm tra kết quả theo tiêu chí đã xác định.</p></div></article>
<article class="step"><b>Bước 4</b><div><h3>Lưu và chia sẻ</h3><p>Kiểm tra rồi Create → tải và chia sẻ SKILL.md → mở chat và gọi SKILL bằng /.</p></div></article>
</div><div class="notice">Lưu ý: Phải làm theo đúng hướng dẫn mà Gemini đưa ra!</div></div>
<aside class="example"><span class="tag">MẪU CẤU TRÚC FILE</span><h3>SKILL.md</h3><pre>---
name: business-internal-web-app-builder
description: Tạo ứng dụng web nội bộ doanh nghiệp.
---

# Instructions

## Role
Chuyên gia Google Apps Script
và Google Sheets.

## Workflow
1. Phân tích yêu cầu.
2. Thiết kế dữ liệu.
3. Xây dựng ứng dụng.
4. Kiểm tra và hướng dẫn triển khai.</pre><p class="naming"><b>kebab-case:</b> chữ thường, nối các từ bằng dấu gạch nối; không dùng dấu cách hoặc dấu tiếng Việt.<br>Ví dụ: leave-request-manager</p></aside>
</section>
<section class="extras">
<article class="extra"><span class="tag">LƯU Ý KHI UPLOAD</span><h2>Quy tắc thay đổi theo gói AI</h2><div class="plans"><div><strong>Free tier</strong>Tải một file SKILL.md.</div><div><strong>Google AI Pro</strong>Thêm tài liệu tham khảo: ảnh, PDF và các định dạng khác.</div></div><p>Kiểm tra yêu cầu trong cửa sổ Upload. Nếu tải thư mục, đặt SKILL.md ở cấp gốc; tên bên trong file dùng kebab-case.</p></article>
<article class="extra"><span class="tag">THỰC HÀNH NÂNG CAO</span><h2>Dynamic Sheet Dashboard</h2><p>Đọc Excel/CSV mẫu, nhận diện cấu trúc và hỏi về bộ lọc trước khi sinh code. File SKILL.md có tại slide 36.</p><div class="pipeline"><span>Google Sheet</span><i>→</i><span>Apps Script</span><i>→</i><span>Web App</span></div><ul class="outcomes"><li>KPI, biểu đồ, filter, phân trang và xuất CSV/Excel.</li><li>Code.gs + Index.html và hướng dẫn triển khai.</li></ul></article>
</section>
<footer><span>EIU BA Hub · Applied Agentic AI</span><strong>SECTION 2 · HANDOUT 1 TRANG</strong></footer>
</main></body></html>`;
fs.writeFileSync(htmlPath, html, "utf8");
execFileSync(edgePath, ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`, htmlPath], { stdio: "inherit" });
console.log(`Generated ${pdfPath}`);
