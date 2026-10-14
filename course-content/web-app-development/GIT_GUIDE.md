# Section 1 · flow từ slide 6 (14/10/2026)

Đã bỏ slide 3–4 cũ. Flow ở slide 5 cũ thành slide 3, có Node.js tại bước Kiểm tra. Slide 4 chứa sáu popup VS Code; Section 1 có 21 slide, Section 2 giữ nguyên.

| Slide | Nội dung |
|---|---|
| 3 | Flow sáu bước: sửa → Node.js chạy/kiểm tra → chọn thay đổi → Commit → Push → xác nhận |
| 4 | Bản đồ VS Code với sáu popup chức năng; header gọn không ảnh/kính lúp, nội dung cân đối hai hàng, các ô quan trọng nền navy EIU |
| 5 | Khám phá các trợ lý AI trong VS Code |
| 6 | Node.js/Git/GitHub cùng một slide, ba popup; Node.js/npm và lệnh chạy/kiểm tra, Git trong VS Code, GitHub/repo mở; liên kết theo cùng project và hai chiều đồng bộ |
| 7 | Bốn popup setup VS Code, Node.js, Git và GitHub: link cài, lệnh kiểm tra, PATH/GCM, tên/email/main và xác thực HTTPS |
| 8–10 | Antigravity và Codex: ưu/nhược, vibe riêng; cài extension chính chủ, chọn model và quyền |
| 11–12 | Tải ZIP app quảng cáo hiện có, mở folder có package.json, cài thư viện và chạy bản gốc |
| 13–15 | Sáu thành phần prompt, prompt sao chép, xem diff; khác biệt kết quả và giới hạn tự test/fix theo model |
| 16 | Test, build và thử giao diện/tương tác production |
| 17–19 | Init/Stage/Commit → repo trống/remote/Push đầu → Commit/Push lần tiếp theo |
| 20–21 | Pull, xử lý khi không Pull được, Clone trên máy mới; tự kiểm tra |

App xuyên suốt: `eiu-advertising-starter` (Lumi Studio). Nút tải ZIP thật ở slide 11; ZIP nằm trong `public/downloads/eiu-advertising-starter.zip`. Form lưu trên trình duyệt, chưa gửi email/database dùng chung. Không tạo repo phụ để luyện Clone trước thực hành.

Antigravity và Codex là công cụ; model được chọn bên trong. Nhận định ưu/nhược là hướng dẫn sử dụng, không phải benchmark. Chỉ một số model có khả năng suy luận/agent tốt, với công cụ và quyền phù hợp, có thể tự kiểm tra → tìm lỗi → sửa → chạy lại. Không hứa mọi model tự test/fix hoặc test/build đạt là hết lỗi giao diện.

Git tích hợp sẵn trong VS Code nhưng phải cài Git trên máy. GitHub extension và menu Accounts không bắt buộc cho lệnh Git/GCM. Tên/email Commit không phải xác thực GitHub. Repo đầu tiên online không bật README/.gitignore/license vì lịch sử local đã có. Pull dùng `--ff-only`; khi phân kỳ dừng để xem và xử lý, không force/reset.

Binding hiển thị/download trong `sources.json` giữ nguyên: course `a857595d-def0-4543-9216-a680c6abfe26`, section `47c1183e-a26e-4c5d-9937-88ec5a755a32`. API vẫn kiểm tra quyền trước khi đọc local TSX. Refresh/mở lại section để nhận bản mới; không cần upload Drive. Storyboard và renderer đồng bộ; chỉ generate Section 1.

Nguồn chính thức đối chiếu ngày 14/10/2026:

- [Git trong VS Code](https://code.visualstudio.com/docs/sourcecontrol/overview), [tải VS Code](https://code.visualstudio.com/download).
- [GitHub repositories/cộng tác](https://docs.github.com/en/get-started/using-github/hello-world), [repo mở](https://github.com/explore).
- [Antigravity extension VS Code](https://antigravity.google/docs/ide/extensions/vscode/).
- [Codex IDE extension](https://learn.chatgpt.com/docs/codex/ide).
- [Git for Windows](https://git-scm.com/install/windows), [cấu hình Git](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup), [GCM/HTTPS](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git).
- [Node.js LTS](https://nodejs.org/en/download).

Slide 7: GitHub dùng trên web; không cần cài GitHub CLI/Desktop. `git ls-remote` repo public chỉ kiểm tra kết nối HTTPS, không xác nhận đăng nhập. VS Code có `code --version`, `where.exe code`, `code .`; Node.js có kiểm tra node/npm và lệnh chạy sau khi tải app.
Nguồn lệnh VS Code: [CLI chính thức](https://code.visualstudio.com/docs/configure/command-line).

Nguồn Node.js/npm: [Node.js introduction](https://nodejs.org/learn/getting-started/introduction-to-nodejs), [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/).
