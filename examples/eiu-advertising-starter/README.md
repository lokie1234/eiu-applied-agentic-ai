# Lumi Studio · EIU Advertising Starter

Bộ mã nguồn dự án mẫu website quảng cáo dịch vụ **Lumi Studio**, được thiết kế tinh gọn trên nền **Next.js App Router (React)** và **CSS thuần**, phục vụ bài thực hành trong khóa học **AI-Powered Web Development**.

---

## 1. Cấu trúc dự án

```text
eiu-advertising-starter/
├── app/
│   ├── globals.css          # Toàn bộ stylesheet và biến màu EIU
│   ├── layout.js            # Layout gốc Next.js
│   └── page.js              # Trang chủ hiển thị website
├── components/
│   └── MarketingSite.js     # Giao diện chính: Header, Hero, Plans, Modal, FAQ
├── data/
│   └── site.js              # Dữ liệu nội dung (kế hoạch, dịch vụ, câu hỏi)
├── lib/
│   └── registrations.mjs    # Xử lý đăng ký tư vấn phía client
├── tests/
│   └── registrations.test.mjs # Unit test kiểm tra luồng form
├── AGENTS.md                # Tài liệu định hướng và lộ trình cho AI Agent
├── package.json             # Cấu hình scripts dev, build, test
└── README.md                # Tài liệu hướng dẫn này
```

---

## 2. Quy trình thực hành trong Section 1

### Bước 1: Mở và khám phá trong VS Code
1. Giải nén file `.zip`.
2. Mở VS Code: **File → Open Folder** và chọn thư mục `eiu-advertising-starter`.
3. Xem file `data/site.js` (nơi đổi nội dung) và `app/globals.css` (nơi đổi màu sắc).

### Bước 2: Chạy kiểm tra với Node.js
Mở Terminal trong VS Code (**Terminal → New Terminal**) và chạy:
```bash
# Cài đặt dependencies
npm install

# Chạy bản thử nghiệm cục bộ
npm run dev
```
Giữ phím **Ctrl** và click vào đường dẫn `http://localhost:3000` trên Terminal để xem giao diện trên trình duyệt.

Chạy kiểm tra tự động:
```bash
npm test
```

### Bước 3: Quản lý mã nguồn với Git & GitHub
Khởi tạo và đẩy mã nguồn lên GitHub:
```bash
git init
git add .
git commit -m "feat: khoi tao project Lumi Studio"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/<repo-cua-ban>.git
git push -u origin main
```

---

## 3. Lộ trình tích hợp Section 2 (Supabase & Vercel)

Trong **Section 2**, bạn sẽ sử dụng AI Agent để nâng cấp dự án:
- **Cơ sở dữ liệu Supabase**: Chuyển việc lưu form đăng ký vào bảng `registrations` trên Supabase Database.
- **Triển khai Vercel**: Đưa website lên internet với tên miền miễn phí thông qua Vercel.

Dự án đã có sẵn file [`AGENTS.md`](./AGENTS.md). Khi bước vào Section 2, bạn chỉ cần ra lệnh cho AI Agent (Codex, Antigravity, Claude...):
> *"Hãy đọc file AGENTS.md và tiến hành kết nối Supabase cho form đăng ký Lumi Studio, sau đó hướng dẫn deploy lên Vercel."*

AI Agent sẽ đọc hiểu kiến trúc và tự động vạch ra lộ trình thực hiện từng bước chuẩn xác!
