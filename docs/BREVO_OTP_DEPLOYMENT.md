# Triển khai Email OTP với Brevo và Supabase Custom SMTP

Kiến trúc cuối cùng:

```text
Trình duyệt gọi Supabase signInWithOtp
  → Supabase tạo OTP
  → Supabase gửi email qua Brevo Custom SMTP
  → Người dùng nhập OTP
  → Supabase xác minh OTP và tạo session
  → Ứng dụng kiểm tra email → course → section
```

Không dùng Google Apps Script, Google OAuth, magic link hay access code chung. Mọi email có đúng đuôi
`@eiu.edu.vn` có thể xác thực; chỉ email được admin cấp section mới xem được nội dung.

Admin được seed sẵn là `son.lam@eiu.edu.vn`.

## Bước 1 — Chạy migration Supabase

Vào Supabase Dashboard → **SQL Editor** và chạy theo thứ tự:

1. `supabase/migrations/202609300001_google_course_access.sql`
2. `supabase/migrations/202609300002_gas_otp_section_access.sql`
3. `supabase/migrations/202609300003_remove_custom_otp_transport.sql`

Tên migration `002` được giữ để không phá lịch sử đã triển khai. File này hiện chỉ tạo quyền theo section
và seed admin; không còn chứa code Google Apps Script.

Nếu trước đây đã chạy migration `001` và `002`, chỉ cần chạy migration `003`. Migration `003` xóa bảng
`otp_request_log` và function `reserve_otp_request` của kiến trúc cũ. Nó không xóa user, khóa học,
section hoặc quyền đã cấp.

## Bước 2 — Tạo tài khoản Brevo Free

1. Mở [Brevo](https://www.brevo.com/) và tạo tài khoản Free.
2. Hoàn tất xác minh tài khoản.
3. Nếu Brevo yêu cầu kích hoạt Transactional Email, hoàn tất biểu mẫu kích hoạt trước khi tiếp tục.

Brevo Free hiện có quota 300 email/ngày. Với 40–50 người, nên giữ nút gửi lại chờ tối thiểu 60 giây để
tránh dùng hết quota do bấm lặp.

## Bước 3 — Tạo sender gửi OTP

Trong Brevo:

1. Vào **Settings → Senders, Domains & Dedicated IPs → Senders**.
2. Chọn **Add a sender**.
3. Sender name: `EIU Applied Agentic AI`.
4. Sender email: dùng một email bạn thực sự kiểm soát.
5. Nhập mã xác minh Brevo gửi tới sender email.

Nếu có quyền quản lý DNS của domain gửi, hãy xác thực domain bằng DKIM/DMARC trong Brevo. Việc này giúp
email ít vào Spam hơn. Không tự nhận là gửi từ `@eiu.edu.vn` nếu chưa được EIU cho phép hoặc chưa xác
thực được domain đó.

## Bước 4 — Tạo Brevo SMTP Key

1. Trong Brevo, vào **Settings → SMTP & API → SMTP**.
2. Copy chính xác **SMTP login**.
3. Chọn **Generate a new SMTP key**.
4. Lưu SMTP key tại nơi an toàn vì Brevo chỉ hiển thị đầy đủ khi tạo.

Phân biệt:

- SMTP host: `smtp-relay.brevo.com`
- SMTP login: giá trị Brevo hiển thị trong tab SMTP
- SMTP password: SMTP key vừa tạo

Không dùng API key, mật khẩu đăng nhập Brevo hoặc `smtp-relay.brevo.com` làm username.

## Bước 5 — Cấu hình Custom SMTP trong Supabase

Vào Supabase Dashboard → **Authentication → Emails → SMTP Settings** và bật Custom SMTP:

```text
Sender email: email sender đã xác minh ở Brevo
Sender name: EIU Applied Agentic AI
Host: smtp-relay.brevo.com
Port: 587
Username: SMTP login từ Brevo
Password: SMTP key từ Brevo
```

Lưu cấu hình. SMTP key chỉ đặt trong Supabase Dashboard, không đặt trong `.env.local`, Vercel hoặc source
code.

## Bước 6 — Đổi email template từ link sang mã OTP

Vào Supabase → **Authentication → Email Templates**. Sửa cả hai template:

1. **Confirm signup** — dùng khi email đăng nhập lần đầu.
2. **Magic Link** — dùng cho các lần đăng nhập tiếp theo.

Subject gợi ý:

```text
{{ .Token }} là mã đăng nhập EIU Applied Agentic AI
```

HTML tối thiểu cho cả hai template:

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px">
  <h2 style="color:#082945">Mã đăng nhập Applied Agentic AI</h2>
  <p>Dùng mã OTP bên dưới để hoàn tất đăng nhập:</p>
  <div style="margin:24px 0;padding:18px;border-radius:14px;background:#f7f4ed;
              color:#082945;font-size:34px;font-weight:800;letter-spacing:9px;text-align:center">
    {{ .Token }}
  </div>
  <p style="color:#7b8994;font-size:13px">
    Mã chỉ dùng một lần. Không chia sẻ mã này cho người khác.
  </p>
</div>
```

Bắt buộc dùng `{{ .Token }}`. Nếu dùng `{{ .ConfirmationURL }}`, email sẽ chứa magic link thay vì mã để
nhập vào giao diện.

Nếu Dashboard có mục OTP length, đặt `6`. Giao diện hiện chấp nhận OTP từ 6 đến 8 chữ số để tương thích
với cấu hình Supabase.

## Bước 7 — Cấu hình Email provider và domain EIU

Trong **Authentication → Sign In / Providers → Email**:

1. Bật Email provider.
2. Cho phép tạo user mới.
3. Không cần bật password login trong giao diện ứng dụng.

Trong **Authentication → Hooks**:

1. Chọn **Before User Created**.
2. Chọn Postgres function.
3. Chọn `public.hook_restrict_signup_to_eiu`.
4. Bật hook.

Hook này ngăn email ngoài `@eiu.edu.vn` tạo Auth identity ngay cả khi gọi trực tiếp Supabase API.

## Bước 8 — Điều chỉnh rate limit

Vào **Authentication → Rate Limits**:

1. Giữ thời gian gửi lại tối thiểu khoảng 60 giây.
2. Đặt tổng email/OTP tối thiểu khoảng 100–150 mỗi giờ cho một lớp 40–50 người.
3. Không đặt cao hơn nhu cầu thực tế vì quota Brevo Free là 300 email/ngày.
4. Có thể bật CAPTCHA sau nếu trang bị bot gửi OTP liên tục.

Ứng dụng không còn giới hạn 30 request/IP/giờ tự viết, nên nhiều học viên dùng chung Wi-Fi EIU sẽ không
bị chặn chỉ vì dùng chung public IP.

## Bước 9 — Biến môi trường local và Vercel

Giữ các biến sau trong `.env.local` và Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_PDF_URL=https://YOUR_PROJECT.supabase.co/storage/v1/object/public/...

# Mã đăng nhập nhanh, chỉ dành cho son.lam@eiu.edu.vn
ADMIN_QUICK_LOGIN_CODE=YOUR_PRIVATE_ADMIN_CODE

# Chỉ khi dùng AI Knowledge
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
# GEMINI_FILE_SEARCH_STORE=...
```

Xóa khỏi cả `.env.local` và Vercel:

```text
GAS_OTP_ENDPOINT
GAS_OTP_SHARED_SECRET
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
ACCESS_CODE
SECTION_1_ACCESS_CODE
SECTION_2_ACCESS_CODE
ADMIN_ACCESS_CODE
QUIZ_ACCESS_CODE
QUIZ_SECTION_2_ACCESS_CODE
ACCESS_SESSION_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_GOOGLE_CLIENT_ID
VERCEL_OIDC_TOKEN
```

Brevo SMTP credentials chỉ nằm trong Supabase. Sau khi xóa biến Vercel, redeploy Production.

`ADMIN_QUICK_LOGIN_CODE` là biến bí mật phía server, không thêm tiền tố `NEXT_PUBLIC_` và không ghi
giá trị thật vào source code. Với đúng email `son.lam@eiu.edu.vn`, giao diện sẽ chuyển thẳng sang bước
nhập mã này mà không gửi email. Các email khác vẫn sử dụng OTP Supabase/Brevo bình thường.

## Bước 10 — Gỡ Google Apps Script cũ

Sau khi Brevo gửi OTP thành công:

1. Mở Apps Script project cũ.
2. Vào **Deploy → Manage deployments**.
3. Archive/remove deployment OTP cũ.
4. Có thể xóa Apps Script project nếu project đó không phục vụ mục đích khác.

Thư mục `google-apps-script` và API `/api/auth/request-otp` đã được xóa khỏi source code.

## Bước 11 — Deploy code

Chạy local:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

Commit và push:

```powershell
git add .
git commit -m "Use Brevo custom SMTP for Supabase email OTP"
git push origin main
```

Chờ Vercel build xong. Build mới không còn route `/api/auth/request-otp` vì browser gọi thẳng Supabase
Auth SDK.

## Bước 12 — Kiểm thử

1. Dùng email ngoài `@eiu.edu.vn`: phải bị từ chối.
2. Dùng một email EIU mới: nhận template **Confirm signup** có mã OTP.
3. Đăng xuất và đăng nhập lại: nhận template **Magic Link** nhưng nội dung vẫn là mã OTP.
4. Nhập sai OTP: bị từ chối.
5. Nhập đúng OTP: tạo Supabase session.
6. Email chưa được cấp section: đăng nhập được nhưng không thấy nội dung.
7. Admin `son.lam@eiu.edu.vn` vào `/admin/access` và bật riêng Section 1 hoặc Section 2.
8. Người dùng refresh và chỉ thấy section đã được bật.
9. Kiểm tra Brevo → **Transactional → Logs** để xác nhận trạng thái Delivered.
10. Kiểm tra Inbox và Spam/Junk của email EIU.

Nếu Supabase báo gửi thành công nhưng không nhận email, kiểm tra theo thứ tự: Brevo Transactional Logs,
sender verification, trạng thái kích hoạt Transactional Email, SMTP key, Spam/Junk và DKIM/DMARC.
