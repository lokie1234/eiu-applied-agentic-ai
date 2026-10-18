## Slide 3 redesign · 18/10/2026

Bỏ mô phỏng giao diện; trình bày ba nhịp chữ “Mở dự án → Làm việc cùng AI → Kiểm tra ứng dụng” trên nền gradient navy với ánh sáng xanh-vàng và ký hiệu code mờ. Chuyển động nền và dấu phân cách thật nhẹ; tôn trọng `prefers-reduced-motion`.

## Cập nhật Section 1 · 18/10/2026

Section 1 hiện có 27 slide. Slide 3 là slide chữ tối giản trên nền navy, không mô phỏng giao diện; tôn trọng `prefers-reduced-motion`. Ở slide 4, vùng 06 dùng tên “Làm việc cùng AI” trên bản đồ và popup. Slide 15 có nút “Chạy nhiều dự án?” mở popup với một lệnh mẫu cho cổng 3001 và hướng dẫn đổi sang 3002 cho dự án tiếp theo; mỗi project chạy trong Terminal riêng. Slide 18 ghi rõ tốc độ tùy AI model, thời gian chờ thường gặp hơn ở free tier. Thêm slide summary bốn bước sau slide 18; icon đứng yên để ổn định khi điều hướng qua lại. Các slide hướng dẫn cũ dịch thêm một số nhưng giữ `layoutNumber` để không đổi popup và thao tác.

## Cập nhật Claude · 17/10/2026

Section 1 hiện có 26 slide. Slide 1: logo VS Code 76px ở hàng trên; Codex, Antigravity và Claude ở ba badge 30px riêng phía dưới, cách nhau 6px, nằm trọn trong khung 128px. Slide 4: sáu nút chỉ giữ số và tên, ô 6 mang tên Trợ lý AI; giữ nguyên hotspot và popup chức năng.

Slide 13: thêm Cài Claude cạnh Codex và Antigravity, ba cột bằng nhau. Claude chỉ gồm tìm Claude Code, kiểm tra nhà phát hành Anthropic, chọn Install; không thêm CLI hoặc đăng nhập. Giữ bước chung Ctrl+Shift+X và lưu ý phía dưới. Các card cao 266px, padding 22px 24px, logo 56px, tiêu đề 26px; căn đầu khung, hướng dẫn 20px ngắt theo bước.

Slide 6: tiêu đề “AI nào được tích hợp để làm việc trong VS CODE”; ba lựa chọn Claude, Antigravity, Codex xếp dọc trong cột 280px. Bảng chi tiết rộng bên phải, màu theo thương hiệu. GitHub Copilot và Cline nằm trong dải 12 logo chạy bên dưới, lặp hai nhóm liền mạch; tôn trọng reduced motion.

Slide 11 mới giới thiệu Claude sau Antigravity (9) và Codex (10), dùng chung logic và lưới aiBrandSlide: logo float, ba khung ưu điểm trái, ba họ model phải. Nền kem ấm, terracotta, mỗi ý một dòng; giữ Inter và reduced motion. Các slide sau tăng một số, giữ layoutNumber cũ để popup và thao tác không đổi. TSX, storyboard và renderer đồng bộ; binding và output tracing giữ nguyên.

## Gộp phần Effective Vibe Coding

Tối ưu hiệu năng: giữ nguyên nội dung 25 slide, bố cục và animation icon/bánh răng. Font Inter nhúng WOFF2 dùng chung cho cả slide AI/Lab, giữ đủ glyph và trục variable. Logo tối đa 256px, ảnh workspace giữ nguyên. CSS gắn theo layout; bỏ route quiz và CSS chức năng skill cũ. Nền popup không dùng backdrop blur; animation tên model chỉ dùng transform, không thay đổi blur/color/text-shadow theo từng frame. Các yêu cầu hiệu ứng lịch sử bên dưới được áp dụng trong giới hạn này.

Slide 25: mỗi repo có nút Cách cài đặt bên cạnh link GitHub. Popup riêng, nền kem, nêu môi trường/điều kiện, ba bước, nút copy cho lệnh, link tài liệu chính thức và link ứng dụng phù hợp. Penpot dùng Docker/PowerShell; Excalidraw cài thư viện trong React; shadcn/ui minh họa Next.js có Tailwind/alias; n8n dùng bộ cài Docker mới trong WSL (không dán vào PowerShell). Không chạy lệnh thật. Giữ icon float, hiệu ứng nút, Escape/backdrop/Tab trap và trả focus.

Slide 25 thay phần tự kiểm tra bằng repo nổi bật cho thiết kế và tự động hóa: Penpot, Excalidraw, shadcn/ui, n8n. Bốn khung kem 2×2, nhãn lĩnh vực, hai bullet chức năng và link repo chính thức. Logo lấy từ tài khoản GitHub chính thức, nhúng PNG trong TSX và ghi nguồn tại repo-icons/sources.json. Từng icon lơ lửng nhẹ 6.5–8s lệch pha, chỉ animate transform; chữ và khung đứng yên. Giữ hiệu ứng link/nút từ slide 22 và reduced motion. Không đưa số sao hay nhận định trending thời gian thực lên slide.

Slide 24 tối ưu nội dung: mô tả cách áp dụng không lặp ưu điểm; AI tự chọn dùng một đường dẫn chung cho hai công cụ. Popup project nói rõ bộ cài đã thêm AGENTS.md, mẫu rule chỉ dùng khi cài thủ công. Rút rule, không nhắc lại chức năng slide giới thiệu. Popup cài đặt dùng một luồng Terminal, bỏ tải ZIP trùng lựa chọn; mẫu gọi tên là tùy chọn khi cần. Giữ so sánh ba cách, đường dẫn global, copy và hiệu ứng nút.

Slide 23 mới: bỏ dải “Kết quả cụ thể, dễ kiểm chứng”. Bố cục hai cột: bên trái khối thương hiệu navy, logo GitHub trên kem, tên Effective / Vibe Coding lớn cùng bánh răng và cờ lê tự chuyển động; bên phải ba khung kem với sáu bullet thể hiện chức năng. Animation CSS nhẹ, chỉ xoay bánh răng/cờ lê và quét sáng dưới tên, không tương tác hoặc hàm ý có tác vụ AI chạy nền. Reduced motion dừng animation. Giữ nền full frame, font Inter và màu EIU.

Slide 23 giới thiệu ngắn: câu dẫn, ba nhóm chức năng (UI đồng bộ; kiểm tra/dọn code; hiệu năng/báo cáo) và quy trình kết quả. Hướng dẫn cài, repo/ZIP và mẫu gọi skill chuyển sang popup Cài đặt & sử dụng ở slide 24. Slide 24 giữ nguyên ba hàng so sánh nền kem cùng các popup Cách bật, thêm nút cài đặt phía trên; giữ copy, focus, Escape/backdrop và hiệu ứng nút. Bỏ slide chức năng riêng cũ; phần tự kiểm tra nay là slide 25. Quy tắc này thay thế các mô tả lịch sử về ba slide 23–25 dưới đây.

Slide 24: rà soát nội dung theo tài liệu chính thức. Phân biệt cơ chế AI tự chọn với phạm vi hướng dẫn project/global; không ngụ ý ba chế độ loại trừ nhau hoặc bảo đảm skill luôn được gọi. Popup hướng dẫn trực tiếp, bỏ câu nhắc slide khác và câu xem lại/kiểm tra hướng dẫn. Giữ ba khung kem và hiệu ứng nút đã duyệt.

Slide 23 trở đi: hiệu ứng nút đồng bộ slide 22. Nút liên kết, Cách bật, Đóng và tự kiểm tra nhấc 5px với viền/bóng vàng khi hover hoặc focus, nhấn xuống 2px. Nút copy dùng nguyên hiệu ứng copy chung của slide 22, giữ loading và xác nhận thành công. Không tooltip; reduced motion tắt chuyển động. Quy tắc này thay thế yêu cầu hover chỉ sáng trước đây.

# Mẫu thiết kế đã được người dùng chọn

Slide 8: popup Đặt tên và email có hai ô nhập, lệnh cập nhật trực tiếp và nút Sao chép. Chỉ bật copy khi đủ tên/email đúng định dạng; giữ dữ liệu khi chuyển qua lại bước Đọc lại cấu hình trong cùng popup. Lệnh dùng chuỗi literal PowerShell, escape dấu nháy đơn, giữ font Inter và khung kem–navy–vàng. Bước đọc lại cũng có nút copy. Focus trap tính cả input.

Slide 20: khung Nối địa chỉ repo có ô dán URL GitHub HTTPS, preview lệnh và copy theo URL vừa nhập. Không cho copy URL mẫu, URL khác host, có credential/query/hash hoặc sai cấu trúc. Mỗi lần chỉnh dữ liệu tạo snapshot copy mới, không để kết quả copy cũ bật lại nút khi dữ liệu hiện tại không hợp lệ. Không thực thi lệnh hoặc lưu thông tin ra ngoài.

## Full frame · áp dụng cho toàn bộ Section 1

Theo ảnh người dùng xác nhận: bỏ viền bao vàng–navy phía trong mép slide. Không dùng inset box-shadow làm khung ngoài ở gitIntroSlide hoặc shortcutSlide; nền phủ hết canvas 1280×720. Giữ khoảng cách nội dung, khung bài học, popup và nút. Quy tắc này thay thế các ghi chú lịch sử yêu cầu viền ngoài EIU bên dưới; không thêm một khung trang trí quanh toàn slide.

Slide 23 sau slide 22 Pull/Clone — “Effective Vibe Coding · cài một lần, dùng mỗi ngày”: dải repo GitHub và tải ZIP, hai lệnh Terminal có copy, hai ô gọi skill trong Codex/Antigravity cũng có copy. Theo chỉnh sửa mới: nút chỉ sáng lên bằng viền/bóng vàng và brightness khi hover/focus, không dịch chuyển, không tooltip hoặc title native. Bỏ câu dẫn phụ, chú thích cạnh lệnh và dòng phiên bản/công cụ; giữ hướng dẫn mở Terminal đúng project và tạo phiên AI mới. Clone skill sang folder bên cạnh rồi chạy installer với --target .; yêu cầu kỹ thuật giữ trong note nguồn. Giữ Inter nhúng và EIU kem–navy–vàng.

Slide 24 — “Tự áp dụng skill · chọn cách nào?”: thiết kế ba hàng ngang, số lớn bên trái, tên/cách áp dụng, hai cột ưu điểm/điểm cân nhắc và nút Cách bật bên phải. Hàng giữa navy–vàng, hai hàng bên kem, font và căn hàng đồng nhất. Bỏ câu dẫn, dải khuyến nghị trong ảnh và chú thích cuối popup. Tất cả nút chỉ sáng khi hover/focus, không tooltip. Popup giữ đường dẫn Codex/Antigravity IDE, mẫu rule có copy, đóng bằng nút/Escape/backdrop và giữ/trả focus. Nguồn và ghi chú giảng viên giữ trong dữ liệu.

Slide 25 giới thiệu sáu chức năng: font, layout, kiểm tra/sửa lỗi, giảm lag, dọn code dư và báo kết quả. Sáu khung kem 3×2, số navy–vàng, dải navy nêu cấu trúc báo cáo cụ thể. Không tab/popup; không ngụ ý skill chạy nền hay bảo đảm tự hết lỗi. Bài tự kiểm tra chuyển sang slide 26, layoutNumber 22 giữ nguyên.

Slide 16 hiện tại — “Vibe coding · nói điều bạn muốn đổi”: bỏ dải chú thích cuối slide. Giữ ba bước hướng dẫn, prompt mẫu và nút sao chép; phần ghi chú giảng viên vẫn lưu trong dữ liệu nguồn.

Slide 15 hiện tại — “Đổi text · tìm, sửa và xem ngay”: bỏ chú thích dưới ba khung và dải ghi chú cuối slide. Ba khung cao 360px, icon phía trên, tiêu đề một dòng, nhãn thao tác và mô tả căn hàng/căn giữa. Cả ba khung nền kem đồng nhất, tiêu đề navy và điểm nhấn vàng. Giữ Inter, viền EIU và hai tổ hợp Ctrl+Shift+F, Ctrl+S; không thêm ví dụ hay popup.

Slide chạy app (tiếp nối phần Ctrl+click người dùng gọi là slide 15): bỏ chú thích dưới hai khối lệnh và dải ghi chú/nghiệm thu cuối slide. Cân lại hai cột, lệnh và nút copy bên trái; trạng thái Ready cùng hai cách mở app bên phải. Giữ hướng dẫn chính và dòng Ctrl+click nổi bật.

Dòng “Giữ Ctrl và click vào http://localhost:3000” ở slide chạy app: bỏ “trong Terminal.”, căn giữa nội dung trên một hàng với khoảng cách đều, nền navy và viền vàng gọn. Ctrl dạng phím kem–vàng, localhost chữ trắng có gạch chân; giữ vị trí trong khung Ngay trong VS Code.

Dải Lumi Studio ở slide 13: lấy màu trực tiếp từ website mẫu — nền kem chuyển vàng nhẹ, cạnh nhấn vàng, “Lumi” navy và “Studio” vàng đậm. Nhãn nhỏ vàng đậm, mô tả navy trên một dòng; dùng grid với vùng mô tả co giãn và nowrap cho tên/câu mô tả, không ngắt dòng ngẫu nhiên.

Slide 13 hiện tại: bỏ cả ba chú thích dưới nội dung từng khung (tên file ZIP, chờ giải nén, chọn folder/package.json) và sơ đồ lặp lại phía dưới. “Lumi Studio” dùng chữ vàng 46px/850 trên dải navy, mô tả ngắn bên phải. Ba khung thao tác cùng cao 332px, icon/tiêu đề thẳng hàng, chữ 21px; nút tải ZIP thật vẫn có animation. Giữ font Inter và EIU kem–navy–vàng.

Slide 8 hiện tại: icon VS Code, Node.js, Git, GitHub và Terminal lơ lửng nhẹ theo chu kỳ 4 giây, lệch pha, dịch dọc từ +2px đến −3px và xoay ±0.6°. Chỉ icon chuyển động; khung, chữ và nút đứng yên. Tắt theo prefers-reduced-motion; icon trong popup không bị ảnh hưởng.

Slide 7 hiện tại: chữ trong sơ đồ phối hợp dưới cùng đổi thành đen, gồm tên công cụ, mô tả và nhãn Push/Pull. Nhãn Push dùng nền vàng nhạt để chữ đen dễ đọc; giữ icon, mũi tên và chuyển động.

## Slide phím tắt VS Code · 16/10/2026

Cập nhật 17/10/2026: cột hướng dẫn rộng 480px, tám ô phím tắt giữ hai cột và bốn hàng. Tên thao tác, tên Keyboard Shortcuts và đường menu giữ liền dòng; câu dẫn ngắt có chủ đích trước tên Keyboard Shortcuts. Hai bước dùng câu ngắn, giữ font Inter, nền kem, khung navy và phím vàng cùng animation hiện có.

Section 1 chèn một slide sau bản đồ vùng làm việc (slide 4). Slide 5 có tám phím tắt mặc định Windows và hướng dẫn mở Keyboard Shortcuts bằng Ctrl+K rồi Ctrl+S, tìm lệnh, đổi phím và đường menu. Theo chỉnh sửa tiếp theo: bỏ link trong slide; dùng đúng Inter nhúng cho cả tiêu đề, mô tả và phím. Tiêu đề navy 36px/800, gạch vàng, nền kem lưới nhẹ và viền EIU. Tám ô chia hai cột, bốn hàng bên trái; khung hướng dẫn navy bên phải. Các tổ hợp phím lơ lửng chậm chu kỳ 3–3.6 giây, lệch nhịp; khung và mô tả đứng yên. Tắt animation theo prefers-reduced-motion. Không footer. Các slide sau tăng số thứ tự; `layoutNumber` giữ định danh bố cục cũ để popup, nút và CSS hiện có không đổi hành vi. TSX, storyboard và renderer đồng bộ; binding và output tracing giữ nguyên.

## Chỉnh bộ slide VS Code · 15/10/2026

Slide 21 giữ nội dung Pull/Clone hiện tại, thêm nút Sao chép dưới khối lệnh trong cả ba popup. Dùng chung localCopyButton: icon/hover/loading/xác nhận, Clipboard API và fallback ẩn, không bôi xanh lệnh. Đã kiểm thử nội dung copy của ba popup, kiểm tra không tràn hoặc cuộn ngoài ý muốn.

Popup slide 19 bỏ đoạn giải thích giữ repo trống và câu bấm Create repository theo yêu cầu; footer chỉ giữ nút mở trang tạo repo, căn phải.

Slide 17–20 bỏ toàn bộ chú thích dưới từng khung và dải ghi chú cuối slide. Thu khung còn khoảng 320px, tăng cỡ mô tả và cân lại vùng lệnh/copy. Slide 17 dùng hai khung lệnh và một hàng hỗ trợ AI gọn bên dưới. Slide 19 gộp hai nút thành Hướng dẫn, mở popup có đường dẫn tạo repo bên trong. Đã kiểm tra cả bốn slide không tràn và popup còn hoạt động.

Slide 19 thêm riêng popup hướng dẫn trong khung Tạo repository, qua nút Cách điền các trường. Hai cột General/Configuration theo ảnh: Owner, Repository name mẫu, Description tùy chọn, Public/Private, README Off, No .gitignore, No license. Nêu lý do giữ repo trống và bấm Create repository trên GitHub; có liên kết mở trang tạo. Popup đóng bằng nút/Escape/click nền, giữ focus. Đã kiểm tra popup và slide không tràn, các trường và liên kết đúng.

Slide 17–20 đưa toàn bộ nội dung ra ngoài, không popup. Mỗi slide ba khung tĩnh: việc cần làm, lệnh ngắn có copy/loading/thành công, dấu hiệu hoàn tất. Rút nội dung theo hướng vibe coding: kiểm tra và nhờ AI sửa lỗi; lưu mốc Git; tạo/nối/Push GitHub; cập nhật sau mỗi lần sửa. Dùng npm.cmd trên Windows; URL_REPO là chỗ thay địa chỉ repo thật. Giữ lưu ý .gitignore và repo trống, bỏ giải thích Git nâng cao. Đã kiểm tra cả bốn slide không tràn, tiêu đề gọn và lệnh hiện đủ.

Tiêu đề ba khung slide 16 rút gọn: Kết quả có thể khác / Tự sửa lỗi tùy model / AI vẫn có thể sai. Font 25px, giãn chữ −0.4px, giữ một dòng; đã kiểm tra không tràn và các tiêu đề thẳng hàng.

Slide 16 rút thành thông tin để biết: kết quả không cố định, khả năng tự sửa khác nhau, AI vẫn có thể sai. Ba khung tĩnh với icon khái niệm, không popup/nút và không giao việc test hoặc so sánh model. Nội dung hiện trực tiếp, font 21px; đã kiểm tra bố cục vừa khung.

Slide 14 bỏ tất cả ví dụ, cả dải trước/sau và ví dụ trong nội dung; ba khung căn cùng hàng icon 64px, nhãn phím/thao tác và mô tả ngắn. Icon bước cuối là cửa sổ refresh rõ nghĩa. Slide 11 ghi mở Codex bằng click icon trong vùng chat. Copy prompt slide 15 dùng chung localCopyButton: copy qua Clipboard API/textarea ẩn, không bôi xanh prompt, loading rồi xác nhận thành công. Đã kiểm thử đúng nội dung được sao chép và vùng prompt không bị chọn; kiểm tra slide 11/14/15 không tràn.

Slide 14 đổi sang sửa text trực tiếp: Ctrl+Shift+F tìm đoạn chữ, mở kết quả/sửa, Ctrl+S lưu rồi refresh localhost. Ba khung tĩnh và ví dụ Lumi Studio → Light Lab, không popup. Slide 15 chuyển thành hướng dẫn vibe coding: mô tả ý tưởng → gửi yêu cầu rõ → xem app/phản hồi. Prompt ngắn hiển thị trực tiếp, có copy, để AI tự tìm file thay vì yêu cầu người học hiểu component. Nội dung nhấn giữ tính năng hiện tại và tự kiểm tra. Đã render hai slide: toàn bộ nội dung vừa khung, prompt không cần cuộn, kiểm thử đều đạt.

Slide 13 đổi hướng dẫn mở ngay trong VS Code thành giữ Ctrl và click http://localhost:3000 trong Terminal theo yêu cầu, bỏ View → Browser.

Slide 13: mũi tên hướng dẫn Terminal và View → Browser chuyển ngang theo nhịp 1.4s, lệch pha và sáng nhẹ; mũi tên nút mở trình duyệt chuyển chéo lên phải. Chỉ animate mũi tên, không di chuyển chữ/bố cục. Reduced motion giữ tĩnh.

Slide 13 bỏ nội dung mở localhost trùng ở footer. Bước 3 tập trung một khung: URL Local/Ready dùng chung, bên dưới hai lựa chọn Trình duyệt trên máy (Chrome/Edge/Cốc Cốc, nút mở) hoặc Ngay trong VS Code (View → Browser). Footer chỉ còn nghiệm thu nhanh và lưu ý dữ liệu/cổng. Giữ lệnh và nút copy ở cột trái. Đã kiểm tra bố cục đủ nội dung, không tràn.

Các nút Sao chép dùng chung diện mạo có thể bấm: icon hai tờ giấy, nền vàng chuyển sắc, cạnh dưới dày và bóng nổi, glow nhẹ; hover nhấc, nhấn lún, focus rõ và con trỏ pointer. Trạng thái loading có spinner, thành công chuyển xanh và hiện chữ xác nhận; thêm tooltip/aria-live. Áp dụng cho copy lệnh slide 7/13 và prompt. Đã kiểm tra bố cục slide 13, giữ thao tác copy thực tế.

Slide 13 thêm hai cách mở localhost ở dải dưới: Chrome/Edge/Cốc Cốc bằng thanh địa chỉ, hoặc trong VS Code qua View → Browser rồi nhập URL. Giữ nút mở app và lưu ý cổng/server. Đối chiếu https://code.visualstudio.com/docs/debugtest/integrated-browser . Cân gọn các khung Terminal để cả hai cách mở hiện đủ, không tràn.

Slide 12 đơn giản hóa cho người học vibe coding: chỉ tải mẫu → giải nén → mở VS Code; bỏ bản đồ component và các file kỹ thuật. Icon ZIP đổi thành chồng sách tím/xanh dương/xanh lá với đai khóa. Khung tải glow mạnh; nút tải nhấc/scale 1.035, ánh sáng lướt 2.2s và mũi tên nảy 1.1s. Reduced motion tắt chuyển động. Ba khung cao 340px, nội dung 21px và lưu ý 18px; đã kiểm tra vừa bố cục.

Slide 12–13 thành luồng thực hành liên tục, không popup. Slide 12 gom chuẩn bị: tải/giải nén ZIP, mở folder có package.json, nhận diện file nội dung/giao diện (chuyển bản đồ file từ slide 13). Slide 13 gồm hai bước Terminal bên trái (npm.cmd install, npm.cmd run dev, có copy/loading/thành công) và bước mở bản thử nghiệm bên phải. Hiện mẫu Local/Ready, nút nổi bật mở http://localhost:3000 trong tab mới, lưu ý server phải chạy và dùng URL Local thực tế nếu cổng bận. Giữ hướng dẫn thử tính năng và giới hạn form lưu trên trình duyệt. Đã kiểm tra cả hai slide không tràn, download ZIP và copy lệnh hoạt động.

Slide 12 bỏ toàn bộ popup, hiển thị đầy đủ thao tác/lưu ý trong ba khung kem cao 410px. Có icon file ZIP ở phần tải và flow, nút tải trực tiếp giữ nguyên tệp ZIP và hiệu ứng sáng nhẹ. Nội dung chính 19px, lưu ý 17px; đã kiểm tra hiển thị toàn bộ, không tràn canvas.

Slide 11 tách Ctrl+Shift+X khỏi hai khung AI thành bước chung Mở Extensions phía trên. Bỏ flow cũ phía dưới; thứ tự nội dung: bước chung → hai hướng dẫn cài → lưu ý. Phím tắt nhấn nhá mạnh bằng scale/nhấc lệch nhịp 1.8s, logo VS Code lơ lửng 2.4s, mũi tên chạy 1.3s và viền glow 2.2s; reduced motion giữ tĩnh. Đã kiểm tra khung và chữ vừa canvas.

Slide 11 bỏ Xem chi tiết và thao tác mở popup của hai khung cài AI. Mỗi khung hiển thị trực tiếp ba dòng: tìm đúng extension/nhà phát hành, Install và mở icon, đăng nhập. Hai khung là nội dung tĩnh, giữ lưu ý nổi bật phía dưới. Đã kiểm tra từng ý một dòng, vừa khung 250px.

Slide 11 bỏ khung Kiểm tra sau cài đặt, còn hai khung Codex/Antigravity cân đôi. Thêm lưu ý navy–vàng/glow: trong phiên thực hành, chỉ một trợ lý/model sửa project tại một thời điểm; nhiều agent ghi cùng file có thể ghi đè thay đổi hoặc xung đột. Đây là khuyến nghị cho workspace chung, không khẳng định đổi model tuần tự gây lỗi. Nguồn đối chiếu: https://learn.chatgpt.com/docs/environments/git-worktrees (isolation cho các lượt chạy song song). Hai khung cao 250px, flow 78px, note có khoảng trống dưới và không tràn canvas.

Sửa font: nhúng Inter variable đầy đủ tiếng Việt vào TSX qua build script, lấy từ Google Fonts (OFL lưu kèm trong fonts/). Không phụ thuộc font cài trên máy hoặc tải mạng trong iframe. Đồng bộ font nút với nội dung, dùng weight thật thay chữ đậm giả. Đã xác nhận font loaded và slide 7/popup không tràn khung.

Khung cuối slide 7 đổi thành dải navy viền vàng/glow, title “Kiểm tra phiên bản”, chú thích “Mở Terminal trong VS Code”. Hai nút Mở kiểm tra / Đã kiểm tra xong (cấu hình tên/email Git) đứng cạnh nhau ngoài popup. Popup dùng khối pre thay textarea hiển thị lệnh, giữ nút copy và loading; đã kiểm tra toàn bộ nội dung không tràn, không thanh cuộn hoặc resize (cao 524px).

Slide 7: popup chỉ có một nội dung không hiện thanh bước dư. VS Code/Node.js/Git chỉ tải và cài, bỏ câu nhắc đóng/mở lại VS Code và chuyển slide; GitHub chỉ đăng ký tài khoản. Chuyển hai bước đặt tên/email Git và đọc lại cấu hình sang popup cuối, mở bằng nút “Đã kiểm tra xong → Cấu hình tên/email Git” trong phần kiểm tra phiên bản. Giữ thứ tự cài → kiểm tra phiên bản → cấu hình Git, popup vừa khung và luồng điều hướng đã kiểm thử.

Popup kiểm tra slide 7: lưu ý tăng từ 14px lên 18px/600, nền kem vàng và viền/glow nhịp 3s, không dịch chuyển bố cục; reduced motion giữ tĩnh. Nút sao chép có spinner/Đang sao chép 450ms rồi Đã sao chép, ưu tiên Clipboard API, fallback textarea ẩn và khôi phục focus; không chọn khối lệnh đang hiển thị. Chỉ báo thành công khi thao tác copy thành công. Kiểm tra popup cao 524px, không tràn/cuộn, và kiểm thử nội dung clipboard/trạng thái loading/thành công đều đạt.

Ba popup VS Code/Node.js/Git ở slide 7 đồng bộ bố cục gọn của GitHub: nội dung ngắn, hướng dẫn và lưu ý rõ, cột lệnh đủ rộng. Cả bốn link tải/đăng ký dùng nút navy–vàng, nhấc nhẹ và glow chu kỳ 3s, vệt sáng lướt, mũi tên chéo chuyển động 1.5s; hover/focus tăng nhấn mạnh. Reduced motion giữ tĩnh. Đã kiểm tra tám bước popup không tràn hoặc cuộn và cả bốn link có animation.

GitHub trong slide 7 rút gọn ba bước: tài khoản, kết nối, xác thực khi cần. Bỏ link đăng nhập và hướng dẫn xác thực HTTPS, giữ link đăng ký. Popup rộng 1120px, nội dung 21px, lưu ý 18px; phần có lệnh chia cột 0.8:1.2 và code 15px để lệnh kết nối nằm gọn một dòng. Phần không có lệnh dùng toàn chiều rộng cho mô tả/lưu ý.

Slide 7: ba popup VS Code/Node.js/Git tập trung tải và cài, giữ cấu hình tên/email Git. Bỏ các bước kiểm tra phiên bản rời; thêm nút lớn cuối slide mở kiểm tra chung trong Terminal PowerShell. Popup có khối lệnh code/node/npm.cmd/Git/GCM, nút sao chép với fallback Ctrl+C và cột kết quả mẫu; phiên bản chỉ minh họa. Giữ nguyên ba phần nội dung GitHub. Đã kiểm tra popup gọn trong canvas và thao tác sao chép. Nguồn cài đặt: https://code.visualstudio.com/docs/setup/windows ; https://nodejs.org/en/download ; https://git-scm.com/install/windows .

Slide 11–21 áp dụng logic slide 6: ba khung kem cao 300px, hover nhấc nhẹ, mở popup khi bấm. Bỏ toàn bộ dải chọn app Git/VS Code/GitHub; icon nằm tại bước dùng app, các khái niệm prompt/model dùng số bước. Mỗi khung có hai ý tóm tắt trọn nghĩa; flow cuối slide gồm ba bước. Popup rộng 1120px, thao tác và lưu ý/lệnh chia hai cột, chữ 21px, code 17px; giữ đủ lệnh, ZIP và prompt sao chép. Có đóng bằng Escape, click nền và giữ focus trong popup.

Slide 11 tập trung cài Codex của OpenAI và Google Antigravity từ Extensions trong VS Code, đăng nhập rồi kiểm tra trên project. Bỏ link tải trực tiếp và phần giải thích công cụ/model cũ. Đối chiếu nguồn chính thức: https://learn.chatgpt.com/docs/codex/ide và https://antigravity.google/docs/ide/extensions/vscode/ (chỉ lưu nguồn ở đây). Kiểm tra cả 11 slide và 33 popup sau khi tải font: không tràn ngang, popup không cuộn ngoài ý muốn; 31 kiểm thử chức năng và binding đều đạt.

Footer slide 7 bỏ nhãn CÀI THEO THỨ TỰ. Windows nằm bên trái vạch chia; bốn logo chia đều toàn bộ vùng bên phải. Mũi tên 48px chuyển động ngang −5px đến +6px, sáng theo nhịp 1.8s và lệch pha 0.25s; reduced motion giữ tĩnh.

Slide 7: bỏ vùng Terminal/PowerShell ở footer. Khung cuối cao 106px, gồm Windows và thứ tự cài đặt trên một hàng; logo ứng dụng 52px trong ô 60px, Windows 42px, chữ Windows 23px, nhãn thứ tự 17px và mũi tên 32px. Đã kiểm tra render vừa khung, khoảng cách đều.

Slide 7: dải thứ tự cài đặt cuối slide thay bốn tên ứng dụng bằng logo VS Code → Node.js → Git → GitHub, logo 34px trong ô 40px. Giữ tooltip/tên truy cập, mũi tên và hai vùng Windows/PowerShell.

Slide 6 bỏ nhãn Chiều đi / Chiều về và cột nhãn riêng. Hai hàng flow chiếm trọn chiều rộng khung, bốn ứng dụng thẳng cột, giữ đường phân cách và mũi tên Push/Pull.

Slide 6: flow hai chiều gồm bốn cột VS Code–Node.js–Git–GitHub, mỗi ứng dụng có icon và mô tả ngắn. Mũi tên nối tăng lên 38px, mũi tên trong Push/Pull 34px; giữ hiệu ứng nhấn mạnh Push/Pull. Tên ứng dụng tách khỏi mô tả để bốn cột vừa khung.

Slide 7: bốn khung cài đặt cùng nền kem, lưới 2×2 cao 196px mỗi khung; logo 84px nằm bên trái tên, mô tả ngắn và nút mở hướng dẫn. Dải hướng dẫn dưới chia ba vùng Windows / thứ tự VS Code → Node.js → Git → GitHub / PowerShell, không dùng một câu dài. Đã kiểm tra bản render không tràn khung và còn lề dưới 45px.

Sơ đồ cuối slide 6 gồm hai hàng đồng bộ có nhãn Chiều đi / Chiều về. Cả hai hàng dùng ba icon Node.js–Git–GitHub và mô tả ngắn, cùng vị trí cột; chiều đi mũi tên sang phải, chiều về sang trái. Bỏ dải mô tả navy một câu cũ. Nhấn Push bằng badge navy–vàng, Pull bằng badge xanh sáng: glow theo nhịp 2.8s, vệt sáng lướt và mũi tên chạy đúng hướng 1.6s. Hiệu ứng chỉ trang trí, không phải nút mới. Reduced motion giữ tĩnh. Đã kiểm tra không tràn và còn lề dưới.

Ba logo lớn ở slide 6 lơ lửng mức vừa: dịch dọc từ +4px đến −7px, xoay ±2°, chu kỳ 4.4s và lệch nhịp. Chỉ áp dụng logo trong ba khung chọn, không áp vào chữ, khung, sơ đồ hoặc popup; reduced motion tắt hiệu ứng. Đã kiểm tra không đè tên ứng dụng suốt chu kỳ.

Slide 6 bỏ ba nhãn “Mở nội dung…” bên trong nút chọn, giữ toàn bộ khung là nút mở popup và hiệu ứng hover. Ba khung kem cao 300px, logo 96px căn giữa phía trên tên 32px; mô tả gồm hai dòng trọn ý 20px, không ngắt vụn. Định nghĩa trong popup rút ngắn và cân thành hai dòng; mỗi chức năng chính nằm một dòng. Đã kiểm tra cả ba popup không cuộn/tràn, slide setup vẫn giữ nhãn cài đặt riêng.

Slide 5: đặt bốn nút Antigravity/Copilot/Claude Code/Cline vào lưới 2×2 bên trái, cùng phần nội dung bên phải trong một khung chính bo góc. Root cao 558px, main flex chiếm phần còn lại sau marquee 72px và gap 14px; main padding 18px, cột trái 400px, gap 20px. Nội dung AI cao bằng vùng chọn, header 148px, phía dưới hai khung Ưu điểm / Điểm cần cân nhắc màu theo AI. Font nội dung 17px, title nút 20px, logo 78px vẫn lơ lửng. Marquee nằm gọn trong chiều rộng chính, không tràn mép canvas. Đã kiểm tra cả bốn lựa chọn: giữ đúng nút khi đổi nội dung, không tràn/cắt chữ.

Slide 6 rút gọn theo yêu cầu mới: mỗi ứng dụng chỉ có hai khung trong popup — Định nghĩa (một câu ngắn) và Chức năng chính (ba bullet ngắn), bỏ toàn bộ link, hướng dẫn chi tiết và khối nội dung phụ. Popup tối đa 1080px, hai cột tỷ lệ 0.9:1.2, gap 22px, khung cao tối thiểu 264px; định nghĩa 23px, bullet 21px. Đã kiểm tra cả ba popup không cuộn hoặc tràn, giữ ba khung chọn ngoài màu kem.

Slide 4: vòng xuất hiện khoanh đỏ lặp vô hạn theo chu kỳ 7s. Cả sáu nhóm dùng chung mốc thời gian: lần lượt 1→6 trong 4s đầu, giữ đủ sáu vùng, cùng mờ đi cuối chu kỳ rồi bắt đầu lại từ 1. Reduced motion hiển thị đủ sáu vùng ngay. Slide 6: cả ba khung chọn Node.js/Git/GitHub nền kem, tiêu đề navy; mỗi popup ba nhóm, mỗi nhóm ba bullet chỉ tập trung vào ứng dụng đang chọn, bỏ các đoạn so sánh/nhắc ứng dụng khác. Giữ slide setup riêng và thao tác popup/hover hiện có.

Slide kết quả đầu ra (slide 2): bốn nhãn DỰ ÁN, CHẠY THỬ, COMMIT · PUSH, PULL REQUEST đồng bộ chữ in hoa 14px/800, khung 188×54px, nền kem–vàng và icon 27px cùng vị trí. Dùng hai cột cố định cho icon/nhãn, căn giữa chữ; không nhấn animation riêng nhãn thứ hai. Đã kiểm tra cả bốn nhãn không tràn chữ.

Khung số 4 ở bản đồ slide 4 đổi tên thành “Trình soạn thảo”, phụ đề “Editor · các tab ở giữa”, để không trùng cách gọi trong tiêu đề slide. Giữ nguyên tọa độ, popup và hiệu ứng xuất hiện.

Slide 4: sáu vùng khoanh đỏ xuất hiện lần lượt 1→6 khi mở slide. Mỗi nhóm gồm đường khoanh, vòng tròn số và chữ số cùng fade-in 0.5s; bắt đầu sau 0.25s, các vùng cách nhau 0.65s, hoàn tất ở giây 4. Không dịch vị trí hoặc lặp lại animation khi đóng popup. Giữ các khung tên vùng và tương tác sẵn có. Reduced motion hiển thị đủ sáu vùng ngay.

Icon slide 3 lơ lửng trung bình: riêng bảy icon công cụ trong sáu bước dịch dọc từ +3px đến −6px, xoay ±2°, chu kỳ 4s lệch nhịp. Không áp animation lặp cho khung, chữ hoặc số bước; tránh animate kép ảnh bên trong gitMark. Reduced motion tắt hiệu ứng. Đã kiểm tra cả chu kỳ không đè tiêu đề.

Tăng hiệu ứng tên model slide 8–9: chữ đậm 700, Antigravity chuyển sắc nhanh hơn (2.8s), phóng 6% và nhấc 3px theo chu kỳ 3.2s, thêm glow xanh–tím và gạch chân sáng co/giãn. Codex phóng 5.5%, ánh mint rõ hơn tới gần trắng, gạch chân neon và cursor 10×26px sáng theo chu kỳ 1.6s. Các dòng lệch nhịp để dễ nhận biết; không thay kích thước bố cục. Đã kiểm tra chuyển động không đè mô tả hoặc cursor. Reduced motion tắt cả hiệu ứng tên và gạch chân.

Cột trái slide 8–9: tiêu đề hero 52px trên hai dòng có chủ đích, mô tả ngắn một dòng. Ba mục 01–03 nằm trong ba khung riêng khoảng 100px, gap 10px; badge số 34px, tiêu đề 19px một dòng và hai ý mô tả 17px trên hai dòng riêng, không ngắt câu tùy tiện. Antigravity dùng khung trắng/xanh–tím, viền trái lavender; Codex dùng khung graphite, viền và badge mint. Giữ logo lơ lửng và animation model. Đã kiểm tra sau khi tải font: từng tiêu đề/ý đều đúng một dòng, không tràn, lề dưới 63px.

Cập nhật logo slide 8–9: phóng từ 52px lên 88px, header cao 96px, cách tên AI 30px. Logo lơ lửng mạnh theo chu kỳ 4.8s/5.2s: dịch dọc từ +10px đến −16px, lệch ngang tối đa 8px, xoay −5° đến +7°. Không animate tên hoặc cả header. Main cách header 20px; hai slide còn lề dưới 68px. Đã kiểm tra 261 thời điểm trong chu kỳ: logo không đè tên hoặc tiêu đề nội dung. Tắt chuyển động khi reduced motion.

Slide 8–9 theo yêu cầu mới dùng phong cách riêng của AI, không còn khung EIU: Antigravity trắng lạnh, ánh xanh/tím và nét bốn màu; Codex graphite, chữ trắng, điểm nhấn mint và monospace. Bố cục toàn slide 1280×720: logo/tên trên, ưu điểm bên trái, model bên phải. Giữ khoảng trống dưới ít nhất 40px sau khi font tải xong, không cuộn hoặc cắt nội dung. Nội dung/model và điều kiện theo nguồn chính thức ngày 15/10/2026: Antigravity Gemini 3.8 Flash, Sonnet/Opus 5.5 Thinking và Gemini 4 Argon; Codex GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna. Theo yêu cầu mới nhất, bỏ toàn bộ link, dòng MODEL SNAPSHOT / 15.10.2026 và tiêu đề Một số model đang có khỏi hai slide. Hai cột cân giữa theo chiều cao, khung model tối thiểu 492px; bản render có lề dưới 80px. Tên model Antigravity 26px chuyển sắc xanh–tím và nổi nhẹ lệch nhịp; Codex monospace 26px ánh mint theo nhịp, có cursor terminal mờ/sáng chậm. Reduced motion giữ tên tĩnh. Không quay về hai tab ưu/nhược điểm hoặc áp viền navy–vàng cho hai slide này.

Nguồn kiểm chứng (chỉ lưu ở tài liệu thiết kế, không nhúng link vào slide): https://www.antigravity.google/docs/models/ ; https://www.antigravity.google/docs/ide/extensions/vscode/ ; https://learn.chatgpt.com/docs/models ; https://learn.chatgpt.com/docs/ide .

Sau slide 9 (Codex), chèn slide chuyển phần số 10: “Lab 3” và “Thực hành thiết kế website và đẩy mã nguồn lên GitHub.” Theo ảnh mẫu Lab: nền navy xanh, khung lớn bo góc viền vàng mờ, nhãn AI-POWERED WEB DEVELOPMENT màu vàng, tiêu đề trắng lớn, mô tả xám sáng, vòng tròn đồng tâm góc phải và đường cong nét đứt. Không thêm header/footer. Các slide 10–21 cũ thành 11–22; section hiện có 22 slide.

Slide Lab 3 có chuyển động liên tục: vòng nét đứt xoay chậm, các vòng đồng tâm co giãn lệch nhịp, đường cong chạy nét đứt, vòng dưới và điểm sáng trôi nhẹ. Chữ Lab 3 phóng nhẹ 2.5%, phát ánh vàng và có gạch chân sáng theo chu kỳ 4.2 giây. Nhãn và mô tả xuất hiện nhẹ khi mở slide. Tắt toàn bộ animation khi prefers-reduced-motion, giữ nội dung và điểm nhấn tĩnh.

Người dùng xác nhận bộ slide VS Code trong `Section1.tsx` là bộ được gọi là section 2 trong yêu cầu này. Giữ binding đã đăng ký trong `course-content/sources.json`.

Slide 1: bốn cụm VS Code, Node.js, Git và GitHub cùng xoay trên vòng tròn bán kính 170px, cách nhau 90°. Phóng mỗi khung icon lên 128px; logo Node.js/Git/GitHub 96px, nhãn 22px. Trong khung VS Code dùng lưới hai hàng: VS Code chính 76px phía trên, Codex và Antigravity phụ 24px trong hai badge 30px phía dưới, cách hàng trên 8px. Không dùng định vị chồng logo. Hai AI không có quỹ đạo hoặc nhãn ngoài riêng. Counter-rotate giữ cả cụm và nhãn thẳng; reduced motion giữ bốn vị trí. Đã kiểm tra 180 vị trí trong vòng xoay: các cụm và ba logo không chồng nhau, logo không tràn khung.

Slide 2: cả bốn khung nền kem, giữ timeline, icon navy–vàng và nhãn thao tác. Slide 3: cả sáu khung quy trình nền kem, tiêu đề navy và mô tả xanh xám. Slide 4: sáu nút tên vùng bên phải nền kem, tiêu đề navy, giữ badge navy–vàng và hành vi popup.

Slide 4: rê chuột vào khung tên vùng làm riêng khung đó sáng viền vàng, đổi nền kem ấm, tăng bóng và nhích nhẹ lên/trái; badge số đổi sang nền vàng chữ navy. Áp dụng cùng dấu hiệu cho focus bàn phím, có phản hồi khi nhấn. Chuyển tiếp 200ms; reduced motion tắt chuyển tiếp và dịch chuyển, giữ phản hồi màu/viền.

Slide 6–7: các khung mở popup có hover/focus tương tự: sáng viền vàng, tăng bóng, nhích lên 3px và phủ ánh vàng nhẹ; nhãn mở nội dung đổi sang nền vàng chữ navy. Giữ nền kem/navy và màu chữ của từng khung. Khi nhấn hạ khung nhẹ; reduced motion giữ dấu hiệu màu/viền, tắt chuyển tiếp và dịch chuyển.

Slide 6 chỉ giới thiệu vai trò Node.js, npm, Git và GitHub cùng cách phối hợp, không chứa khối lệnh thực hành. Slide 7 giữ thiết kế bốn khung chọn và popup, chia rõ tải/cài và kiểm tra trong Terminal VS Code. Lệnh nhập và ví dụ kết quả đạt nằm riêng; phiên bản, mã commit, kiến trúc và đường dẫn được ghi rõ là minh họa. Có hướng xử lý PATH, npm.ps1 và Git Credential Manager. GitHub dùng trình duyệt; kiểm tra repo public chỉ chứng minh kết nối, xác thực quyền repo thực hiện khi Push/Clone private.

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
