# Code cleanup · 2026-10-13

Rà các entry point App Router, import động, module runtime, export, CSS, nguồn slide local, API và tài nguyên được tải theo đường dẫn. Chỉ gỡ phần không còn được dùng; các migration và luồng đọc nội dung đã tải lên vẫn phục vụ dữ liệu hiện có.

## Đã dọn trong đợt này

- Xóa 24 file: nguồn Hairline folder/book/page không còn dùng, nguồn JS trùng ở root, 4 preview HTML cùng 12 ảnh QA của bộ icon cũ, và ZIP snapshot của landing page đã lỗi thời. Giữ kernel/loading-dots đang phục vụ màn hình chờ.
- Gỡ 515 rule CSS global và 73 keyframes không được dùng của login/OTP và interaction overlay PDF cũ. Bỏ thêm 2 keyframes cùng lớp sweep đã bị transition nhẹ ghi đè. Transition hiện tại tiếp tục hỗ trợ reduced motion.
- Renderer Web App bỏ 13 visual cases cũ, 6 helper không còn được gọi, catalog công cụ không còn dùng và tham số marquee dư. Hai TSX được tạo lại từ renderer/storyboard; nội dung giữ 40 + 20 slides và binding course/section hiện tại.
- Admin bỏ 5 hàm gate luôn trả về true, filter không lọc gì và nhánh Read only không thể xuất hiện. Các điều kiện quyền thực sự và kiểm tra API vẫn giữ.
- Bỏ hàm driveStatus dùng danh sách folder cố định nhưng không được gọi; màn hình Drive dùng catalog destinations hiện tại. Gỡ 6 type re-exports không có người dùng và 2 tham số drag không được đọc. Các re-export AI đang được API sử dụng vẫn giữ.
- Thay README/setup chứa hướng dẫn OTP và mã truy cập cố định bằng luồng passcode/Google hiện tại. Cập nhật tài liệu Hairline và kiến trúc theo code thực tế.

## Kiểm tra

- Rà 95 module runtime trong components/lib từ entry points: không còn module không tới được hoặc export thiếu nơi sử dụng trong tập đã kiểm tra.
- TypeScript với noUnusedLocals/noUnusedParameters đạt.
- 170 regression tests đạt; build production đạt.
- Render DOM toàn bộ 60 slides TSX local: không có lỗi runtime. Đây không phải kiểm tra trực quan bằng trình duyệt.
- git diff --check đạt sau dọn whitespace.

Lint runtime vẫn có 18 lỗi hooks ở EiuAgentBot, AdminAccessPortal, AgentWorld3D, GuardianRobot3D và HeroScene, cùng 2 cảnh báo raw image. Đây là các thành phần đang chạy, không phải code chết; không xóa hoặc đổi hành vi 3D để làm lint im lặng. Build vẫn có cảnh báo tracing filesystem của lib/localSectionContent.ts. Không khẳng định lint toàn dự án đã sạch.
