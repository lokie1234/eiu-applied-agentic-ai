# Dự án website mẫu EIU

Đọc README.md và package.json trước khi thay đổi. Đây là website quảng cáo Next.js dùng JavaScript/React; không thêm dịch vụ hay tài khoản nếu chưa được yêu cầu.

Giữ form đăng ký, tab, FAQ và responsive hoạt động. Đổi nội dung trong data/site.js; đổi màu trong app/globals.css. Không chỉnh node_modules hoặc .next.

Trước khi viết code Next.js, đọc hướng dẫn liên quan trong node_modules/next/dist/docs/ của dự án đã cài thư viện. Kiểm tra npm test và npm run build sau thay đổi chức năng. Báo rõ file đã chỉnh và các kiểm tra chưa thực hiện.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
