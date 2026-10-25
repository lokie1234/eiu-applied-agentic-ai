---
name: slide-edit
description: >-
  Use this skill automatically whenever the user asks to edit, update, modify, or format course slides.
  Ensures direct focused changes, unified design & layout, prevents awkward line breaks (orphan words),
  omits text images, and prioritizes maximum response speed with concise replies.
---

# Slide Edit & Optimization

Quy trình chuẩn tối ưu hóa tốc độ và chất lượng khi chỉnh sửa slide bài giảng theo yêu cầu của người dùng.

## Nguyên tắc cốt lõi

1. **Vào thẳng vấn đề (Direct & Focused)**:
   - Đi thẳng vào đúng slide và nội dung người dùng đề cập.
   - Không đọc lan man hay inspect các file không liên quan.
   - Chỉ đọc đoạn mục tiêu trong `course-content/<course>/storyboard.json` hoặc hàm render tương ứng trong `course-content/<course>/renderer.tsx.txt` (dùng bounded read theo line range, tối đa 500–1000 tokens/lần đọc).

2. **Chỉ là slide – Không dùng text image**:
   - Slide giảng dạy trực tiếp trên nền web: **Tuyệt đối không sinh hình ảnh, không chèn prompt text-to-image hay nhúng ảnh bitmap phức tạp**.
   - Mọi thông điệp, nhãn và nội dung trình bày đều dùng text/HTML/CSS native để đảm bảo độ sắc nét, tải nhanh và dễ tùy biến.

3. **Đồng bộ bố cục & Design**:
   - Bảo toàn nguyên vẹn phong cách thiết kế hiện tại của section (hệ màu, typography, card border, padding, icon branding).
   - Giữ vững cấu trúc trực quan: Tiêu đề nổi bật $\to$ Phụ đề súc tích $\to$ Thẻ nội dung / Điểm nhấn có tổ chức.
   - Không được làm vỡ layout: tính cả chiều cao nội dung, padding, gap, border và số dòng trong khung slide; không để tràn khung, chồng lấn, cắt mất nội dung hoặc xuất hiện thanh cuộn ngoài ý muốn. Không che lỗi bằng overflow hidden hay thu chữ quá nhỏ.
   - Bố cục luôn cân đối: ưu tiên diện tích cho phần nhiều nội dung, căn thẳng các cạnh và giữ khoảng cách nhất quán. Khi thêm dòng, điều chỉnh lại toàn bộ bố cục liên quan; rút gọn hoặc nhóm nội dung trước khi ép vào khung cũ. Không dùng nowrap cho đoạn dài; ngắt theo cụm nghĩa, không để từ lẻ rơi xuống dòng.

4. **Chống chữ xuống dòng vô nghĩa (No Awkward Line Breaks / Orphan Words)**:
   - **Tuyệt đối không để 1 từ đơn lẻ rơi xuống dòng cuối cùng** (hiện tượng orphan / widow text) trong tiêu đề, thẻ tóm tắt hay các gạch đầu dòng.
   - Ngắt câu theo cụm từ có nghĩa (semantic chunks) để người học đọc lướt tự nhiên.
   - Áp dụng các giải pháp trình bày:
     - Thêm `&nbsp;` (non-breaking space) giữa 2 từ cuối cùng trong tiêu đề/nhãn.
     - Dùng thuộc tính CSS phù hợp: `text-wrap: balance`, `text-wrap: pretty`, hoặc `white-space: nowrap` cho badge, pill, button.
     - Cân chỉnh độ dài câu chữ hoặc padding của card để khối văn bản cân đối, không bị gãy dòng cụt lủn.

5. **Ưu tiên tốc độ phản hồi cực nhanh (Maximum Speed)**:
   - **Quy trình tối giản**: 1 lần đọc đúng chỗ $\to$ 1 lần sửa chính xác $\to$ 1 lần đồng bộ JS.
   - Đối với khóa học Web Development: Chạy duy nhất lệnh đồng bộ compiled JS:
     `node scripts/build-web-app-course.cjs`
   - **Nghiêm cấm**: Không mở preview, không screenshot, không browser check, không chạy `npm test`, không `eslint`, không `next build` trừ khi người dùng yêu cầu cụ thể.
   - **Phản hồi**: Trả lời bằng **1 đến 2 câu tiếng Việt ngắn gọn**, thông báo trực tiếp slide đã được cập nhật, không trình bày quy trình hay checklist dài dòng.

