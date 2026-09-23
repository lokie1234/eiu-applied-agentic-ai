 # EIU Section 2 · Slides 29–32 Download & Motion Patch

Patch này được tạo trên phiên bản Section 2 mới nhất trong chuỗi cập nhật hiện tại.

## Cách cài

1. Giải nén file ZIP.
2. Mở folder `EIU_Section2_Slides_29_32_Download_Motion_Patch`.
3. Kéo hai folder `components` và `public` vào thư mục gốc của project hiện tại.
4. Chọn **Replace / Replace the files in the destination** khi được hỏi.
5. Chạy kiểm tra:

```powershell
npm run build
```

6. Nếu build thành công, push lên GitHub:

```powershell
git add components/section2 public/downloads
git commit -m "Update Section 2 slides 29 to 32"
git push origin main
```

## Nội dung thay đổi

- Slide 29: bốn khung quay đúng hai vòng rồi tự dừng ở bố cục hai hàng, đúng thứ tự 1 → 4.
- Slide 30: thêm một nút tải đồng thời ba file thực hành:
  - `Gemini-Prompt.txt`
  - `App-01-Source.zip`
  - `App-02-Source.zip`
- Slide 30–32: thêm strong motion, hiệu ứng nền và reveal mạnh hơn; không đổi nội dung gốc.
- Bổ sung trạng thái tĩnh cho người dùng bật `prefers-reduced-motion`.

## Kiểm tra nhanh

- Vào slide 29 và chờ animation kết thúc: các khung phải nằm đúng thứ tự 1, 2 ở hàng trên; 3, 4 ở hàng dưới.
- Bấm nút **Tải bộ 3 file thực hành** ở slide 30. Trình duyệt có thể hỏi quyền tải nhiều file; chọn **Allow / Cho phép**.
- Mở slide 31 và 32 để kiểm tra hiệu ứng mạnh và nội dung không bị thay đổi.

## Xác nhận kỹ thuật

- ESLint: đạt.
- Next.js production build: đạt.

# EIU Admin Terminate Users Fix Patch

Patch sửa đúng lỗi admin bị chuyển ra ngoài nhưng user đang học không bị logout.

## Nguyên nhân

Logic cũ chỉ ghi `localStorage` trên máy admin rồi gọi `setAdminSection(null)`. `localStorage` không thể truyền lệnh sang trình duyệt hoặc thiết bị của user khác.

## Logic mới

- Admin gửi lệnh terminate cho đúng Section qua `/api/section-control`.
- Supabase giữ một termination token dùng chung cho từng Section trong bảng `section_state`.
- User đang mở Section nhận tín hiệu Realtime, sau đó xác thực token qua Next.js API.
- Khi token thay đổi, chỉ user của Section đó bị xóa session và trở về `/login`.
- Admin vẫn đứng nguyên tại Section hiện tại và nhận thông báo đã gửi lệnh thành công.

## Áp dụng patch

1. Giải nén `EIU_Admin_Terminate_Users_Fix_Patch.zip`.
2. Kéo các folder `components`, `app`, `lib`, `docs` vào thư mục gốc project.
3. Chọn **Replace files in the destination**.

## Cập nhật Supabase bắt buộc

1. Chạy file `supabase/migrations/202609230001_interactive_backend.sql` trong Supabase SQL Editor.
2. Thêm URL, publishable key và secret key theo `docs/SUPABASE_SETUP.md`.
3. Redeploy Next.js để nhận biến môi trường mới.

## Cách test đúng

1. Cửa sổ thường: đăng nhập admin `1103`, chọn Section 1.
2. Cửa sổ ẩn danh hoặc trình duyệt khác: đăng nhập user `9999`.
3. Admin bấm `Terminate Section` và xác nhận.
4. Admin phải đứng nguyên; user `9999` trở về login ngay sau khi nhận tín hiệu Realtime.
5. Thử tương tự với Section 2 bằng user `8888`.

Patch giữ nguyên luồng chia sẻ link, Quiz gate `7879` và toàn bộ nội dung slide; dữ liệu tương tác được ghi vào Supabase.

