# Dự án Website Mẫu Lumi Studio · Hướng Dẫn Dành Cho AI Agent

Tài liệu này cung cấp toàn bộ bối cảnh, kiến trúc mã nguồn và lộ trình mở rộng để AI Agents (Antigravity, Codex, Claude, ChatGPT...) tự động đọc hiểu, định hình luồng làm việc và hỗ trợ người dùng từ **Section 1 (Local Dev & Git)** đến **Section 2 (Supabase & Vercel)**.

---

## 1. Bối cảnh dự án & Kiến trúc hiện tại (Section 1)

- **Mục tiêu**: Website giới thiệu dịch vụ sáng tạo Lumi Studio (quảng cáo, branding, web app).
- **Công nghệ nền tảng**: Next.js App Router (JavaScript / React thuần), CSS thuần trong `app/globals.css`, không phụ thuộc thư viện UI nặng.
- **Cấu trúc thư mục**:
  ```text
  eiu-advertising-starter/
  ├── app/
  │   ├── globals.css          # Toàn bộ stylesheet và biến màu sắc EIU
  │   ├── layout.js            # Khung layout chuẩn Next.js
  │   └── page.js              # Trang chủ hiển thị MarketingSite
  ├── components/
  │   └── MarketingSite.js     # Giao diện chính: Header, Hero, Plans, Form modal, FAQ
  ├── data/
  │   └── site.js              # Dữ liệu nội dung (kế hoạch, dịch vụ, câu hỏi thường gặp)
  ├── lib/
  │   └── registrations.mjs    # Xử lý đăng ký form (lưu trữ cục bộ cho Section 1)
  ├── tests/
  │   └── registrations.test.mjs # Unit test kiểm tra logic đăng ký
  ├── AGENTS.md                # Tài liệu định hướng và lộ trình cho AI Agent (file này)
  ├── package.json             # Cấu hình scripts dev, build, test
  └── README.md                # Hướng dẫn thực hành dành cho học viên
  ```
- **Quy trình làm việc ở Section 1**:
  1. Mở và chỉnh sửa mã nguồn trong **VS Code**.
  2. Dùng **Node.js** chạy thử trên máy: `npm run dev` (truy cập `http://localhost:3000`) và `npm test`.
  3. Quản lý phiên bản mã nguồn với **Git & GitHub**: `git init`, `git add .`, `git commit -m "..."`, `git push -u origin main`.
  4. Form đăng ký hiện đang xử lý an toàn phía client thông qua `lib/registrations.mjs`.

---

## 2. Lộ trình tích hợp Section 2: Supabase & Vercel (Roadmap for Section 2)

Khi người dùng bước sang **Section 2** và yêu cầu:
> *"Hãy đọc file AGENTS.md và tiến hành kết nối Supabase cho form đăng ký, sau đó chuẩn bị deploy lên Vercel."*

AI Agent sẽ tự động khởi tạo và thực thi theo lộ trình chuẩn 2 giai đoạn dưới đây:

### Giai đoạn A: Tích hợp Cơ sở dữ liệu Supabase

1. **Khởi tạo bảng `registrations` trong Supabase SQL Editor**:
   ```sql
   create table if not exists public.registrations (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz not null default now(),
     name text not null,
     email text not null,
     plan text not null default 'launch',
     goal text default ''
   );

   alter table public.registrations enable row level security;

   -- Cho phép ghi dữ liệu đăng ký từ website
   create policy "Cho phep them dang ky" on public.registrations
     for insert with check (true);

   -- Chi cho phep xem danh sach voi service role / authenticated
   create policy "Chi doc bang service role" on public.registrations
     for select using (auth.role() = 'authenticated');
   ```

2. **Cấu hình biến môi trường (`.env.local`)**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
   ```

3. **Tạo API Route nhận form đăng ký (`app/api/register/route.js`)**:
   - Nhận request POST từ frontend dạng JSON `{ name, email, plan, goal }`.
   - Kiểm tra dữ liệu hợp lệ (tên không rỗng, email đúng định dạng).
   - Dùng REST API gốc (`fetch`) gửi trực tiếp đến Supabase endpoint `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/registrations` với header `apikey` và `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`.

4. **Kết nối Form (`lib/registrations.mjs`)**:
   - Khi người dùng gửi form, thực hiện `fetch('/api/register', { method: 'POST', ... })`.
   - Duy trì cơ chế lưu trữ cục bộ (local storage) dự phòng nếu thiết bị mất kết nối mạng.

---

### Giai đoạn B: Triển khai dự án lên Vercel

1. **Đồng bộ mã nguồn lên GitHub**:
   ```bash
   git add .
   git commit -m "feat: tich hop Supabase cho form dang ky"
   git push origin main
   ```

2. **Import dự án trên Vercel**:
   - Truy cập Vercel Dashboard ➔ **Add New...** ➔ **Project**.
   - Chọn kho lưu trữ GitHub của dự án.
   - Framework preset: **Next.js**.

3. **Cấu hình Environment Variables trên Vercel**:
   - Thêm `NEXT_PUBLIC_SUPABASE_URL` = URL dự án Supabase.
   - Thêm `SUPABASE_SERVICE_ROLE_KEY` = Service role secret key từ Supabase.

4. **Triển khai & Kiểm tra**:
   - Bấm **Deploy**.
   - Kiểm tra live production domain và submit thử một đăng ký trên website trực tiếp.

---

## 3. Quy tắc cốt lõi khi AI Agent thực hiện thay đổi

1. **Bảo tồn tính tinh gọn**: Không tự ý cài thêm các thư viện UI cồng kềnh hoặc package không cần thiết; ưu tiên REST API qua `fetch` gốc.
2. **Kiểm tra sau mỗi bước**: Luôn chạy `npm test` và `npm run build` để đảm bảo không phát sinh lỗi biên dịch.
3. **Giữ nguyên nhận diện thương hiệu EIU / Lumi Studio**: Tuân thủ bảng màu navy-kem-vàng trong `app/globals.css`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
