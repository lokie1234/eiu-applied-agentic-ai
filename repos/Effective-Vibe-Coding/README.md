# Effective Vibe Coding

**Biến mỗi yêu cầu sửa code thành một kết quả rõ ràng, được kiểm tra và đồng bộ với project.**

Skill dùng cho **Codex và Google Antigravity**, đặc biệt phù hợp với người phát triển web bằng ngôn ngữ tự nhiên. Repo đích: [lokie1234/Effective-Vibe-Coding](https://github.com/lokie1234/Effective-Vibe-Coding).

## Skill giúp gì?

Khi bạn yêu cầu sửa code, AI áp dụng quy trình: hiểu project → thực hiện → kiểm tra → sửa lỗi liên quan → dọn phần dư → báo kết quả.

| Việc bạn quan tâm | Cách skill hướng dẫn AI thực hiện |
| --- | --- |
| Font chữ đồng bộ | Dùng nguồn font/token hiện tại; kiểm tra weight, tiếng Việt, nút, popup và iframe. |
| Khung và layout hài hòa | So sánh các component cùng nhóm; căn icon, tiêu đề, nội dung, nút; kiểm tra text dài và responsive. |
| Hạn chế giật, lag | Tìm nguyên nhân: rerender, remount, font shift, timers, request trùng, animation gây reflow; xác minh sau khi sửa. |
| Kiểm tra tự động trong tác vụ | Chọn test, typecheck, lint, build hoặc smoke check phù hợp với project và thay đổi. |
| Code sạch | Dọn code/import/style bị thay thế và đã xác nhận không còn dùng trong phạm vi yêu cầu. |
| Kết quả dễ hiểu | Báo hành vi/giao diện đã đổi, phần đã dọn, kết quả kiểm tra và phần chưa xác minh. |
| Giữ công sức của bạn | Bảo toàn sửa đổi có sẵn, chức năng, design system và các file ngoài nhiệm vụ. |

Skill là hướng dẫn cho AI thực hiện trong phiên làm việc, không phải tiến trình chạy nền hay công cụ bảo đảm ứng dụng luôn hết lỗi/lag. Chất lượng phụ thuộc model, ngữ cảnh và công cụ/quyền thực tế. **Cài skill + hướng dẫn project** giúp nó được áp dụng nhất quán hơn; dùng tên skill trực tiếp khi cần chắc chắn.

## Cài nhanh cho cả Codex và Antigravity

Cần **Node.js 20+** để chạy bộ cài. Có thể tải ZIP thay cho Git Clone. Không cần `npm install`, API key hoặc dịch vụ bên ngoài để cài skill; công cụ AI bạn dùng vẫn cần tài khoản/quyền của chính nó.

Trong Terminal:

```powershell
git clone https://github.com/lokie1234/Effective-Vibe-Coding.git
cd Effective-Vibe-Coding
node scripts/install.mjs --target "C:\duong-dan\project-cua-ban" --dry-run
node scripts/install.mjs --target "C:\duong-dan\project-cua-ban"
```

macOS/Linux: thay đường dẫn Windows bằng ví dụ `"/Users/you/projects/my-app"`. `--target` phải là thư mục project đã tồn tại. Nếu dùng ZIP, giải nén rồi mở Terminal trong thư mục chứa README này để chạy hai lệnh `node`.

Bộ cài sẽ:

1. Chép skill vào `<project>/.agents/skills/effective-vibe-coding/`.
2. Bổ sung một khối hướng dẫn được đánh dấu vào `AGENTS.md`, giữ nguyên nội dung đã có. Nếu project có `AGENTS.override.md` không rỗng, bổ sung vào đó nữa để Codex vẫn đọc được.
3. Giữ nguyên các file khác. Chạy lại cùng phiên bản không tạo khối hướng dẫn trùng. Nếu gặp skill hoặc khối hướng dẫn đã sửa khác bản đóng gói, dừng để bạn xem xét thay vì ghi đè.

Không chạy bộ cài đồng thời với tác vụ đang sửa file hướng dẫn của project. Khi có lỗi I/O giữa chừng, kiểm tra danh sách file đã tạo và chạy lại; bộ cài có thể tiếp tục với các file còn nguyên nội dung. Bộ cài không tự đổi cấu hình quyền của AI.

**Sau cài đặt:** mở lại project và tạo phiên AI mới. Có thể commit `.agents/skills/effective-vibe-coding/` cùng phần bổ sung hướng dẫn để cả nhóm dùng chung. Nếu repo đang ignore `.agents/`, xem xét quy tắc ignore trước khi chia sẻ.

## Dùng trong Codex

Mở đúng project đã cài. Trong Codex CLI/IDE, dùng `/skills` hoặc gõ `$` để tìm skill. Prompt mẫu:

```text
Use $effective-vibe-coding.
Sửa form đăng ký để kiểm tra số điện thoại và thông báo lỗi rõ ràng.
Giữ font, màu và bố cục hiện tại. Kiểm tra luồng gửi form và báo cụ thể kết quả.
```

Sau khi hướng dẫn project được nạp, bạn có thể giao việc tự nhiên:

```text
Đồng bộ ba card này về font, khoảng cách và vị trí nút.
Kiểm tra trên desktop/mobile, dọn CSS dư liên quan và báo phần đã xác minh.
```

Codex có thể chọn skill ngầm theo mô tả; `AGENTS.md` nhắc áp dụng cho tác vụ code. Đây là cơ chế hướng dẫn, không phải hook bắt buộc mọi lượt. Nếu không thấy skill, kiểm tra đường dẫn cài, phiên hiện tại và hướng dẫn ưu tiên trong project. Kiểm tra bằng cách hỏi: “Cho biết đường dẫn skill Effective Vibe Coding và các nguồn hướng dẫn bạn đang áp dụng.”

## Dùng trong Antigravity

Mở cùng project đã cài và bắt đầu hội thoại mới. Skill workspace ở `.agents/skills/effective-vibe-coding/`; xem danh sách trong **Customizations** của agent side panel ở bản IDE hiện tại. Yêu cầu:

```text
Áp dụng skill effective-vibe-coding trong project này.
Sửa header trên điện thoại để menu không che nội dung.
Giữ design system, kiểm tra thao tác thật và báo rõ kết quả thay đổi.
```

Antigravity có thể tự chọn skill liên quan. Nếu phiên bản của bạn hỗ trợ skill slash command, có thể dùng `/effective-vibe-coding`; nếu không xuất hiện, dùng yêu cầu bằng tên và đường dẫn `SKILL.md` như trên. `.agent/skills` là đường dẫn legacy; bộ cài dùng `.agents/skills` theo tài liệu hiện tại. Quy tắc trong `AGENTS.md` áp dụng cho project; không cần thêm rule Always On trùng nội dung. Nếu bản cũ chưa đọc `AGENTS.md`, đặt lời nhắc đọc skill vào workspace rule **Always On** trong Customizations, theo giao diện phiên bản đó.

Để AI sửa và chạy kiểm tra, phiên làm việc cần có công cụ file/Terminal hoặc browser tương ứng. Đăng nhập và phê duyệt khi công cụ yêu cầu; không cần tắt các cơ chế bảo vệ để dùng skill.

## Những ví dụ nên dùng ngay

**Sửa giao diện:**

```text
Áp dụng Effective Vibe Coding. Sửa trang bảng giá cho đồng bộ với trang chủ:
font, line-height, khoảng cách, radius và vị trí nút. Đừng đổi nội dung/gói giá.
Kiểm tra text tiếng Việt dài và màn hình nhỏ; báo những gì đã kiểm tra thực tế.
```

**Xử lý lag:**

```text
Áp dụng Effective Vibe Coding. Khi gõ vào ô tìm kiếm, danh sách bị giật.
Tái hiện, tìm nguyên nhân và sửa trong phạm vi luồng này. So sánh trước/sau
bằng công cụ hiện có, giữ hành vi hiện tại và dọn phần code bị thay thế.
```

**Sửa rồi Commit/Push, khi bạn muốn giao luôn phần Git:**

```text
Áp dụng Effective Vibe Coding. Thực hiện [yêu cầu]. Kiểm tra và sửa lỗi liên quan.
Khi đạt, Commit các thay đổi của nhiệm vụ rồi Push lên nhánh đã cấu hình.
Kiểm tra origin/upstream trước; thiếu hoặc có nhiều đích thì hỏi tôi.
Báo kết quả, kiểm tra, mã commit và repo/nhánh nhận Push.
```

Đăng nhập GitHub cung cấp xác thực; cấu hình remote/upstream quyết định nơi Push. Skill không tự cấp quyền Commit/Push hoặc triển khai khi yêu cầu chỉ là sửa code.

## Kết quả trả về

Ví dụ cách báo cáo (nội dung minh họa, không phải kết quả đã chạy trên project của bạn):

> Đã căn đều ba thẻ dịch vụ và đồng bộ font với trang chủ. Tiêu đề dài tự xuống dòng, nút vẫn cùng hàng. Đã bỏ hai lớp CSS bị thay thế. Typecheck và kiểm tra luồng chọn gói đạt; đã xem ở 390px/1440px. Chưa kiểm tra Safari.

Với thay đổi nhỏ, AI trả lời ngắn hơn. Bạn vẫn có thể yêu cầu diff hoặc danh sách file; báo cáo mặc định tập trung vào tác động cụ thể và bằng chứng.

## Cấu trúc repo

```text
skills/effective-vibe-coding/
  SKILL.md                     Quy trình chính, dùng chung hai công cụ
  agents/openai.yaml           Metadata hiển thị và chọn skill ngầm cho Codex
  references/                  UI, cleanup/performance, báo kết quả
  scripts/inspect-project.mjs  Helper đọc metadata và Git status, không sửa code
scripts/install.mjs            Cài vào project, giữ hướng dẫn sẵn có
scripts/validate.mjs           Kiểm tra cấu trúc skill
tests/                         Kiểm tra bộ cài và helper bằng Node built-in
```

Helper inspector chỉ đề xuất lệnh dựa trên package manager và script có thật. Nó không chạy lệnh trong `package.json`, không xuất nội dung `.env`, URL remote hay credential. Với Python/Go/framework khác, AI dùng công cụ hiện có của project; helper Node là tùy chọn.

## Kiểm tra repo trước khi chia sẻ

Trong thư mục này:

```powershell
node scripts/validate.mjs
node --test
```

Test tạo project tạm để kiểm tra cài lặp, bảo toàn quy tắc, xung đột, symlink và inspector. Test không gọi model, dịch vụ mạng hoặc tự sửa project thật. Test bộ cài không chứng minh AI luôn làm đúng: cần thử với tác vụ thực tế và xem bằng chứng AI báo lại.

## Cập nhật hoặc gỡ

Để cập nhật: xem thay đổi phiên bản, sao lưu thư mục skill đã cài nếu có chỉnh riêng; hợp nhất hoặc di chuyển bản cũ sau khi xem xét rồi chạy bộ cài mới. Bộ cài không tự ghi đè phần khác biệt. Giữ khối đánh dấu trong `AGENTS.md` nếu nội dung vẫn tương thích; hợp nhất thủ công nếu bộ cài báo khối đó đã bị sửa.

Để gỡ: trong project đã cài, xóa **đúng thư mục** `.agents/skills/effective-vibe-coding/` sau khi kiểm tra không có nội dung riêng cần giữ; bỏ phần giữa hai marker `BEGIN effective-vibe-coding` / `END effective-vibe-coding` trong `AGENTS.md` và `AGENTS.override.md` nếu có. Giữ nguyên các hướng dẫn/skill khác rồi mở phiên AI mới.

## Đẩy bộ source này lên GitHub

Thực hiện trong thư mục repo này, tách biệt với project khóa học hoặc app khác. Nếu GitHub repo đích đã có lịch sử, clone repo đó và hợp nhất source này vào checkout; không force push để thay lịch sử.

Với repo đích mới/rỗng:

```powershell
git init -b main
git add .
git commit -m "Add Effective Vibe Coding skill"
git remote add origin https://github.com/lokie1234/Effective-Vibe-Coding.git
git push -u origin main
```

Nếu đã có `origin`, kiểm tra bằng `git remote -v` và dùng remote đúng thay vì thêm lần nữa. Hoàn tất đăng nhập GitHub khi Git yêu cầu. Source cung cấp kèm bản quyền MIT trong [LICENSE](LICENSE).

## Tài liệu nền tảng

Đối chiếu ngày **16/10/2026**; UI và đường dẫn ở bản cũ có thể khác:

- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) — skill workspace, lựa chọn ngầm và gọi trực tiếp.
- [OpenAI: AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) — cách nạp hướng dẫn và ưu tiên override.
- [Antigravity: Agent skills](https://antigravity.google/docs/skills?app=antigravity-ide) — vị trí skill và cách tìm/gọi.
- [Antigravity: Rules](https://www.antigravity.google/docs/rules/) — phạm vi project và activation của rules.

Repo không liên kết hoặc được chứng nhận bởi OpenAI hay Google.
