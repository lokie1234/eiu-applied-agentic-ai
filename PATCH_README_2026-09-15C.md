# EIU Applied Agentic AI – Patch 2026-09-15C

## Mục tiêu
Gemini không đọc ổn định file ZIP trong bài Lab, nên 2 project mẫu đã được chuyển thành source bundle UTF-8 `.txt` và Slide 30 được cập nhật để tải trực tiếp 3 file text.

## Files trong patch
- `components/section2/SectionTwoSlide.tsx`
- `public/downloads/Gemini-Prompt.txt`
- `public/downloads/App-01-Source.txt`
- `public/downloads/App-02-Source.txt`

## Slide 30
Nút `Tải bộ 3 file thực hành` bây giờ tải:
1. `Gemini-Prompt.txt`
2. `App-01-Source.txt`
3. `App-02-Source.txt`

Không còn reference đến `App-01-Source.zip` hoặc `App-02-Source.zip` trong Slide 30.

## Hai source bundle mới
Mỗi `.txt` gồm:
- mô tả bundle;
- manifest file;
- phân tách rõ `FILE START / FILE END`;
- toàn bộ source gốc từ `Code.gs/code.gs` và `Index.html`;
- không chứa binary, build cache hoặc secret.

## Gemini-Prompt.txt mới
Prompt được thiết kế để Gemini:
1. đọc toàn bộ 2 source app;
2. reverse-engineer và phân loại `Reusable Core / Optional Pattern / App-Specific`;
3. tạo `Business Internal Web App Builder` Gem;
4. xuất package có thể copy/paste trực tiếp vào Gemini Gems.

Output bắt buộc gồm 9 file:
- `00-GEM-SETUP-GUIDE.txt`
- `01-GEM-NAME.txt`
- `02-GEM-INSTRUCTIONS.txt`
- `KNOWLEDGE-01-AI-BUSINESS-FRAMEWORK.txt`
- `KNOWLEDGE-02-UI-UX-STANDARDS.txt`
- `KNOWLEDGE-03-GAS-SHEETS-ARCHITECTURE.txt`
- `KNOWLEDGE-04-WORKFLOW-VALIDATION-PATTERNS.txt`
- `KNOWLEDGE-05-QUALITY-DEPLOYMENT-CHECKLIST.txt`
- `GEM-TEST-PROMPTS.txt`

`02-GEM-INSTRUCTIONS.txt` được yêu cầu chứa đầy đủ Persona + Task + Context + Format + Guardrails, sẵn để paste vào trường Instructions của Gem.

## Cách áp dụng
Giải nén ZIP này vào root project hiện tại và chọn **Replace / Overwrite**.

Hai file ZIP cũ trong `public/downloads` có thể xóa thủ công nếu muốn dọn project, nhưng Slide 30 không còn sử dụng chúng.
