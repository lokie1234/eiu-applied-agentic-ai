# Loading animation

Folder, course và section dùng SVG chủ đề AI trong `components/LearningInnovationIcon.tsx`. Tia điện của section được vẽ bằng `components/SectionEnergy.tsx` và tránh vùng nội dung.

`components/HairlineLoading.tsx` dùng SVG/CSS: bệ phóng, khởi động, lửa/khói và tên lửa bay lên khỏi khung minh họa. Không cần kernel, tải script ngoài hoặc vòng lặp JavaScript. Animation dừng khi người dùng bật reduced motion; bài sẵn sàng thì hiển thị ngay.

Runtime Hairline cũ và các tài nguyên loading dots đã được xóa vì không còn được gọi. Xem [ARCHITECTURE.md](ARCHITECTURE.md) để tra cấu trúc hiện tại.
