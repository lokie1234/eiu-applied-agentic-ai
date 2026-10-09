---
name: business-web-app-builder
description: Tự động thiết kế và tạo trọn bộ Web App nội bộ doanh nghiệp chạy trên Google Apps Script và Google Sheets với xác thực, phân quyền, workflow và dashboard.
---

# Instructions: Business Web App Builder

Khi nhận Requirement mới từ người dùng, Skill có nhiệm vụ thiết kế toàn bộ hệ thống và tạo mã nguồn sẵn sàng triển khai.

## Quy Trình Thực Hiện
1. **Phân tích Requirement**:
   - Xác định rõ nghiệp vụ chính, các vai trò (roles) tham gia, quy trình xử lý (workflow), các trường dữ liệu và chỉ số Dashboard cần báo cáo.
2. **Thiết Kế Kiến Trúc**:
   - Áp dụng **REUSABLE CORE** từ phần kiến thức bên dưới để thiết kế Data model (Users, Permissions, Sessions, AuditLogs, Business Sheets), cơ chế RBAC, Validation và UI/UX.
3. **Sinh Mã Nguồn (Code Generation)**:
   - Tạo đúng 2 file code hoàn chỉnh: `Code.gs` và `Index.html`.
   - **`Code.gs`** chứa toàn bộ Backend:
     - `doGet()` để render HTML.
     - `setupDatabase()` khởi tạo tự động các Sheet hệ thống và Sheet nghiệp vụ (Idempotent).
     - Authentication: Login (Verify Hash + Salt), Session Management, Token Verification, Logout.
     - Admin Seed: Tài khoản `EIU8888` / `EIU123` mặc định.
     - User Management: Tạo tài khoản, kích hoạt/vô hiệu hóa, reset mật khẩu, gửi email thông báo tài khoản cho user khi Admin tạo user mới.
     - Role & Permission (RBAC): Kiểm tra quyền backend ở từng API handler dựa trên `module_key` / `content_key`.
     - CRUD operations cho nghiệp vụ.
     - Validation & LockService chống race condition khi ghi dữ liệu.
     - Audit Logs ghi nhận mọi thao tác quan trọng.
     - Error Handling trả về dạng JSON chuẩn `{ status: 'success'|'error', message: string, data: any }`.
   - **`Index.html`** chứa toàn bộ Frontend:
     - Bootstrap 5 responsive UI (CSS, JS Bundle).
     - Single Page Application (SPA) với các Tabs/Views: Login Page, Business UI, Admin Control Panel, Dashboard.
     - Quản lý trạng thái Session Client (Token/LocalStorage/Cookies).
     - Xử lý tương tác backend qua `google.script.run` có trạng thái Loading, Success Toast/Alert, Error Handling.
     - Logout action.
4. **Quy Chuẩn Code**:
   - **KHÔNG** dùng pseudo-code.
   - **KHÔNG** bỏ sót hàm hay viết comment dở dang như `"// code tiếp theo"`.
   - Code phải đầy đủ 100% để copy-paste trực tiếp vào Google Apps Script là chạy được ngay.

5. **Thông Báo Bắt Buộc Trong Mọi Ứng Dụng**:
   Mọi ứng dụng tạo ra đều phải kèm thông báo tài khoản mặc định:
   > **TÀI KHOẢN ADMIN MẶC ĐỊNH**
   > - Tài khoản: `EIU8888`
   > - Mật khẩu: `EIU123`
   > - Khuyến nghị: Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.

---

# Integrated Knowledge Base

## PART 1 — KNOWLEDGE_AI_FRAMEWORK
- **Luồng thiết kế hệ thống**:
  `Requirement` → `Data Model` → `Authentication & User Identity` → `RBAC / Authorization` → `Workflow State Machine` → `Server Validation` → `UI Components` → `Dashboard Analytics` → `Audit Logging` → `Deployment Setup`.
- **Phân định thành phần**:
  - **REUSABLE CORE** (Cố định cho mọi app): Core Auth, Session, AuditLogs, Users, Permissions, Utilities, LockService, Layout/Theme Shell.
  - **OPTIONAL PATTERN**: Filter nâng cao, xuất báo cáo CSV/PDF, Gửi Email thông báo qua `MailApp`.
  - **APP-SPECIFIC**: Các trường dữ liệu nghiệp vụ, các bước phê duyệt cụ thể, giao diện thao tác đặc thù.

## PART 2 — KNOWLEDGE_UI_UX_STANDARD
- **Framework**: Bootstrap 5 CDN (`bootstrap.min.css` & `bootstrap.bundle.min.js`).
- **Responsive**: Hỗ trợ chuẩn trên Mobile, Tablet, Desktop.
- **Navigation**: Navbar header chứa thông tin User đăng nhập, nút Logout và Navigation Tabs (Giao diện chính, Dashboard, Admin Panel).
- **Form UI**: Control rõ ràng, bắt buộc có validation feedback trực quan (HTML5 + JS Custom Validation).
- **Feedback Loop**: Có hiệu ứng Loading (Spinner/Disabled Button) khi bấm gửi, thông báo Toast/Alert rõ ràng khi thành công hoặc lỗi.
- **Dashboard**: Thiết kế theo dạng Stats Cards (Tổng quan số liệu), Bảng tổng hợp (Tables), Bộ lọc (Filters).
- **Phân vùng Admin**: Admin Screen được tách riêng trong Tab hoặc View riêng biệt, chỉ mở khi tài khoản có role `Admin`.

## PART 3 — KNOWLEDGE_AUTH_RBAC_PATTERN
- **System Sheets Schema**:
  - `Users`: `Username`, `PasswordHash`, `Salt`, `FullName`, `Email`, `Role`, `IsActive`, `CreatedAt`, `LastLogin`.
  - `Permissions`: `Role`, `ModuleKey`, `CanView`, `CanCreate`, `CanEdit`, `CanApprove`, `CanDelete`.
  - `Sessions`: `Token`, `Username`, `CreatedAt`, `ExpiresAt`.
  - `AuditLogs`: `LogID`, `Timestamp`, `Username`, `Action`, `Module`, `Details`, `IPAddress`.
- **Admin Seeding**: Tự động tạo tài khoản Admin `EIU8888` với salt + SHA-256 hashed password `EIU123` nếu hệ thống chưa có Admin.
- **Mật khẩu & Mã hóa**: Sử dụng `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt)` để mã hóa.
- **Session**: Tạo UUID Token ngẫu nhiên, lưu thời gian hết hạn (ví dụ: 8 tiếng). Backend verify Token cho mỗi Request.
- **Server Authorization**: Mọi hàm Backend (trừ `login`) đều phải nhận `sessionToken` làm tham số đầu tiên, kiểm tra Token hợp lệ và check quyền tương ứng với `ModuleKey` trước khi thực thi.

## PART 4 — KNOWLEDGE_WORKFLOW_PATTERN
- **Định nghĩa Trạng thái (State Machine)**: Mọi quy trình nghiệp vụ cần xác định rõ các trạng thái (ví dụ: `Mới` → `Đang xử lý` → `Chờ duyệt` → `Đã duyệt` / `Từ chối`).
- **Phân quyền thao tác chuyển trạng thái (State Transition)**:
  - Chỉ Role/Permission hợp lệ mới được thực hiện nút bấm chuyển trạng thái.
  - Việc chuyển trạng thái phải được kiểm tra lại ở Backend (Server-side validation).
- **Lịch sử & Đội vết (Audit Trail)**: Mọi bước chuyển trạng thái đều cập nhật thông tin người thực hiện, thời gian thực hiện vào cột Lịch sử / AuditLogs.

## PART 5 — KNOWLEDGE_GAS_SHEETS_PATTERN
- **Backend Infrastructure**: Google Apps Script + Google Sheets Database.
- **Idempotent Setup**: Hàm `setupDatabase()` kiểm tra sự tồn tại của từng Sheet trước khi khởi tạo headers. Chạy nhiều lần không làm mất hay trùng lặp dữ liệu.
- **Data Transformation**: Chuyển đổi dữ liệu 2D Array từ `sheet.getDataRange().getValues()` thành mảng danh sách Object `[ { colHeader: cellValue } ]` giúp Frontend dễ dàng tiêu thụ.
- **Concurrency Control**: Sử dụng `LockService.getScriptLock()` với thời gian chờ thích hợp (ví dụ: `lock.waitLock(10000)`) khi thực hiện ghi dữ liệu (`appendRow`, `setValue`) để tránh xung đột dữ liệu.
- **Error Handling**: Đóng gói phản hồi trong `try...catch` trả về đối tượng chuẩn, che giấu các thông tin hệ thống nhạy cảm.
- **Quy trình Deployment chuẩn**:
  1. Mở Apps Script Editor.
  2. Dán nội dung vào `Code.gs` và `Index.html`.
  3. Chạy hàm `setupDatabase()` 1 lần duy nhất.
  4. Bấm **Deploy** > **New deployment** > Chọn loại **Web app**.
  5. Thiết lập: *Execute as*: **Me**, *Who has access*: **Anyone** (hoặc nội bộ tổ chức).
  6. Lưu và sao chép **Web App URL**.