# AI-Powered Web Development

Section 1 có **30 slide cho admin/teacher, 29 slide cho học viên**. Slide 28 thực hành chỉ hiển thị cho vai trò giảng dạy, cho chọn thời lượng 1–45 phút (mặc định 15 phút). Slide 29 “Chia sẻ bài làm với giảng viên” chứa popup “Hướng dẫn” với đầy đủ nội dung, icon và cách dừng chia sẻ localhost. Quiz 10 câu nằm ở slide 30 (slide 29 của học viên). Admin hoặc teacher của đúng section mở quiz; điểm và feedback được lưu theo phiên học. Section 2 giữ nguyên nội dung.

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

Slide chia sẻ bài làm (29 cho admin, 28 cho học viên) tái sử dụng bảng chia sẻ của khóa Applied Agentic AI. Viewer hiển thị form có xác thực, lấy danh tính từ phiên server và lưu bài với đúng course/section trong Supabase. Export hỗ trợ bộ lọc khóa học và section.

`renderer.tsx.txt` là renderer chính thức của Section 1; `renderer.section2.tsx.txt` giữ riêng renderer Section 2. Không giữ bản renderer dự phòng Section 1. Build loại bỏ các nhánh, CSS và tài nguyên không dùng trước khi ghi JS. Khi đến slide chia sẻ bài làm, viewer tải trước module quiz mà chưa mở quiz hoặc đăng ký thêm subscription. Quiz đang đóng kiểm tra dự phòng mỗi 2 giây khi tab đang hiển thị; khi mở, nhịp cập nhật trở lại 8 giây. Mỗi request vẫn xác thực quyền và phiên hiện tại.

Section 2 đã nhập bản thay thế mới nhất từ Drive vào storyboard và renderer local (22 slide). Slide 6 mở ba popup; mục thứ ba là “Lấy đúng URL và khóa”, dùng minh họa Connect bằng HTML/CSS. Bản Drive cũ đã được đưa vào thùng rác và section dùng lại binding local trong `sources.json`.

Nhập lesson JS từ Drive hoặc PC giờ lưu nguyên byte vào `course-content/imported/<courseId>/<sectionId>/<importId>.js` trước khi cập nhật binding `local:` trong database. Đây là file để chỉnh sửa trực tiếp cho những bài nhập sau này; hiển thị, download và export đều đọc cùng bản local, không phụ thuộc Drive. Mỗi lần nhập tạo file riêng để cập nhật đồng thời không ghi đè bài đang dùng. PDF/PPTX vẫn dùng Drive; export là thao tác riêng và không chuyển lesson local trở lại Drive. Server chạy luồng nhập phải có quyền ghi vào thư mục dự án; đưa các nguồn local vào bản triển khai khi deploy.

Kiểm tra render: `node scripts/audit-web-app-course.cjs`. Kiểm tra luồng nộp bài và export: `node --test tests/course-showcase-report.test.mjs tests/section-content.test.mjs`.
