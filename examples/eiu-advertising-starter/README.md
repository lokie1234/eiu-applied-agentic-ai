# Lumi Studio · website quảng cáo mẫu EIU

Dự án Next.js có giao diện quảng cáo, animation nhẹ, tab khám phá, chọn gói, FAQ và form đăng ký. Form kiểm tra tên/email, lưu đăng ký trên trình duyệt và hiện xác nhận. Đây là bản thực hành: chưa gửi email hoặc lưu vào database dùng chung.

## Bắt đầu

1. Cài Node.js LTS từ https://nodejs.org/en/download. Next.js cần Node.js từ 20.9 trở lên.
2. Giải nén ZIP. Mở đúng thư mục `eiu-advertising-starter` chứa `package.json` trong VS Code.
3. Mở Terminal → New Terminal và chạy:

```bash
npm install
npm run dev
```

4. Mở **http://localhost:3000** và thử chọn tab, chọn gói, gửi form, đóng form và mở FAQ.
5. Giữ terminal đang chạy. Lưu file sau mỗi lần sửa để xem thay đổi trên trình duyệt. Dừng bằng Ctrl+C.

Nếu cổng 3000 đang được dự án khác sử dụng, dừng terminal chạy dự án đó trước khi chạy mẫu này.

## Các lệnh có ý nghĩa gì?

| Lệnh | Công việc |
|---|---|
| `npm install` | Cài thư viện khai báo trong package.json; tạo node_modules. Chạy khi mới giải nén hoặc khi thư viện thay đổi. |
| `npm run dev` | Chạy bản phát triển; hỗ trợ xem thay đổi nhanh ở localhost:3000. |
| `npm run build` | Tạo và kiểm tra bản production; không tự deploy, không tự mở server. |
| `npm run start` | Chạy bản production sau khi build thành công. |
| `npm test` | Kiểm tra chức năng lưu đăng ký mẫu. |

Kiểm tra bản production trên máy:

```bash
# Dừng dev trước bằng Ctrl+C
npm run build
npm run start
```

## Nên sửa file nào?

- `data/site.js`: thương hiệu, tiêu đề, mô tả, các gói và FAQ.
- `app/globals.css`: màu, font, bố cục, responsive và animation. Màu chính nằm trong `:root`.
- `components/MarketingSite.js`: các mục giao diện, tab, modal và form.
- `lib/registrations.mjs`: kiểm tra/lưu đăng ký mẫu trên trình duyệt.
- `app/layout.js`: tiêu đề tab và mô tả website.

Không sửa `node_modules` hoặc `.next`: đó là thư viện và file được công cụ tạo ra.

## Chỉnh cùng AI trong VS Code

Mở project này trong VS Code. Dùng trợ lý AI/Agent đã cài và đăng nhập. Trợ lý có thể tìm file, đọc mã liên quan và đề xuất hoặc áp dụng bản sửa tùy chế độ/quyền. Nó không mặc định đưa toàn bộ project vào một câu hỏi. Khi cần, đính kèm file cụ thể hoặc dùng Add Context.

Prompt thử:

> Hãy đọc README.md, package.json, data/site.js và components/MarketingSite.js trong project đang mở. Đổi website thành quảng cáo workshop nhiếp ảnh. Giữ form đăng ký, tab khám phá, FAQ và responsive đang hoạt động. Sửa nội dung và màu theo chủ đề mới. Nêu các file đã sửa và cách tôi kiểm tra ở localhost:3000. Chưa deploy hoặc push.

Đọc diff, thử giao diện/form, rồi mới Commit. Tùy chỉnh thêm theo ý tưởng của bạn. Nếu thay thư viện, đọc và chạy lại npm install.

## Đưa lên GitHub

ZIP không chứa `.git`. Để tạo repo local:

```bash
git init -b main
git add .
git commit -m "Add advertising website"
```

`.gitignore` đã loại `node_modules`, `.next` và `.env`. Dùng **Publish to GitHub** trong VS Code, chọn tên repo còn trống và quyền riêng tư phù hợp.

Sau lần Publish đầu tiên, kiểm tra `git remote -v` và `git branch --show-current`.

- `main`: nhánh chính. Với repo cá nhân, có thể Commit/Push bản đã kiểm tra lên main; quy tắc bảo vệ nhánh có thể yêu cầu Pull Request.
- Nhánh riêng: tạo `feature/landing-refresh` để thử thay đổi, Commit/Push nhánh đó, rồi tạo Pull Request về main và xem xét trước khi Merge.

```bash
git switch -c feature/landing-refresh
# Chỉnh sửa, kiểm tra localhost và npm run build
git add .
git commit -m "Customize landing page"
git push -u origin feature/landing-refresh
```

Nếu đang ở main và đã có remote đúng, bản sửa được kiểm tra có thể đưa lên bằng `git push origin main`. Push gửi mã lên GitHub; việc deploy website là một bước riêng.

Website dùng dữ liệu minh họa. Khi làm sản phẩm thật, bổ sung nơi lưu và quy trình xử lý đăng ký phù hợp.
