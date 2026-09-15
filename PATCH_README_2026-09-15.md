# EIU Applied Agentic AI — Patch 2026-09-15

Patch này được tạo trên **working tree source đã gửi ngày 2026-09-15**. Chỉ các file cần thiết cho yêu cầu hiện tại được đưa vào ZIP; không chứa `.git`, `node_modules`, `.next`, `.vercel`, `.env.local` hoặc secret.

## Cách áp dụng

1. Backup project hiện tại nếu cần.
2. Giải nén ZIP vào **root folder của project**.
3. Chọn **Replace / Overwrite** các file trùng tên.
4. Vì patch có cập nhật `docs/Code.gs`, hãy copy nội dung file này vào Google Apps Script đang dùng và **Deploy > Manage deployments > Edit > New version > Deploy** để backend nhận các action mới.
5. Chạy/deploy Next.js như flow hiện tại của project.

## Những thay đổi chính

### Section 1
- Xóa dòng: `Danh sách tự cập nhật mỗi 4 giây · Chỉ hiển thị trong phiên admin 1103` ở slide Idea Results của admin.
- Idea card co giãn theo độ dài nội dung thay vì kích thước đồng nhất.
- Idea card có chuyển động lơ lửng nhẹ.
- Admin có nút xóa từng idea.
- Thêm API DELETE `/api/ideas` và action `idea.delete` trong Google Apps Script.

### Section 2
- Slide 29: vòng quay chạy đúng 1 vòng rồi dừng; khung/text được nới và bỏ xuống dòng cứng.
- Slide 32: thêm khung transparent viền đỏ highlight `Gems` và `+ New Gem`.
- Slides trước/đến 35 được tăng cường motion/reveal ở các slide còn yếu.
- Slide 36: motion mạnh hơn + 9 idea cards (thêm 6 idea mới).
- Slide 37: motion mạnh hơn.
- Bỏ slide 38 cũ `Tặng kèm khóa học`.
- Slide 38 mới: Showcase chia sẻ bài làm tương tự Section 1; admin có quyền xóa.
- Slide 39 mới: Quiz Time 10 câu theo nội dung Section 2 + nút tải handout.
- Section 2 hiện có tổng cộng **39 slide**.

## Dữ liệu Google Sheet

Patch giữ nguyên dữ liệu Section 1 và tách dữ liệu mới của Section 2:

- Showcase Section 1: `Bài làm chia sẻ` (giữ nguyên)
- Showcase Section 2: `Bài làm chia sẻ - Section 2` (tự tạo khi dùng)
- Quiz Section 2: `Kết quả bài kiểm tra - Section 2` (tự tạo khi dùng)

## File handout mới

`public/downloads/eiu-applied-agentic-ai-section-2-handout.pdf`

- 1 trang A4
- EIU DNA navy / gold
- Tóm tắt Lab 2, Gem, công thức Instructions, quy trình, 9 ý tưởng thực hành và key message.

## Lưu ý

- Không thay đổi cơ chế login/session hiện tại.
- Không thay đổi quyền truy cập Section 1/Section 2 ngoài việc truyền quyền admin xuống Section 2 để xóa Showcase.
- Showcase Section 2 chấp nhận URL HTTPS của Gem/bài làm; Section 1 vẫn giữ validation Google Apps Script như trước.
