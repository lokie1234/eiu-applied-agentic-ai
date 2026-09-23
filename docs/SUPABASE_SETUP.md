# Supabase backend cho interactive slides

Backend tương tác không còn dùng Google Apps Script. Next.js API routes là lớp duy nhất được phép đọc/ghi dữ liệu; trình duyệt chỉ dùng Supabase Realtime để nhận tín hiệu thay đổi không chứa dữ liệu nhạy cảm.

## 1. Tạo database

Trong Supabase Dashboard, mở **SQL Editor**, tạo query mới và chạy toàn bộ file:

`supabase/migrations/202609230001_interactive_backend.sql`

Migration tạo các bảng `ideas`, `showcase_items`, `quiz_results`, `feedback`, `section_state`, `presence_sessions`, bật RLS và cài trigger Realtime.

Trong **Realtime Settings**, giữ **Allow public access to channels** ở trạng thái bật. Các public channel trong project này chỉ mang tín hiệu “dữ liệu đã đổi”; payload không chứa quiz, email hay feedback. Dữ liệu thật vẫn chỉ được trả qua API có kiểm tra role.

## 2. Cấu hình local và Vercel

Thêm các biến sau vào `.env.local` và Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

- Publishable key được dùng ở trình duyệt để nghe tín hiệu Realtime công khai.
- Secret key chỉ được dùng trong Next.js server routes. Tuyệt đối không đặt key này vào biến `NEXT_PUBLIC_*`.
- Nếu project cũ chưa có key định dạng mới, có thể dùng `NEXT_PUBLIC_SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` thay thế.

Sau khi cập nhật biến môi trường, redeploy Vercel.

## 3. Kiểm tra

1. Đăng nhập Section 1 và gửi một ý tưởng.
2. Mở admin ở tab khác; dashboard ý tưởng phải tự cập nhật mà không chờ polling 4 giây.
3. Từ admin, terminate Section đang mở; learner phải trở về trang đăng nhập.
4. Ở màn hình admin chọn Section, bấm **Xuất report Excel** và kiểm tra các sheet Tổng quan, Ý tưởng, Showcase, Quiz, Quiz answers, Feedback, Presence.

## 4. Dữ liệu cũ

Migration không tự đọc Google Sheets. Trước khi gỡ deployment Apps Script cũ, xuất từng tab Google Sheets thành CSV rồi import vào bảng tương ứng trong Supabase Table Editor. Giữ đúng tên cột snake_case trong migration. Khi đã xác nhận số dòng, có thể xóa deployment Apps Script và hai biến môi trường cũ.
