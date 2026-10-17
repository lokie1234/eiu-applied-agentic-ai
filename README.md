# EIU Interactive Space

Ứng dụng Next.js/TypeScript để quản lý course, section, bài học tương tác và nội dung tải lên.

## Chạy local

1. Cài thư viện bằng `npm install`.
2. Tạo `.env.local` theo `.env.example` và cấu hình Supabase của project.
3. Chạy `npm run dev`, mở http://localhost:3000.

Learning/Teaching dùng passcode được quản lý trong Admin. Learning có thể truy cập nội dung free. Admin đăng nhập bằng Google được cấu hình cho project. Xem [PASSCODE_ACCESS.md](PASSCODE_ACCESS.md) và [hướng dẫn Google/Drive](docs/GOOGLE_DRIVE_DEPLOYMENT.md).

## Nội dung bài học

- `components/LessonPortal.tsx`: chọn folder/course/section.
- `components/deck/SharedDeckFrame.tsx`: điều hướng, zoom và fullscreen.
- `components/section1/`, `components/section2/`: các bài Applied Agentic AI có tương tác.
- `components/deck/UploadedSectionDeck.tsx`: xem TSX/PDF/PPTX qua API nội dung có kiểm tra quyền.
- `course-content/sources.json`: đăng ký course/section dùng TSX local. Khi chỉnh nội dung, mở lại section hoặc refresh; không cần upload Drive.

Course phát triển Web App có [hướng dẫn và nguồn chỉnh sửa](course-content/web-app-development/README.md). Section 1 hiện có 40 slides; dự án quảng cáo tải xuống ở slide 25. Nguồn ZIP ở `examples/eiu-advertising-starter/`; tạo lại bằng `node scripts/package-advertising-starter.mjs`.

## Kiểm tra

```bash
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Các tài liệu chính: [kiến trúc](docs/ARCHITECTURE.md), [upload section](docs/SECTION_CONTENT_UPLOAD.md), [số slides tự động](docs/section-slide-counts.md), [icon cây](docs/course-garden-assets.md), [setup máy mới](NEW_MACHINE_SETUP.md).

Các migration trong `supabase/migrations/` là lịch sử schema để cài mới/nâng cấp; không xóa vì không được import bởi React. Hướng dẫn đăng nhập Email OTP và lớp interaction phủ PDF cũ đã được thay bằng flow hiện tại.
# JS lessons and project cleanup · 17/10/2026

Standalone section files are now `.js`; existing course IDs, permissions and lesson designs are preserved. Web Development authoring uses `storyboard.json` and `renderer.tsx.txt`; regenerate with `node scripts/build-web-app-course.cjs`. See [migration and cleanup report](docs/project-cleanup-2026-10-17.md).

Run `npm test`, `npm run lint`, and `npm run build` for validation.

