# Mẫu thiết kế đã được người dùng chọn

Từ lần chỉnh slide 2 Section 1 này, dùng ảnh tham chiếu SAVE / SHARE / USE của người dùng làm chuẩn text và layout cho các lần chỉnh course tiếp theo. Không quay lại thẻ trắng đơn giản hoặc format chú thích. Với slide mở đầu, giữ bố cục cover nhưng áp dụng cùng phân cấp chữ và bảng màu.

- Nền sáng trắng–kem, lưới hoặc nét trang trí rất nhẹ.
- Navy #082945 / #123f68; vàng #b39159 / #e9ca8b; kem #f7f4ed.
- Font Inter, Segoe UI, Noto Sans, Arial. Tiêu đề khung viết hoa, đậm 800–850, khoảng cách chữ nhẹ; mô tả 20px, đậm vừa 550–600, không ngắt dòng vô nghĩa.
- Các khung ngang xếp dọc: đường nối và số tròn ở ngoài bên trái, icon vuông bo góc navy–vàng, nội dung ở giữa, nhãn thao tác bên phải.
- Viền vàng mảnh, cạnh trái có vạch vàng, bo góc 20px, bóng nhẹ. Khung được nhấn dùng nền navy, tiêu đề vàng và mô tả trắng.
- Trên canvas 1280×720: lề 42px, số tròn 60px, icon 68px, nhãn phải 166px. Bốn khung cao 118px, cách nhau 18px; điều chỉnh theo lượng nội dung khi cần.
- Hiệu ứng xuất hiện theo thứ tự cách nhau 0.12 giây; đường nối chuyển động nhẹ; điểm nhấn sáng tiết chế. Tắt hiệu ứng khi người xem bật giảm chuyển động.
- Giữ tiếng Việt trong nội dung; tên công cụ và thuật ngữ thao tác có thể giữ nguyên kèm giải thích.

Không thêm header/footer, số trang, nhãn thời lượng hoặc dòng ghi chú giảng viên đã được yêu cầu bỏ. Các nhãn thao tác trong khung mô tả kết quả đầu ra, không phải nút bấm nếu chưa có hành động thực tế.

Slide 1 Section 1: tiêu đề “Phát triển & Quản lý mã nguồn” phải nằm trên một hàng, chạy ngang phần đầu slide. Phần mô tả gồm hai câu hoàn chỉnh, mỗi câu một hàng trong cột trái; icon chuyển động nằm ở cột phải. Điều chỉnh chiều rộng và cỡ chữ để tránh ngắt câu giữa chừng.

Vòng animation Section 1 có ba công cụ: VS Code, Git và GitHub. Git dùng biến thể biểu tượng phối bốn màu đỏ, vàng, xanh dương và xanh lá theo yêu cầu; file vector `git-four-color.svg` được nhúng vào TSX. Nêu rõ Git quản lý phiên bản trên máy, GitHub lưu kho mã nguồn từ xa và hỗ trợ cộng tác.

Ba mục “Chỉnh sửa”, “Kiểm tra”, “Quản lý phiên bản” dùng chữ lớn 26px, đặt thành ba khung xếp dọc ở góc dưới bên trái slide 1. Cột rộng 535px, khung cao tối thiểu 64px, cách nhau 12px; không phủ vùng animation icon bên phải. Khung có viền vàng mảnh, xuất hiện lần lượt và điểm sáng vàng chuyển động nhẹ; giữ mỗi mục trên một hàng.

Slide 3: ba cột cân đối, có logo từng công cụ, tiêu đề viết hoa và vai trò/nội dung nguyên bản. Slide 4: tiêu đề “Tính năng cụ thể”, ba tab công cụ ngang, danh sách tính năng bên trái và ba lớp chi tiết bên phải. Slide 5: sơ đồ cố định sáu bước theo đường nối 1→2→3↓4→5→6, có mũi tên chuyển động nhẹ; không có thao tác sắp xếp. “Chọn thay đổi” nghĩa là chọn file hoặc phần sửa cho Commit. Các slide 3–5 không hiển thị dòng tổng kết phụ.
