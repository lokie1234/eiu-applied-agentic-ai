# Kết nối Google Sheet với slide 38 và bài kiểm tra

Dữ liệu được ghi trực tiếp vào Google Sheet:

`https://docs.google.com/spreadsheets/d/1j44K3vgiSHrIjPA5l6vYtJ6LzIqzVQok3oLzpWwwGgQ/edit`

Apps Script sẽ tự tạo các trang tính:

- `Bài làm chia sẻ` (và `Bài làm chia sẻ - Section 2`): lưu tên và liên kết sản phẩm.
- `Kết quả bài kiểm tra` (và `Kết quả bài kiểm tra - Section 2`): lưu thời gian, họ tên, email và điểm số.
- `Ý kiến phản hồi` (và `Ý kiến phản hồi - Section 2`): lưu thời gian, section, họ tên, email và nội dung phản hồi của người học.

Quyền truy cập của website:

- Mã `9999`: người học có thể xem bài, làm kiểm tra và chia sẻ ứng dụng.
- Mã `1103`: quản trị viên có thêm nút xóa các bài đã chia sẻ tại slide 38.

## 1. Dán mã vào Apps Script

1. Mở Google Sheet ở đường dẫn trên.
2. Chọn **Tiện ích mở rộng → Apps Script**.
3. Trong danh sách tệp bên trái, mở tệp **`Code.gs`**.
4. Xóa toàn bộ mã cũ trong `Code.gs`.
5. Mở tệp `docs/Code.gs` của dự án, sao chép toàn bộ nội dung rồi dán vào `Code.gs` trên trình duyệt.
6. Không tạo tệp HTML. Bản này chỉ cần đúng một tệp `Code.gs`.
7. Dòng `SPREADSHEET_ID` đã trỏ sẵn đến Google Sheet của khóa học.
8. Giữ `WEBHOOK_SECRET` giống hệt giá trị `GOOGLE_APPS_SCRIPT_SECRET` đã tạo trên Vercel. Không thêm dấu ngoặc kép trong ô giá trị của Vercel.
9. Nhấn **Lưu dự án**.

## 2. Triển khai lại Apps Script

Nếu đã có deployment:

1. Chọn **Triển khai → Quản lý các hoạt động triển khai**.
2. Nhấn biểu tượng bút chì ở deployment đang dùng.
3. Tại **Phiên bản**, chọn **Phiên bản mới**.
4. Kiểu triển khai phải là **Ứng dụng web**.
5. Chọn **Thực thi với tư cách: Tôi**.
6. Chọn **Ai có quyền truy cập: Bất kỳ ai**.
7. Nhấn **Triển khai**. URL kết thúc bằng `/exec` vẫn giữ nguyên.

Nếu chưa có deployment:

1. Chọn **Triển khai → Hoạt động triển khai mới**.
2. Chọn loại **Ứng dụng web**.
3. Chọn **Thực thi với tư cách: Tôi** và **Ai có quyền truy cập: Bất kỳ ai**.
4. Nhấn **Triển khai**, cấp quyền và sao chép URL kết thúc bằng `/exec`.

Không nhấn nút **Chạy** để thử `doGet` hoặc `doPost` trong trình soạn thảo. Hai hàm này nhận dữ liệu từ trang web khi người dùng thao tác.

## 3. Kiểm tra biến trên Vercel

Trong **Vercel → Settings → Environment Variables**, kiểm tra:

```text
ACCESS_CODE=9999
ADMIN_ACCESS_CODE=1103
ACCESS_SESSION_SECRET=chuỗi-bí-mật-dài-của-bạn
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbyg7d4m6Ou5EH3KximcaMFHdNM4vvjSPWXUyYhefWTO2w72gpmKkDWrIz1u2biAukVR/exec
GOOGLE_APPS_SCRIPT_SECRET=CHANGE_ME
```

`GOOGLE_APPS_SCRIPT_SECRET` phải giống chính xác `WEBHOOK_SECRET` trong `Code.gs`. `ACCESS_SESSION_SECRET` phải là một chuỗi riêng đủ dài và không chia sẻ cho người học. Sau khi sửa biến hoặc cập nhật mã nguồn, vào **Deployments** trên Vercel và **Redeploy** bản mới nhất.

## 4. Kiểm tra hoạt động

1. Mở slide 38, nhập tên và một liên kết ứng dụng hợp lệ rồi chia sẻ.
2. Google Sheet phải xuất hiện trang tính `Bài làm chia sẻ` và có một dòng mới.
3. Hoàn thành 10 câu hỏi, nhập họ tên và email EIU rồi gửi kết quả.
4. Kết quả tiếp tục được ghi vào các trang tính cũ; cột `Email` được chèn trước cột `Kết quả` và dữ liệu điểm cũ được giữ nguyên.
4. Google Sheet phải xuất hiện trang tính `Kết quả bài kiểm tra` với điểm dạng `8/10`.
5. Mở `/login`, nhập `1103`, đến slide 38 và kiểm tra nút `Xóa` xuất hiện cạnh từng bài.
6. Mở `/login`, nhập `9999`, đến slide 38 và kiểm tra nút `Xóa` không xuất hiện.

Nếu slide 38 báo Apps Script trả về trang HTML, nguyên nhân là deployment chưa dùng phiên bản mã mới hoặc quyền truy cập chưa đặt thành **Bất kỳ ai**. Thực hiện lại mục 2 rồi redeploy Vercel.
