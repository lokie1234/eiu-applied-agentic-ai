# EIU Admin Terminate Users Fix Patch

Patch sửa đúng lỗi admin bị chuyển ra ngoài nhưng user đang học không bị logout.

## Nguyên nhân

Logic cũ chỉ ghi `localStorage` trên máy admin rồi gọi `setAdminSection(null)`. `localStorage` không thể truyền lệnh sang trình duyệt hoặc thiết bị của user khác.

## Logic mới

- Admin gửi lệnh terminate cho đúng Section qua `/api/section-control`.
- Apps Script giữ một termination token dùng chung cho từng Section bằng Script Properties; không tạo thêm Sheet và không sửa dữ liệu Excel.
- User đang mở Section kiểm tra token mỗi 2 giây.
- Khi token thay đổi, chỉ user của Section đó bị xóa session và trở về `/login`.
- Admin vẫn đứng nguyên tại Section hiện tại và nhận thông báo đã gửi lệnh thành công.

## Áp dụng patch

1. Giải nén `EIU_Admin_Terminate_Users_Fix_Patch.zip`.
2. Kéo các folder `components`, `app`, `lib`, `docs` vào thư mục gốc project.
3. Chọn **Replace files in the destination**.

## Cập nhật Apps Script bắt buộc

1. Mở `docs/Code.gs` trong patch.
2. Sao chép toàn bộ và đè vào `Code.gs` đang chạy.
3. Nhấn **Lưu**.
4. Chọn **Triển khai → Quản lý các hoạt động triển khai**.
5. Nhấn biểu tượng bút chì → **Phiên bản mới** → **Triển khai**.
6. Giữ **Thực thi với tư cách: Tôi** và **Ai có quyền truy cập: Bất kỳ ai**.

## Cách test đúng

1. Cửa sổ thường: đăng nhập admin `1103`, chọn Section 1.
2. Cửa sổ ẩn danh hoặc trình duyệt khác: đăng nhập user `9999`.
3. Admin bấm `Terminate Section` và xác nhận.
4. Admin phải đứng nguyên; user `9999` trở về login trong khoảng 2 giây.
5. Thử tương tự với Section 2 bằng user `8888`.

Patch giữ nguyên luồng chia sẻ link và gửi kết quả Google Sheets đang hoạt động, Quiz gate `7879` và toàn bộ nội dung slide.
