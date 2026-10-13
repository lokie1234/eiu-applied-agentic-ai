// Edit this file to change the brand, copy and illustrative packages.
export const site = {
  brand: "LUMI STUDIO",
  eyebrow: "MỘT Ý TƯỞNG. MỘT WEBSITE. MỘT KHỞI ĐẦU.",
  headline: "Đưa ý tưởng của bạn",
  highlight: "ra ánh sáng.",
  description: "Một trang giới thiệu rõ ràng, một câu chuyện đáng nhớ, một bước đăng ký thật dễ. Khám phá website mẫu và biến nó thành chiến dịch của riêng bạn.",
  cta: "Đăng ký tư vấn",
  packages: [
    { id: "launch", name: "Launch", price: "3.000.000", tagline: "Một khởi đầu gọn gàng", features: ["Trang giới thiệu sản phẩm", "Form đăng ký tương tác", "Giao diện trên điện thoại"] },
    { id: "grow", name: "Grow", price: "5.000.000", tagline: "Thêm chiều sâu cho câu chuyện", features: ["Các mục nội dung có thể tùy chỉnh", "Animation nhẹ, dễ theo dõi", "Các gói và câu hỏi thường gặp"] },
    { id: "custom", name: "Custom", price: "Trao đổi", tagline: "Thiết kế theo ý tưởng của bạn", features: ["Tùy chỉnh màu sắc và bố cục", "Đổi nội dung cùng AI", "Mở rộng chức năng từng bước"] },
  ],
  faqs: [
    { question: "Tôi có thể đổi thương hiệu và nội dung không?", answer: "Có. Bạn có thể đổi tên, tiêu đề và các gói trong data/site.js; chỉnh giao diện trong app/globals.css và components/MarketingSite.js." },
    { question: "Nút đăng ký có hoạt động không?", answer: "Có. Form kiểm tra thông tin và lưu đăng ký trên trình duyệt này. Đây là dự án mẫu; chưa gửi dữ liệu đến một doanh nghiệp hay dịch vụ email." },
    { question: "Tôi sẽ xem bản chỉnh sửa ở đâu?", answer: "Chạy npm run dev và mở http://localhost:3000. Khi bạn lưu file, bản xem thử được cập nhật để bạn kiểm tra." },
  ],
};
