# AI-Powered Web Development

Section 1 có **29 slide**, kết thúc ở slide **Chia sẻ bài làm với giảng viên**. Section 2 giữ nguyên nội dung.

Nguồn hiển thị và tải xuống là `Section1.js` / `Section2.js`, được đăng ký bằng course/section ID trong `course-content/sources.json`. API kiểm tra quyền trước khi phục vụ nguyên byte JS; không cần upload Drive.

Chỉnh nội dung trong `storyboard.json` và giao diện trong `renderer.tsx.txt`, rồi chạy `node scripts/build-web-app-course.cjs`. Không khôi phục các file Section TSX.

- `assets.json`: logo dùng chung được nhúng trong JS.
- `ai-logos.json`: nguồn logo các công cụ AI đang sử dụng.
- `fonts/`: Inter nhúng cùng giấy phép; WOFF2 dùng cho hiển thị.
- `images/vscode-workspace.png`: ảnh minh họa các vùng của VS Code.
- `DESIGN.md`: quy tắc EIU kem–navy–vàng, typography và tương tác.
- `GIT_GUIDE.md`: ghi chú hướng dẫn Git và nguồn tài liệu.

Slide 29 tái sử dụng bảng chia sẻ của khóa Applied Agentic AI. Viewer hiển thị form có xác thực, lấy danh tính từ phiên server và lưu bài với đúng course/section trong Supabase. Export hỗ trợ bộ lọc khóa học và section.

Kiểm tra render: `node scripts/audit-web-app-course.cjs`. Kiểm tra luồng nộp bài và export: `node --test tests/course-showcase-report.test.mjs tests/section-content.test.mjs`.
