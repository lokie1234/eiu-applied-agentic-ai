# Phát triển và triển khai ứng dụng web với AI

Bản chờ review cho course **AI-Powered Web App Development & Deployment**. Chưa commit/push Git.

- `Section1.tsx`: 40 slides; slide 14–21 giới thiệu ngắn, tải/cài Git, đăng ký GitHub bằng Google, kiểm tra và setup Git/GCM trong Terminal VS Code; 22–24 tạo repo web và Clone bằng lệnh; 25–33 chạy/chỉnh website ZIP; 34–39 Init/Add/Commit, kết nối repo trống, Push/Pull bằng lệnh và đối chiếu nhánh; 40 tự kiểm tra. Không cài extension GitHub. Xem [GIT_GUIDE.md](GIT_GUIDE.md).
- `Section2.tsx`: 20 slide, lưu trữ dữ liệu/tài liệu và triển khai, 180 phút.
- `storyboard.json`: nội dung hiển thị, mục tiêu, thông điệp, ghi chú giảng viên, thời lượng, tiêu chí kiểm tra và 10 prompt tiếng Việt.
- `renderer.tsx.txt`: mã dựng giao diện EIU DNA và các hoạt động tương tác.
- `assets.json`: logo nhúng trong file, không cần tải ảnh ngoài khi mở slide.

Hai file TSX độc lập: mỗi file chỉ chứa nội dung của phần tương ứng, có sẵn giao diện, hiệu ứng và ảnh nhúng. Màn hình của course này đọc trực tiếp hai TSX trong project qua API nội dung section. Chỉnh TSX rồi mở lại section hoặc refresh để tải bản mới; không cần cập nhật Drive. API vẫn kiểm tra đăng nhập và quyền course trước khi đọc file. Bản download cũng dùng cùng TSX local.

Slide đã bỏ header thương hiệu, footer, số trang, nhãn thời lượng, bảng ghi chú giảng viên và các chú thích phụ. Mục tiêu/ghi chú vẫn nằm trong dữ liệu nguồn để chỉnh sửa; trên slide giữ nội dung bài học, thông điệp chính và hướng dẫn cần cho tương tác.

Quy chuẩn cho các lần thiết kế tiếp theo nằm trong [DESIGN.md](DESIGN.md), theo ảnh SAVE / SHARE / USE người dùng chọn. Slide 1 giữ cover trắng–vàng trên nền navy; slide 2 có số và timeline ngoài khung, icon navy–vàng, tiêu đề viết hoa, mô tả gọn và nhãn thao tác bên phải. Khung thứ hai được nhấn nền navy.

Slide 2 Section 1 không hiển thị dòng tổng kết “Sản phẩm đạt yêu cầu…”. Bốn khung được cân theo bố cục; đường nối có chuyển động nhẹ và khung được nhấn có điểm sáng tiết chế.

Nếu chỉnh nội dung hoặc giao diện trong JSON/renderer thay vì chỉnh TSX trực tiếp, tạo lại riêng phần cần sửa:

```powershell
node scripts/build-web-app-course.cjs 1
node scripts/build-web-app-course.cjs 2
```

Lệnh tạo lại sẽ ghi đè file TSX tương ứng bằng nội dung từ JSON/renderer. Không chạy lệnh này sau khi sửa TSX trực tiếp nếu chưa chuyển thay đổi về nguồn tạo. File tổng hợp 45 slide đã được bỏ để tránh nhầm bản chỉnh sửa.

Hai section có file đính kèm trên Drive, nhưng nguồn hiển thị và download hiện ưu tiên TSX trong project theo đúng ID course và ID của hai section, không phụ thuộc tên hiển thị hoặc tên file trên Drive. Hai section vẫn ẩn để giảng viên review bằng **View** trong admin. Chưa mở cho học viên. TSX hiển thị trong sandbox hiện có, không phụ thuộc React hooks, không gọi API ngoài. Hoạt động trong slide là mô phỏng/tự kiểm tra; không ghi điểm quiz hoặc bài làm vào database.

Slide mở đầu của hai phần dùng nền navy và vàng theo Applied Agentic AI: phần 1 có logo VS Code/Git/GitHub lớn, phần 2 có Google Drive/Supabase/Vercel; icon chuyển động nhẹ và tắt chuyển động khi người xem bật giảm chuyển động. Slide 2 phần 1 trình bày bốn kết quả đầu ra có minh chứng. Nội dung 25 slide phần 1 tập trung vào tính năng VS Code, quản lý phiên bản bằng Git và cộng tác bằng GitHub.

Tương tác gồm: khám phá 14 tính năng VS Code/Git/GitHub, Commit/Push/Pull mô phỏng, 7 câu tự kiểm tra, bảng dữ liệu mô phỏng, phân loại lưu trữ, phân quyền, lỗi build/triển khai, checklist thực hành và lựa chọn công cụ cho ý tưởng cá nhân. Slide 5 là quy trình cố định sáu bước có mũi tên chuyển động, không còn bài sắp xếp. Prompt có nút sao chép; nếu trình duyệt không cho sao chép trong sandbox, nút chọn nội dung và hướng dẫn Ctrl+C.

Đã kiểm tra 45 slide trong sandbox trình duyệt: không có lỗi JavaScript, ảnh hỏng hoặc nội dung chồng lên thông điệp. Đã thử kéo thả và các thao tác chính. TypeScript và 151 regression tests đều đạt. Thời lượng cộng đúng 180 phút mỗi phần. Nội dung không nêu quota/giá cố định của dịch vụ.

Các điểm kỹ thuật được đối chiếu với tài liệu chính thức: [Git trong VS Code](https://code.visualstudio.com/docs/sourcecontrol/overview), [loại khóa Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [bảo vệ dữ liệu và RLS](https://supabase.com/docs/guides/database/secure-data), [triển khai Git trên Vercel](https://vercel.com/docs/git), [biến môi trường](https://vercel.com/docs/environment-variables).

Nguồn cho nội dung Section 1 mới: [tính năng soạn thảo VS Code](https://code.visualstudio.com/docs/editing/getting-started/overview), [terminal](https://code.visualstudio.com/docs/terminal/basics), [Stage và Commit](https://code.visualstudio.com/docs/sourcecontrol/staging-commits), [repository và remote](https://code.visualstudio.com/docs/sourcecontrol/repos-remotes), [nhánh](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees), [GitHub cơ bản](https://docs.github.com/en/get-started/using-github/hello-world), [Pull Request](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests).

Nguồn logo: EIU và Drive từ tài nguyên có sẵn của project; [VS Code chính thức](https://code.visualstudio.com/brand); GitHub, Supabase và Vercel từ bộ SVG Simple Icons. Bố cục sơ đồ được dựng lại bằng HTML/SVG từ ba hình tham khảo của người dùng, phù hợp tỷ lệ 16:9.

Biểu tượng Git: dùng đường nét từ [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/git.svg), phối lại bốn màu theo yêu cầu trong `git-four-color.svg`; đây là biến thể màu cho slide. Biểu tượng Git gốc của Jason Long, [CC BY 3.0 và trang tải chính thức](https://git-scm.com/community/logos).

Slide 7–12: mỗi vùng VS Code có một slide liệt kê chức năng. Nguồn đối chiếu: https://code.visualstudio.com/docs/editing/getting-started/userinterface ; https://code.visualstudio.com/docs/editing/codebasics ; https://code.visualstudio.com/docs/terminal/basics ; https://developers.openai.com/codex/ide/features . Menu và công cụ có thể thay đổi theo phiên bản, cấu hình và extension.

Slide 13: Antigravity, GitHub Copilot, Claude Code và Cline. Logo chính chủ nhúng vào TSX; nguồn logo lưu ở ai-logos.json. Bấm nút đổi chi tiết ưu/nhược, giữ DOM các icon để animation không khởi động lại. Nội dung đối chiếu ngày 12/10/2026; điểm cân nhắc là tóm tắt thực hành từ tài liệu, không phải xếp hạng hiệu năng. Antigravity hiện có extension VS Code chính thức: https://www.antigravity.google/docs/ide/extensions/vscode/ .

Dải logo slide 13: Gemini Code Assist, Amazon Q, Continue, Augment, Kilo Code, Qodo, Bito, CodeGeeX, Tabby, CodeGPT. Không lặp bốn AI trong phần chính hoặc Codex. Logo nhúng từ trang Marketplace của nhà phát hành; URL nguồn ở ai-logos.json. Xác minh 12/10/2026. Amazon Q vẫn được hỗ trợ tại thời điểm này; Marketplace thông báo kết thúc hỗ trợ IDE plugin vào 30/04/2027, cần rà lại danh sách trước mốc đó.

Section 1 hiện có 33 slide. Slide 14–21 giới thiệu Git/GitHub từ VS Code chưa thiết lập, gồm Git checkpoints, vai trò, cài đặt, chu trình hằng ngày, repository, branch/PR, phục hồi và prompt Codex. Nguồn nội dung: https://learn.chatgpt.com/docs/codex/ide ; https://code.visualstudio.com/docs/sourcecontrol/overview ; https://code.visualstudio.com/docs/sourcecontrol/quickstart ; https://docs.github.com/en/get-started/using-git/about-git ; https://docs.github.com/en/get-started/using-github/github-flow ; https://git-scm.com/docs/git-revert. Các thao tác trong slide là minh họa, không chạy lệnh trên máy học viên.
