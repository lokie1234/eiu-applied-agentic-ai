# Setup trên máy mới

1. Clone repository và mở folder chứa package.json trong VS Code.
2. Cài Node.js phù hợp với phiên bản Next.js trong package.json.
3. Tạo `.env.local` theo `.env.example`, lấy giá trị từ cấu hình môi trường của project.
4. Chạy `npm install`, rồi `npm run dev`.
5. Mở http://localhost:3000.

Không dùng danh sách mã truy cập cố định trong các hướng dẫn cũ. Learning và Teaching dùng mã đang được cấu hình trong Admin; nội dung free theo quyền Learning hiện tại. Admin đăng nhập Google. Xem [PASSCODE_ACCESS.md](PASSCODE_ACCESS.md).

Cấu hình OAuth, callback cho localhost và lưu token Drive theo [GOOGLE_DRIVE_DEPLOYMENT.md](docs/GOOGLE_DRIVE_DEPLOYMENT.md). Giữ nguyên PASSCODE_SESSION_SECRET đang dùng khi cần đọc lại thông tin kết nối đã mã hóa.

Sau khi sửa, chạy `node --test tests/*.test.mjs`, `npx tsc --noEmit` và `npm run build`. Không đưa `.env.local`, thư viện hoặc file build vào Git.
