# Mẫu thiết kế đã được người dùng chọn

## Flow đang áp dụng · 14/10/2026

Đã bỏ slide 3 (vai trò) và 4 (tính năng) cũ. Slide flow 5 cũ thành slide 3, giữ sáu ô 3×2 và mũi tên; icon Node.js đặt cùng VS Code trong header bước Kiểm tra, kích thước 46px. Nhận diện role/feature/process bằng visual, không theo số slide. Các slide sau giảm hai số; Section 1 hiện 21 slide. Các số slide trong lịch sử bên dưới là số cũ.

Slide 1: bốn icon VS Code, Node.js, Git, GitHub đi theo vòng tròn cùng animation 25 giây, bán kính 170px. Counter-rotate giữ hình và tên thẳng; vòng tròn nối liên tục, không còn cạnh/chéo của cụm 2×2. Tắt chuyển động khi reduced motion, giữ bốn vị trí cách 90°. Nội dung trái chỉ có bốn bullet ngắn: Chỉnh sửa cùng AI; Chạy app với Node.js; Kiểm tra kết quả; Quản lý phiên bản. Bốn khung 56px, gap 12px, không có đoạn Node.js dài hoặc lệnh.

Slide 6: sơ đồ liên kết ba công cụ có icon nhỏ 28px cạnh tên Node.js, Git, GitHub. Dòng “Chiều về” dùng khung navy, viền/cạnh vàng, chữ trắng và nhãn vàng đậm để nổi bật; giữ nguyên nội dung và popup.

Các chức năng trong sáu popup VS Code dùng 2–3 bullet points ngắn, thao tác cụ thể, bỏ câu mô tả dài. Sửa cascade của lưới Menu dense: ô regionEmphasis phải giữ nền navy, tiêu đề/marker vàng và nội dung trắng; không để quy tắc nền kem của dense ghi đè làm chữ nhạt trên nền sáng.

Typography popup: giảm một cỡ (1px) cho nội dung và tiêu đề trong popup VS Code, Git/GitHub và setup. Nội dung VS Code 18px, menu dày 17px; tiêu đề ô 20px/19px. Git/GitHub 18px, lưu ý/lệnh 17px; setup 20px. Ô căn nội dung từ trên, padding 16–20px, min-width 0; từ dài/lệnh được xuống dòng trong đúng cột. Giữ header chữ gọn và lưới hai hàng để phần nội dung không bị chèn.

Yêu cầu mới thay thế các mô tả cũ về slide 14–40 bên dưới: Section 1 hiện có 21 slide. Slide 4 gộp sáu vùng VS Code vào popup thay cho 7–12 cũ; từ 6: một slide nền tảng Node.js/Git/GitHub với ba popup → setup VS Code/Git/GitHub → Antigravity/Codex → setup AI → tải/mở/chạy app quảng cáo → cấu trúc prompt và sửa → khác biệt model/tự test-fix → nghiệm thu → Commit/Push/Pull/Clone → tự kiểm tra. Xem GIT_GUIDE.md cho ánh xạ số slide mới.

Slide 6 dùng ba khung Node.js/Git/GitHub mở popup riêng, mỗi popup hiển thị đủ ba nhóm nội dung. Ba khung xếp ngang, Git ở giữa nền navy; sơ đồ Node.js chạy/kiểm tra → Git Commit → GitHub Push và chiều Pull/Clone → npm → chạy lại. Có nút đóng, đóng qua Escape/nền, giữ focus trong popup và trả focus về khung vừa chọn. Slide 7 gộp setup vào bốn khung VS Code, Node.js, Git, GitHub; popup có bước chọn cố định và chi tiết link/lệnh/kết quả. Slide sau setup bắt đầu từ 10.

Slide 4 giữ ảnh gốc và sáu khoanh đỏ trên bản đồ. Popup của cả sáu vùng bỏ hoàn toàn ảnh cắt và kính lúp. Header 100px gồm số vùng trong ô navy–vàng, tiêu đề, mô tả và nút đóng; phần nội dung tách bằng đường vàng mảnh, dành toàn bộ chiều cao còn lại cho hai hàng thẻ. Sáu chức năng dùng 3×2, tám mục Menu dùng 4×2. Chữ 17–19px, padding 14–18px; nền kem và các ô quan trọng navy, chữ vàng/trắng. Không có kiểu thu gọn riêng cho vùng 02. Giữ đầy đủ nội dung, thao tác mở/đóng, Escape và focus; không cuộn.

Giữ EIU khung ngoài navy–vàng, nền kem có lưới nhẹ, chữ rõ và bước chọn cố định. Hai slide AI dùng vibe riêng bên trong khung EIU: Antigravity sáng, ánh xanh/tím và dải bốn màu Google; Codex nền graphite/xanh tối, chữ terminal và điểm nhấn mint. CSS mới chỉ áp dụng `.gitIntroSlide` từ slide 8; giữ nguyên thiết kế slide 1–5. Prompt dài nằm trong textarea có thể cuộn/sao chép để giữ slide vừa canvas. Không thêm header/footer, nhãn thời lượng hoặc ghi chú đáy.

Bố cục slide 14–39 Section 1 dùng slide 4 làm chuẩn: dải ba công cụ ngang, danh sách bước rộng 340px bên trái và bảng chi tiết bên phải. Toàn khối cân giữa canvas; tiêu đề chính, tên bước và tiêu đề chi tiết giữ một dòng bằng nội dung ngắn gọn. Bảng chi tiết chia khối Thao tác, Lệnh trong Terminal và Kết quả & lưu ý; văn bản căn giữa, lệnh và danh sách căn trái để dễ đọc. Nội dung hướng dẫn độc lập, không nhắc số slide hay dẫn chiếu sang slide khác. Giữ link tải/đăng ký, thao tác chọn bước và EIU DNA.

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

Slide 6–13 có logo VS Code ở góc trên phải. Slide 13 giữ viền ngoài EIU, nội dung bảng đổi màu theo AI được chọn; bỏ link tài liệu và dòng hướng dẫn ở đáy. Dải 10 logo extension chính chủ chạy ngang liên tục ở mép dưới, lặp liền mạch, hover tạm dừng và hỗ trợ reduced motion.

Dải logo slide 13 không lặp Antigravity, GitHub Copilot, Claude Code, Cline hoặc Codex. Năm logo thay thế là Qodo, Bito, CodeGeeX, Tabby và CodeGPT; giữ năm công cụ khác đang có và hiệu ứng chạy ngang hiện tại.

Slide 14–40: Git được giới thiệu ngắn và có link tải; GitHub có link đăng ký, gợi ý Continue with Google. 16–21 cài Git, kiểm tra phiên bản/PATH/GCM, đặt tên–email và giải thích xác thực HTTPS qua trình duyệt. Không cài extension GitHub; không bắt buộc đăng nhập menu Accounts của VS Code để dùng Git trong Terminal. 22–24 phân biệt Clone và Init, thử Clone repo private có README bằng lệnh. 25–33 tải website ZIP, chạy local, chỉnh bằng tay/AI và kiểm tra. 34–39 dùng git init/add/commit, tạo repo GitHub trống, remote add và push -u; chọn nhánh, Commit/Push/Pull và đối chiếu. 40 tự kiểm tra toàn tuyến. Các thao tác Git được thực hiện bằng lệnh trong Terminal VS Code; đăng nhập xuất hiện khi thao tác HTTPS cần xác thực. Không tạo thêm repo local rỗng để luyện lại quy trình của website ZIP.

EIU DNA được nhấn mạnh: viền ngoài navy–vàng, nền kem có lưới rất nhẹ, khối minh họa gradient navy, tiêu đề 800–850, bước đánh số và cạnh vàng. Dùng icon Git, GitHub, VS Code, Windows và Google khi phù hợp. Nút bước đứng yên; chọn bước cập nhật nội dung ngay tại chỗ. Điểm sáng ở cạnh nội dung và mũi tên chỉ animate opacity/transform; tắt khi reduced motion. Không thêm header/footer, nhãn thời lượng hay chú thích đáy. Nội dung và thiết kế phải đồng bộ giữa TSX đang hiển thị, storyboard.json và renderer.tsx.txt.

Slide 25–39 tiếp nối cùng EIU DNA và điều hướng bước cố định. Minh họa ZIP, folder, terminal, localhost, ngữ cảnh AI và nhánh Git bằng khối navy–vàng; button tải ZIP thật ở slide 25. Không để minh họa gọi tên project local rỗng đã bỏ; dùng eiu-advertising-starter. Website mẫu dùng nền kem, typography rõ, CTA navy, điểm nhấn vàng và animation nhẹ; hỗ trợ responsive và reduced motion. Tương tác tab/chọn gói/form/FAQ hoạt động, form ghi rõ lưu trên trình duyệt.

Slide 14?19: ch? gi? icon Git ? 14, GitHub ? 15 v? 19, Git + VS Code ? 16?18. Icon 86px trong khung l?n c?n gi?a; ch? n?i dung 22px, t?n b??c 23px, ti?u ?? chi ti?t 30px. Slide 17 c? hai kh?i h??ng d?n/l?u ? c?ng h?ng v? khung l?nh/l?a ch?n c?i ??t ri?ng ch?y ngang ph?a d??i; c?u l?nh gi? tr?n m?t d?ng. Khung l?nh c? vi?n s?ng v? ?i?m s?ng chuy?n ??ng nh?, t?t khi reduced motion. To?n b? v?a canvas 1280?720 v? vi?n ch?nh EIU.
