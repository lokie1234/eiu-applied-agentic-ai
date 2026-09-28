# Supabase backend cho interactive slides

Backend tương tác không còn dùng Google Apps Script. Next.js API routes là lớp duy nhất được phép đọc/ghi dữ liệu; trình duyệt chỉ dùng Supabase Realtime để nhận tín hiệu thay đổi không chứa dữ liệu nhạy cảm.

## 1. Tạo database

Trong Supabase Dashboard, mở **SQL Editor**, tạo query mới và chạy toàn bộ file:

`supabase/migrations/202609230001_interactive_backend.sql`

Migration tạo các bảng `ideas`, `showcase_items`, `quiz_results`, `feedback`, `section_state`, `presence_sessions`, bật RLS và cài trigger Realtime.

Nếu project Supabase đã chạy migration gốc trước ngày 23/09/2026, chạy thêm file nâng cấp:

`supabase/migrations/202609230002_quiz_control.sql`

Sau đó chạy:

`supabase/migrations/202609230003_terminate_slide_session.sql`

Hai migration bổ sung trạng thái đóng/mở Quiz, tín hiệu Realtime và mốc phiên dùng để làm trống dữ liệu hiển thị trên slide khi terminate mà không xóa dữ liệu Supabase.

### Private Knowledge AI

Với module AI Admin, chạy lần lượt các migration sau trong SQL Editor:

1. `supabase/migrations/202609250001_ai_knowledge.sql`
2. `supabase/migrations/202609250002_add_folder.sql`
3. `supabase/migrations/202609280001_ai_fast_retrieval.sql`
4. `supabase/migrations/202609280002_ai_folder_scope.sql`
5. `supabase/migrations/202609280003_ai_subfolders.sql`
6. `supabase/migrations/202609280004_ai_document_only_scope.sql`
7. `supabase/migrations/202609280005_ai_scope_rename.sql`
8. `supabase/migrations/202609280006_ai_word_documents.sql`

Các migration cuối bật `pgvector`, lưu các đoạn tài liệu/embeddings, cache câu trả lời trong 24 giờ, khóa retrieval theo folder/folder nhỏ được chọn trong cửa sổ chat và chỉ truy xuất PDF/TXT/MD. Nếu chưa chạy các migration này, ứng dụng vẫn hoạt động bằng Gemini File Search nhưng câu hỏi mới sẽ chậm hơn. Các PDF cũ cần được upload lại một lần để tạo local vector index; PDF upload sau migration sẽ được trích xuất và lập chỉ mục tự động.

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
3. Từ admin, terminate Section đang mở; learner phải trở về trang đăng nhập, Quiz phải đóng và dữ liệu interactive/ý tưởng/Shared Space cũ không còn xuất hiện trên slide.
4. Mở slide Quiz ở admin và learner; learner phải thấy màn hình chờ cho đến khi admin xác nhận **Mở Quiz!!!!**.
5. Hoàn thành Quiz bằng learner; tên học viên phải tự xuất hiện trên màn hình admin.
6. Ở màn hình admin chọn Section, bấm **Xuất report Excel** và kiểm tra các sheet Tổng quan, Ý tưởng, Showcase, Quiz, Quiz answers, Feedback, Presence.

## 4. Dữ liệu cũ

Migration không tự đọc Google Sheets. Trước khi gỡ deployment Apps Script cũ, xuất từng tab Google Sheets thành CSV rồi import vào bảng tương ứng trong Supabase Table Editor. Giữ đúng tên cột snake_case trong migration. Khi đã xác nhận số dòng, có thể xóa deployment Apps Script và hai biến môi trường cũ.
