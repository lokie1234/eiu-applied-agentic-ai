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

Khi người dùng nói “redesign”, mặc định áp dụng EIU DNA. Slide 6–9 dùng nền kem nhẹ, navy–vàng, khung bo góc và phân cấp chữ thống nhất: mô phỏng vùng làm việc, cây thư mục, ba thao tác và vòng lặp AI. Toàn bộ slide ở cả hai section không hiển thị dòng chú thích/tổng kết dưới cùng. Tab slide 4 được giữ nguyên DOM khi chuyển công cụ để tránh chạy lại animation của các icon khác.

Slide 6 dùng ảnh VS Code người dùng cung cấp, nhúng nguyên ảnh vào TSX, khoanh đỏ và đánh số sáu vùng kèm tên ở bên phải. Slide 7 mới giải thích chức năng đúng sáu vùng theo cùng số; các slide phía sau được dịch xuống một vị trí. Chọn bố cục theo visual key thay vì số slide để chèn slide không làm sai thiết kế.

Slide 7–12: mỗi vùng quan trọng một slide riêng, theo thứ tự Menu, Activity Bar, Explorer, Editor, Terminal/Panel, Codex/Chat. Liệt kê chức năng thực tế bằng các khung kem viền vàng, một khung navy nổi bật và dải giới thiệu vùng ở đầu nội dung. Các slide sau bắt đầu từ slide 13.

Các nhãn bên phải slide 6 dùng khung kem, viền/cạnh nhấn vàng, số trong ô navy chữ vàng. Khung nội dung phía dưới slide 7–12 dùng cùng nền kem, tiêu đề navy và chữ mô tả đồng nhất; không nhấn riêng một ô bằng nền xanh.

Nhấn nhẹ các khung theo yêu cầu ở slide 7–11 bằng viền vàng sáng nhịp chậm và điểm sáng chạy ngắn trên cạnh trái; slide 12 nhấn cả sáu khung. Chỉ animate opacity/transform của lớp trang trí, không dịch khung/chữ, giữ nền kem thống nhất, tắt chuyển động theo prefers-reduced-motion.

Slide 13: bốn logo AI chính chủ lơ lửng bằng CSS transform, nút đứng yên để dễ chọn; bấm logo cập nhật bảng ưu điểm / điểm cần cân nhắc. EIU kem–navy–vàng, hỗ trợ bàn phím và giảm chuyển động.

Slide 6–12 có logo VS Code ở góc trên phải. Slide 13 giữ viền ngoài EIU, nội dung bảng đổi màu theo AI được chọn; bỏ link tài liệu và dòng hướng dẫn ở đáy. Dải 10 logo extension chính chủ chạy ngang liên tục ở mép dưới, lặp liền mạch, hover tạm dừng và hỗ trợ reduced motion.

Dải logo slide 13 không lặp Antigravity, GitHub Copilot, Claude Code, Cline hoặc Codex. Năm logo thay thế là Qodo, Bito, CodeGeeX, Tabby và CodeGPT; giữ năm công cụ khác đang có và hiệu ứng chạy ngang hiện tại.

Slide 14–21: tám slide tương tác Git/GitHub cho vibe coding. Bắt đầu từ VS Code mới cài: Git trên máy, danh tính commit, extension Codex của OpenAI, repository local và Publish to GitHub. Nền kem, navy–vàng, chữ 19–29px, chuyển nội dung tại chỗ và giữ DOM nút. Không thêm chú thích đáy. Tắt hiệu ứng khi reduced motion. Các slide cũ dịch xuống 22–33; phần repository và PR chuyển thành thực hành.
