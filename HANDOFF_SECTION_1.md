# HANDOFF — EIU Applied Agentic AI Section 1

## 1. Mục tiêu của project

Đây là nền Section 1 của khóa học EIU Applied Agentic AI. Project hiện đã được mở rộng thêm Section 2 bằng HTML/CSS/React. Source dùng để deploy trên Vercel từ GitHub:

`https://github.com/lokie1234/eiu-applied-agentic-ai.git`

Hướng dẫn Section 2 và phân quyền mới nằm tại `docs/SECTION_2_SETUP.md`.

## 2. Trạng thái đã hoàn thành

- Next.js App Router + TypeScript.
- React-PDF hiển thị PDF từ `NEXT_PUBLIC_PDF_URL`.
- Khung slide theo đúng tỷ lệ PDF gốc `960 × 540`.
- Có điều hướng Previous/Next, bàn phím, cuộn chuột, nhập số slide, zoom và fullscreen.
- Có interaction/hotspot/animation riêng trên các slide, không sửa nội dung PDF gốc.
- Hai khoảng trống hai bên có ambient AI chuyển động và robot tương tác.
- Slide 34 có nút copy Prompt và tải `public/downloads/design-dna.txt`.
- Slide 35 có cycle animation giữa bốn ô.
- Slide 38 được thay bằng Showcase hai cột.
- Slide 39 được tạo bằng HTML/CSS tương tác, không nằm trong PDF.

## 3. Quyền truy cập

| Mã | Role | Quyền |
|---|---|---|
| `9999` | Section 1 | Xem Section 1, làm Quiz, chia sẻ Web App |
| `8888` | Section 2 | Chỉ xem Section 2 |
| `1103` | Quản trị | Chọn xem Section 1 hoặc Section 2; có nút xóa liên kết ở slide 38 của Section 1 |

Quyền được lưu trong cookie HttpOnly có chữ ký HMAC. Các file chính:

- `lib/access.ts`
- `app/api/access/route.ts`
- `app/page.tsx`
- `components/LoginForm.tsx`

Khi test quyền quản trị, mở `/login` và nhập lại `1103` để cookie được ghi đè thành role `admin`.

## 4. Cấu trúc bài học

PDF gốc có 38 trang. Website có tổng cộng 39 slide:

- Slide 1–37: PDF + interaction layer.
- Slide 38: `components/ShowcaseSlide.tsx` thay thế hình PDF bằng giao diện Showcase.
- Slide 39: `components/QuizSlide.tsx`.

Logic tổng số trang nằm trong `components/PdfDeck.tsx`:

```text
numPages = pdf.numPages + 1
```

Không tăng tổng trang nếu chưa chủ động thêm một slide HTML mới.

## 5. Slide 38 — Showcase

Người học nhập:

- Tên.
- URL Web App Google Apps Script kết thúc bằng `/exec`.

Sau khi chia sẻ, dữ liệu xuất hiện trong tab `Bài làm chia sẻ` của Google Sheet. Admin đăng nhập bằng `1103` nhìn thấy nút `Xóa`.

Luồng xóa:

1. `ShowcaseSlide.tsx` gửi `DELETE /api/showcase` cùng `id`.
2. `app/api/showcase/route.ts` xác minh cookie phải có role `admin`.
3. Route gửi action `showcase.delete` đến Apps Script.
4. `docs/Code.gs` tìm UUID ở cột `Mã` và xóa đúng dòng.

Nếu nút xóa xuất hiện nhưng xóa thất bại, kiểm tra theo thứ tự:

1. Apps Script đã chứa nhánh `showcase.delete` trong `docs/Code.gs`.
2. Apps Script đã deploy bằng **Phiên bản mới**.
3. Quyền Web App là **Bất kỳ ai**.
4. `GOOGLE_APPS_SCRIPT_SECRET` trên Vercel giống chính xác `WEBHOOK_SECRET` trong `Code.gs`.
5. Vercel đã redeploy sau khi đổi biến môi trường.

## 6. Slide 39 — Quiz

Nhãn cố định:

```text
EIU - Applied Agentic AI
Quiz time!
```

Quiz gồm 10 câu bám sát nội dung Section 1, dùng đúng các thuật ngữ trong bài như Gemini, Web App, Google Sheets, Database, Frontend, Business Logic, Google Apps Script, Prompt và Authorize.

Sau câu 10:

- Công bố điểm.
- Người học nhập họ tên.
- Website ghi kết quả vào tab `Kết quả bài kiểm tra`.
- Không yêu cầu email.
- Không gửi email.

File chính:

- `components/QuizSlide.tsx`
- `components/QuizSlide.module.css`
- `app/api/quiz-results/route.ts`

## 7. Google Sheet và Apps Script

Google Sheet đích:

`https://docs.google.com/spreadsheets/d/1j44K3vgiSHrIjPA5l6vYtJ6LzIqzVQok3oLzpWwwGgQ/edit`

Apps Script Web App hiện dùng:

`https://script.google.com/macros/s/AKfycbyg7d4m6Ou5EH3KximcaMFHdNM4vvjSPWXUyYhefWTO2w72gpmKkDWrIz1u2biAukVR/exec`

Apps Script chỉ cần **một file `Code.gs`**, không cần file HTML.

Mã chuẩn nằm tại `docs/Code.gs`. Mã sẽ tự tạo hai tab:

- `Bài làm chia sẻ`: Mã, Thời gian, Họ và tên, Liên kết.
- `Kết quả bài kiểm tra`: Thời gian, Họ và tên, Kết quả.

Hướng dẫn deploy chi tiết nằm trong `docs/GOOGLE_APPS_SCRIPT_SETUP.md`.

## 8. Environment Variables

Vercel cần các biến:

```env
ACCESS_CODE=9999
SECTION_2_ACCESS_CODE=8888
ADMIN_ACCESS_CODE=1103
ACCESS_SESSION_SECRET=mot-chuoi-bi-mat-dai
NEXT_PUBLIC_PDF_URL=url-pdf-section-1
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbyg7d4m6Ou5EH3KximcaMFHdNM4vvjSPWXUyYhefWTO2w72gpmKkDWrIz1u2biAukVR/exec
GOOGLE_APPS_SCRIPT_SECRET=gia-tri-giong-WEBHOOK_SECRET
```

Không đưa secret thật vào source hoặc chat. Không commit `.env.local`.

Sau khi sửa Environment Variables, luôn redeploy Vercel.

## 9. Design DNA và nguyên tắc chỉnh interaction

- Tọa độ chuẩn: `960 × 540`.
- Navy chính: `#15406A`.
- Gold: `#A2885E`.
- Beige: `#F1ECE3`.
- Hotspot phải match ô đỏ của PDF thật.
- Mũi tên động bắt đầu tại mép hình nguồn và kết thúc tại mép hình đích.
- Không chèn lại chữ hoặc hình đã có trong PDF.
- Decorative animation dùng `pointer-events: none`.
- Interaction mới nên dùng CSS Module riêng.
- Giữ font tiếng Việt an toàn: `Segoe UI`, `Noto Sans`, `Arial`, `sans-serif`.

PDF tham chiếu nằm tại:

`reference/EIU Applied Agentic AI Section 1.pdf`

## 10. Các file nên đọc đầu tiên ở chat mới

1. `HANDOFF_SECTION_1.md`
2. `components/PdfDeck.tsx`
3. `components/interactions/InteractionLayer.tsx`
4. File component và CSS của slide cần sửa.
5. `reference/EIU Applied Agentic AI Section 1.pdf`
6. `docs/EIUdesignDNA.txt`

Yêu cầu cho chat mới: chỉnh trực tiếp trên source này, không rebuild project từ đầu và không thay đổi slide ngoài phạm vi được giao.

## 11. Chạy và kiểm tra

```bash
npm install
npm run lint
npm run build
npm run dev
```

Nếu giao diện giữ cache cũ trên Windows:

```bat
rmdir /s /q .next
npm run dev
```

Sau đó nhấn `Ctrl + F5` trên trình duyệt.

Checklist trước khi deploy:

- `9999` không có nút xóa.
- `1103` có nút xóa và xóa được.
- Slide 38 thêm link mới và tải lại vẫn còn dữ liệu.
- Slide 39 đủ 10 câu, tiêu đề đúng và ghi điểm vào Sheet.
- Không có chức năng gửi email.
- Nút tải design DNA tải được `public/downloads/design-dna.txt`.
- Build production thành công.

## 12. Push GitHub và deploy

```bash
git add .
git commit -m "Finalize Section 1 interactive lesson"
git push origin main
```

Vercel sẽ build từ GitHub. Nếu chưa tự deploy, vào Vercel → Deployments → Redeploy bản mới nhất.
