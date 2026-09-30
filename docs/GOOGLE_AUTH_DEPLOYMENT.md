# Triển khai OTP bằng Google Apps Script

Kiến trúc cuối cùng:

```text
Trình duyệt
  → Next.js API kiểm tra @eiu.edu.vn và rate limit
  → Supabase Admin tạo OTP hợp lệ
  → Google Apps Script gửi OTP bằng MailApp
  → Trình duyệt verify OTP với Supabase
  → Supabase tạo session
  → Ứng dụng kiểm tra quyền email → course → section
```

Google Apps Script chỉ vận chuyển email. OTP và session vẫn do Supabase Auth tạo/xác minh. Không dùng
Google OAuth, magic link, Custom SMTP hay mã truy cập chung `9999`/`8888`.

Admin mặc định là `son.lam@eiu.edu.vn`. Admin cũng đăng nhập bằng OTP như người dùng bình thường.

## Bước 1 — Chuẩn bị một shared secret

Tạo một chuỗi ngẫu nhiên dài tối thiểu 32 byte. Ví dụ với OpenSSL:

```powershell
openssl rand -hex 32
```

Lưu tạm chuỗi này ở nơi an toàn. Ở các bước sau, cùng một giá trị phải được đặt ở:

- Google Apps Script: Script Property `GAS_OTP_SHARED_SECRET`.
- Vercel và `.env.local`: Environment Variable `GAS_OTP_SHARED_SECRET`.

Không commit secret vào Git.

## Bước 2 — Chạy migration trên Supabase

Vào Supabase Dashboard → **SQL Editor** → **New query**, chạy hai file theo đúng thứ tự:

1. `supabase/migrations/202609300001_google_course_access.sql`
2. `supabase/migrations/202609300002_gas_otp_section_access.sql`

Migration thứ hai:

- tạo bảng quyền `user_section_access`;
- chuyển các quyền course cũ thành quyền cho mọi section hiện có;
- tạo rate limit OTP phía database;
- seed `son.lam@eiu.edu.vn` thành admin đang hoạt động.

Không cần chạy SQL tạo admin thủ công. Auth user của admin sẽ tự liên kết với dòng đã seed ở lần đăng
nhập OTP đầu tiên.

Nếu migration đầu tiên đã chạy từ trước, vẫn chạy migration thứ hai. Không chạy lặp lại bằng cách sửa
tên file hoặc ghép nội dung hai file.

## Bước 3 — Cấu hình Supabase Auth

Trong Supabase Dashboard:

1. Vào **Authentication → Sign In / Providers → Email**.
2. Bật Email provider và cho phép tạo user mới.
3. Không cần password login.
4. Không cần sửa **Email Templates**.
5. Không cần cấu hình **Custom SMTP**.
6. Có thể tắt Google provider nếu không còn dùng.

Sau đó vào **Authentication → Hooks**:

1. Chọn **Before User Created**.
2. Chọn Postgres function.
3. Chọn `public.hook_restrict_signup_to_eiu`.
4. Bật hook.

Hook là lớp bảo vệ Supabase để chỉ email có đúng domain `@eiu.edu.vn` được tạo identity. API Next.js
cũng kiểm tra domain trước khi tạo OTP.

## Bước 4 — Tạo Google Apps Script gửi OTP

1. Mở [script.google.com](https://script.google.com/) bằng tài khoản Google được phép gửi mail.
2. Chọn **New project** và đặt tên, ví dụ `EIU Course OTP`.
3. Mở file `Code.gs` mặc định, xóa nội dung mẫu.
4. Copy toàn bộ nội dung file `google-apps-script/Code.gs` trong project này và dán vào.
5. Nhấn **Save**.
6. Vào **Project Settings → Script Properties → Add script property**.
7. Đặt Property là `GAS_OTP_SHARED_SECRET`.
8. Đặt Value là shared secret đã tạo ở Bước 1, rồi lưu.

Không ghi secret trực tiếp vào `Code.gs`.

## Bước 5 — Deploy Apps Script thành Web App

Trong project Apps Script:

1. Chọn **Deploy → New deployment**.
2. Ở **Select type**, chọn **Web app**.
3. Description: `Production OTP sender`.
4. **Execute as**: chọn **Me**.
5. **Who has access**: chọn **Anyone**.
6. Chọn **Deploy** và chấp thuận quyền gửi email khi Google yêu cầu.
7. Copy URL kết thúc bằng `/exec`.

Vercel gọi URL này từ server và mọi request phải có chữ ký HMAC hợp lệ. Apps Script còn kiểm tra domain,
timestamp, nonce và định dạng OTP trước khi gửi mail.

Nếu tài khoản Workspace không hiển thị tùy chọn **Anyone**, quản trị viên Google Workspace phải cho phép
deploy Web App công khai. Chọn chế độ bắt đăng nhập Google sẽ không phù hợp vì Vercel không có session
Google để gọi Web App.

Mỗi lần sửa `Code.gs`, vào **Deploy → Manage deployments → Edit → New version → Deploy**. Nếu chỉ sửa
Script Property thì không cần tạo deployment URL mới.

## Bước 6 — Cấu hình local

Trong `.env.local`, giữ/thêm các biến sau:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

GAS_OTP_ENDPOINT=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
GAS_OTP_SHARED_SECRET=THE_SAME_SECRET_AS_APPS_SCRIPT

NEXT_PUBLIC_PDF_URL=https://YOUR_PROJECT.supabase.co/storage/v1/object/public/...
```

Nếu dùng AI Knowledge, giữ thêm:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
# GEMINI_FILE_SEARCH_STORE=...
```

`SUPABASE_SECRET_KEY` và `GAS_OTP_SHARED_SECRET` là biến server-only. Tuyệt đối không đổi tên thành biến
bắt đầu bằng `NEXT_PUBLIC_`.

Khởi động lại dev server sau khi sửa `.env.local`:

```powershell
npm.cmd install
npm.cmd run dev
```

## Bước 7 — Cấu hình Vercel

Vào Vercel project → **Settings → Environment Variables**, thêm các biến giống Bước 6:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `GAS_OTP_ENDPOINT`
- `GAS_OTP_SHARED_SECRET`
- `NEXT_PUBLIC_PDF_URL`
- các biến `GEMINI_*` nếu sử dụng AI Knowledge

Áp dụng cho **Production**; có thể áp dụng thêm Preview/Development nếu cần thử trên các môi trường đó.
Sau khi lưu, vào **Deployments → Redeploy** bản mới nhất. Việc chỉ sửa Environment Variables không tự
cập nhật deployment đang chạy.

## Bước 8 — Xóa cấu hình cũ

Xóa khỏi cả `.env.local` và Vercel nếu còn tồn tại:

```text
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
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
VERCEL_OIDC_TOKEN
```

Không xóa ba biến Supabase, vì ứng dụng vẫn dùng Supabase để tạo OTP, xác minh OTP, tạo session và quản
lý quyền. Không cần cấu hình Send Email Hook của Supabase cho kiến trúc này.

Nếu trước đó đã cấu hình Custom SMTP trong Supabase chỉ để phục vụ OTP của ứng dụng này, có thể tắt nó.
Hãy giữ lại nếu project Supabase còn dùng SMTP cho luồng email khác như reset password.

## Bước 9 — Cấp quyền trong giao diện admin

1. Mở trang `/login`.
2. Nhập `son.lam@eiu.edu.vn` và nhận OTP từ Apps Script.
3. Nhập OTP để đăng nhập.
4. Mở `/admin/access` hoặc nhấn **Quản lý quyền**.
5. Tab **Phân quyền email**:
   - thêm email EIU;
   - bật/tắt từng section cho email đó;
   - xóa email để thu hồi toàn bộ quyền ứng dụng.
6. Tab **Khóa học & Section**:
   - tạo tên khóa học;
   - thêm section vào từng khóa học;
   - xóa section tùy chỉnh;
   - xóa khóa học tùy chỉnh.

`Applied Agentic AI`, `Section 1` và `Section 2` đang gắn với nội dung code hiện tại nên giao diện không
cho xóa. Các khóa học/section tạo mới đã sẵn sàng cho phân quyền metadata; để học viên xem nội dung thật
của chúng, cần bổ sung trang/deck tương ứng trong code.

Mọi email đúng `@eiu.edu.vn` đều có thể nhận OTP và đăng nhập. Email chưa được thêm/cấp section chỉ thấy
thông báo chưa có quyền. Người dùng chỉ nhìn thấy Section 1 hoặc Section 2 mà admin đã bật cho họ.

## Bước 10 — Kiểm tra trước khi mở lớp

Chạy kiểm tra code:

```powershell
npm.cmd run lint
npm.cmd run build
```

Kiểm thử theo thứ tự:

1. Email ngoài `@eiu.edu.vn` bị từ chối trước khi gửi OTP.
2. Email EIU nhận email có mã 6 số, không phải magic link.
3. Nhập sai OTP bị từ chối; nhập đúng OTP tạo session.
4. Email chưa cấp quyền đăng nhập được nhưng không thấy khóa học.
5. Admin thêm một email, chỉ bật Section 1: email đó chỉ thấy Section 1.
6. Admin bật thêm Section 2: email đó thấy cả hai section.
7. Admin tắt Section 1: request mở Section 1 tiếp theo bị từ chối.
8. Admin xóa email: toàn bộ quyền section của email bị xóa theo.
9. Admin tạo course/section tùy chỉnh và thấy chúng xuất hiện ở bảng phân quyền.

## Giới hạn gửi mail

Email được gửi từ tài khoản sở hữu Apps Script và chịu quota của `MailApp`. Với lớp khoảng 40–50 người,
luồng này thường phù hợp nếu mỗi người không liên tục xin gửi lại mã. Ứng dụng đã giới hạn:

- tối thiểu 60 giây giữa hai lần gửi cho cùng email;
- tối đa 6 yêu cầu/email/giờ;
- tối đa 30 yêu cầu/IP/giờ.

Theo dõi **Apps Script → Executions** nếu người dùng báo không nhận được mail. Kiểm tra thêm Spam/Junk và
quota gửi còn lại của tài khoản Apps Script.
