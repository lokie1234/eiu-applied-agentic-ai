# Hairline loading runtime

Folder, course và section hiện dùng SVG cây trong [course-garden-assets.md](course-garden-assets.md). Các adapter sách/trang cũ và preview HTML/JS/PNG đã được gỡ.

Hairline chỉ còn phục vụ loading dots qua `components/HairlineLoading.tsx`, `components/hairline/runtime.ts`, `public/hairline/kernel.js` và `public/hairline/loading-dots.js`. Runtime chia sẻ kernel, cache figure, tuần tự hóa đăng ký và hỗ trợ reduced motion.

Không đưa lại nguồn folder/book/page vào runtime. Dùng [ARCHITECTURE.md](ARCHITECTURE.md) để tra cấu trúc hiện tại.
