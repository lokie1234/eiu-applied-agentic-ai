# AI-Powered Web Development

Section 1 có **32 slide cho admin/teacher, 31 slide cho học viên**. Sau slide 31 “Chia sẻ bài làm với giảng viên” là quiz 10 câu ở slide 32 (slide 31 của học viên). Admin hoặc teacher của đúng section mở quiz; học viên hoàn thành sẽ được ghi điểm và gửi feedback trong cùng giao diện như Applied Agentic AI. Slide thực hành thiết kế tự do với AI sau slide 20 chỉ hiển thị cho vai trò giảng dạy. Section 2 giữ nguyên nội dung.

Quiz dùng lại `components/QuizSlide.tsx`, bộ câu hỏi tại `lib/webDevelopmentQuiz.ts` và API `/api/sections/[id]/quiz`. Server xác thực quyền, chấm lại đáp án, lưu trạng thái mở/điểm/feedback vào `access_audit_logs` với course ID, section ID và danh tính từ phiên đăng nhập. Dữ liệu được đưa vào báo cáo Excel và reset theo phạm vi section; không dùng chung trạng thái `section1` của Applied Agentic AI và không cần migration database. Viewer nhận marker `data-eiu-quiz` rồi hiển thị quiz có xác thực bên ngoài iframe sandbox; iframe không gọi API.

Nguồn hiển thị và tải xuống là `Section1.js` / `Section2.js`, được đăng ký bằng course/section ID trong `course-content/sources.json`. API kiểm tra quyền trước khi phục vụ nguyên byte JS; không cần upload Drive.

Trong Admin Access Settings, mỗi section có checkbox **Terminate section** (mặc định tắt). Khi bật, admin thấy nút Terminate Section trong phiên học. Kết thúc phiên sẽ đưa người học về màn hình truy cập, đóng quiz, bắt đầu lại lượt quiz/feedback và làm mới bảng chia sẻ cho phiên tiếp theo; lịch sử điểm, feedback và bài nộp vẫn được giữ trong báo cáo. Quyền được lưu theo section ID trong metadata khóa học; server kiểm tra lại quyền và cờ bật/tắt cho mỗi yêu cầu. Chỉ admin được cấu hình và terminate, teacher vẫn có quyền mở quiz. Luồng này dùng chung cho Applied Agentic AI và các section upload; không cần migration database.

Chỉnh nội dung trong `storyboard.json` và giao diện trong `renderer.tsx.txt`, rồi chạy `node scripts/build-web-app-course.cjs`. Không khôi phục các file Section TSX.

Build cũng sinh `manifest.json` cùng revision, số slide cho từng vai trò và dung lượng JS; bộ đếm dùng manifest này để không phải tải/chạy cả hai section trước khi mở bài. Mỗi section chỉ nhúng các tài nguyên còn được renderer và nội dung sử dụng, kể cả tên logo tra cứu động. Cần commit manifest cùng JS sau khi build. Nội dung được tải mới và kiểm tra quyền cho mỗi lần mở; không cache quyền hay nội dung của phiên học viên. Giao diện quiz/bảng chia sẻ tải khi đến đúng slide. Layout EIU mặc định không được tải thêm cho bài đã giữ nguyên thiết kế, còn layout tùy chỉnh vẫn được hỗ trợ.

- `assets.json`: logo dùng chung được nhúng trong JS.
- `ai-logos.json`: nguồn logo các công cụ AI đang sử dụng.
- `fonts/`: Inter nhúng cùng giấy phép; WOFF2 dùng cho hiển thị.
- `images/vscode-workspace.png`: ảnh minh họa các vùng của VS Code.
- `DESIGN.md`: quy tắc EIU kem–navy–vàng, typography và tương tác.
- `GIT_GUIDE.md`: ghi chú hướng dẫn Git và nguồn tài liệu.

Slide cuối (30 cho admin, 29 cho học viên) tái sử dụng bảng chia sẻ của khóa Applied Agentic AI. Viewer hiển thị form có xác thực, lấy danh tính từ phiên server và lưu bài với đúng course/section trong Supabase. Export hỗ trợ bộ lọc khóa học và section.

Kiểm tra render: `node scripts/audit-web-app-course.cjs`. Kiểm tra luồng nộp bài và export: `node --test tests/course-showcase-report.test.mjs tests/section-content.test.mjs`.
