# Cài đặt Section 2

## Phạm vi bản patch

- Section 1 được giữ nguyên: PDF 38 trang, Showcase ở slide 38 và Quiz ở slide 39.
- Section 2 gồm 36 slide được tái tạo bằng HTML, CSS và React theo kích thước gốc `960 × 540`.
- Section 2 không tải hoặc hiển thị PDF.
- Các ảnh giao diện Gemini ở slide 32-34 được tách thành asset riêng; nội dung, tiêu đề, thẻ, quy trình và sơ đồ còn lại là thành phần HTML/CSS.
- Slide 38 của Section 2 tải file `Xay-dung-web-app-noi-bo.skill` từ thư mục `public/downloads`.

## Quyền truy cập

| Mã | Role | Quyền |
|---|---|---|
| `9999` | Section 1 | Chỉ xem Section 1 |
| `8888` | Section 2 | Chỉ xem Section 2 |
| `1103` | Admin | Mở màn hình chọn Section 1 hoặc Section 2; có quyền quản trị Showcase của Section 1 |

Cookie truy cập đã được nâng từ phiên bản `v2` lên `v3`. Sau khi deploy, trình duyệt đang đăng nhập sẽ được chuyển về trang login một lần để nhận đúng role mới.

## Environment Variables trên Vercel

Giữ nguyên các biến hiện tại và thêm đúng một biến mới:

```env
SECTION_2_ACCESS_CODE=8888
```

Bộ biến đầy đủ nên có:

```env
ACCESS_CODE=9999
SECTION_2_ACCESS_CODE=8888
ADMIN_ACCESS_CODE=1103
QUIZ_ACCESS_CODE=7879
QUIZ_SECTION_2_ACCESS_CODE=7979
ACCESS_SESSION_SECRET=mot-chuoi-bi-mat-dai-va-ngau-nhien
NEXT_PUBLIC_PDF_URL=url-pdf-section-1
GOOGLE_APPS_SCRIPT_URL=url-exec-cua-google-apps-script
GOOGLE_APPS_SCRIPT_SECRET=gia-tri-giong-WEBHOOK_SECRET
```

`NEXT_PUBLIC_PDF_URL` chỉ còn phục vụ Section 1. Section 2 không cần URL PDF hoặc biến môi trường riêng.

## Cài patch

1. Giải nén ZIP patch vào thư mục gốc project `Web clean`.
2. Chọn Replace/Overwrite khi Windows hỏi.
3. Không xóa các file Section 1 đang có.
4. Trong Vercel, mở **Settings → Environment Variables**.
5. Thêm `SECTION_2_ACCESS_CODE` với giá trị `8888`; chọn Production và Preview.
6. Push source lên GitHub.
7. Redeploy phiên bản mới nhất trên Vercel.

## Chạy kiểm tra tại VS Code

```bash
npm install
npm run lint
npm run build
npm run dev
```

Nếu trình duyệt giữ cookie cũ, mở `/login` hoặc xóa cookie `eiu_ai_access` rồi đăng nhập lại.

## Checklist quyền

- `9999`: vào thẳng Section 1 và không nhìn thấy màn hình chọn Section.
- `8888`: vào thẳng Section 2 và không thể mở Section 1.
- `1103`: nhìn thấy hai thẻ chọn Section; trong Section 1 vẫn có quyền xóa link Showcase.
- Admin có nút `Sections` trên thanh trên cùng để quay lại màn hình chọn.
- Section 2 có 36 slide và không gọi `NEXT_PUBLIC_PDF_URL`.
- Slide 32-34 hiển thị ảnh hướng dẫn Gemini.
- Slide 38 tải được file skill.

## Các file chính của Section 2

```text
components/LessonPortal.tsx
components/LessonPortal.module.css
components/section2/SectionTwoDeck.tsx
components/section2/SectionTwoDeck.module.css
components/section2/SectionTwoSlide.tsx
components/section2/SectionTwoSlide.module.css
public/section2/gemini-step-000.png
public/section2/gemini-step-001.png
public/section2/gemini-step-002.png
public/section2/gemini-step-003.png
public/downloads/Xay-dung-web-app-noi-bo.skill
```

## Thêm animation sau này

Nội dung từng trang nằm trong `SectionTwoSlide.tsx`. CSS của toàn bộ slide nằm trong `SectionTwoSlide.module.css`.

Khi thêm animation:

1. Giữ canvas `960 × 540`.
2. Tạo class riêng theo số slide, ví dụ `.slide30PromptPulse`.
3. Không thay đổi văn bản hoặc thứ tự 36 slide.
4. Decorative animation phải dùng `pointer-events: none`.
5. Tôn trọng `prefers-reduced-motion`.
6. Chạy lại `npm run build` trước khi deploy.

## Push GitHub

```bash
git add .
git commit -m "Add interactive Section 2 and access roles"
git push origin main
```
