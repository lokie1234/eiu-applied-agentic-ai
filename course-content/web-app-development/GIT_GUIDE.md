# Hướng dẫn Git/GitHub · Section 1

Slide 14–40 dùng lệnh Git trong Terminal PowerShell của VS Code. Slide 1–13 và Section 2 giữ nguyên. Không cài extension GitHub; xác thực HTTPS dùng Git Credential Manager (GCM) đi kèm Git for Windows.

| Slide | Nội dung |
|---|---|
| 14–15 | Git/GitHub ngắn gọn, link tải Git và đăng ký GitHub; gợi ý Continue with Google |
| 16–18 | Cài Git, PATH và GCM; mở lại VS Code; kiểm tra Git, đường dẫn và credential helper |
| 19–21 | Hoàn tất GitHub, đặt tên/email/main, kiểm tra cấu hình; xác thực qua trình duyệt khi Git yêu cầu |
| 22–24 | Phân biệt Clone và Init; tạo repo private có README, git clone, kiểm tra status/remote/log |
| 25–26 | Tải website ZIP, giải nén và mở đúng thư mục có package.json |
| 27–29 | Node.js/npm, kiểm tra sau cài, chạy dev và thử chỉnh bằng tay |
| 30–32 | Ngữ cảnh AI, yêu cầu cụ thể, tùy chỉnh website và kiểm tra tương tác |
| 33 | npm test, build và start |
| 34–35 | git init/add/commit; tạo repo GitHub trống, remote add, push -u origin main |
| 36–37 | Chọn nhánh, xem diff, chọn file, Commit và Push đúng nhánh |
| 38–40 | Pull main sau Merge, kiểm tra kết quả, đối chiếu GitHub và tự kiểm tra |

Xác thực xuất hiện ở lần Clone repo private hoặc Push cần đăng nhập. Clone repo public có thể chưa yêu cầu xác thực. user.name/user.email là danh tính tác giả commit; không phải đăng nhập GitHub. Đăng nhập menu Accounts trong VS Code không phải điều kiện để dùng lệnh Git với GCM. Bài đưa ZIP lên GitHub tạo repo online không có README/.gitignore/license để nhận lịch sử local đã có.

File TSX hiển thị và tải xuống được đăng ký trong sources.json cho course a857595d-def0-4543-9216-a680c6abfe26, section 47c1183e-a26e-4c5d-9937-88ec5a755a32. API kiểm tra quyền trước khi đọc nguồn local. Refresh hoặc mở lại section để tải nội dung mới; không cần upload Drive. Nội dung đồng bộ với storyboard.json và renderer.tsx.txt, giữ EIU DNA.

ZIP tại public/downloads/eiu-advertising-starter.zip, button tải thật ở slide 25. Website có tab, gói, FAQ và form lưu localStorage. ZIP không đóng gói node_modules, .next, .git hoặc .env; .gitignore đã có trong project mẫu.

Nguồn đối chiếu ngày 2026-10-13:

- [Tải Git cho Windows](https://git-scm.com/install/windows).
- [Đăng ký GitHub](https://github.com/signup), [tạo tài khoản bằng Google](https://docs.github.com/en/account-and-profile/how-tos/account-management/creating-an-account-on-github).
- [Cấu hình tên/email](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup).
- [VS Code hỗ trợ Git sẵn](https://code.visualstudio.com/docs/sourcecontrol/overview).
- [GCM và xác thực HTTPS](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git).
- [Node.js LTS](https://nodejs.org/en/download).
