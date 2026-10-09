# Tối ưu hiệu năng — 09/10/2026

Đã tối ưu logic tải bài, kiểm tra quyền và đồng bộ nền, giữ giao diện, điều hướng, template, passcode, quiz, feedback, báo cáo và chức năng nhớ slide. Chưa triển khai backup, đổi hosting, cấu hình region hoặc migration database.

## Thay đổi chính

- Resolve quyền một lần trong các API tương tác; đọc catalog và identity song song. Gộp các truy vấn catalog giống hệt đang chạy đồng thời, trả response riêng cho từng consumer. Không cache quyền đã hoàn tất, không chia sẻ truy vấn identity/quiz của học viên. Mutation vô hiệu hóa nhóm reads đang chờ để reads mới không dùng lại lượt trước mutation.
- Supabase có deadline theo loại request; các đường đọc thường xuyên truyền cancellation. Hủy một consumer không hủy các consumer còn lại; upstream bị hủy khi không còn consumer đang chờ. Không tự retry các request ghi đã timeout.
- Catalog refresh, presence, heartbeat, termination, quiz, ideas và showcase tránh request chồng. Realtime, polling, presence TTL 35 giây và kiểm tra thu hồi quyền vẫn hoạt động. Chặn beacon leave bị gửi trùng từ các lifecycle events.
- Quiz tải trạng thái và progress bằng một GET; record và feedback được đọc song song sau khi tìm audit record. Kết quả chỉ được khôi phục cho identity của phiên đăng nhập và đúng section. Client hỗ trợ server cũ trong thời gian rollout.
- PDF/PPTX tải theo nhu cầu; PDF Document giữ nguyên khi chuyển slide hoặc zoom. Chỉ phần trang/transition thay đổi. TSX fetch được hủy khi rời bài.
- Drive dùng lại OAuth client và access token, nhưng đọc lại token hiện tại và xác minh tài khoản; reconnect thay client, lỗi identity loại bỏ client cũ. Giữ xác minh hash/bytes của file.
- AI đọc rules/documents song song; các bước semantic/retrieval/cache write dùng lại embedding khi input giống hệt trong cùng request. Lỗi tạm thời không vô hiệu hóa cache/vector retrieval trên toàn instance.
- Catalog tra course theo Map; báo cáo Excel dùng lại date formatter.

## Kiểm chứng

- `node --test tests/*.test.mjs`: **134/134 pass**, gồm kiểm tra đổi/thu hồi quyền, scope từng phiên, khôi phục quiz/feedback, request chậm không chồng, cancellation độc lập, PDF không remount và giữ bytes của PDF/PPTX/TSX.
- `npm run build`: **pass**, gồm TypeScript và tạo routes production.
- ESLint trên toàn bộ code thay đổi: **0 errors**, 3 warning `<img>` có sẵn trong LessonPortal. Script CJS nằm trong ignore pattern của eslint hiện tại; đã kiểm tra bằng `node --check` và chạy thực tế.
- `npm run lint` toàn repo: **20 errors, 13 warnings**. Các error nằm trong EiuAgentBot, AdminAccessPortal, AgentWorld3D, GuardianRobot3D, HeroScene và bản source download cũ; các file này không thay đổi trong commit. Không báo toàn repo đã lint sạch.

## Thử nghiệm 10 phiên thật trên bản production local

10 browser context riêng, cookie/session khác nhau, đăng nhập bằng passcode đã cung cấp, mở course Agentic AI / Section 1 bằng UI. Mỗi phiên: 10 Next, 3 Previous, 4 jump, refresh, theo dõi thêm 35 giây. Lượt cuối mở thêm slide quiz và chỉ xem trạng thái, không mở khóa quiz hoặc nộp bài. Mỗi lượt đều **10/10 thành công**, 170 thao tác, **10/10 giữ đúng slide 38 sau refresh**. Không có JavaScript page error hoặc HTTP >=400.

Trung vị, đơn vị ms:

| Thao tác | Trước nhóm tối ưu backend/polling | Sau tối ưu, lượt 1 | Bản cuối, lượt 2 |
| --- | ---: | ---: | ---: |
| Đăng nhập API | 4035 | 2921 | 3247 |
| Danh sách course | 523 | 670 | 1451 |
| Mở course | 192 | 167 | 206 |
| Mở section | 1753 | 1649 | 1387 |
| Chuyển slide, gồm automation | 316 | 385 | 396 |
| Refresh/khôi phục slide | 2042 | 1369 | 815 |

P95 chuyển slide: **555 → 532 → 574 ms**. Refresh lâu nhất: **32594 → 3129 → 1266 ms**. Không phải mọi metric đều giảm: median chuyển slide và tải catalog có dao động/tăng giữa các lượt. Không dùng kết quả này để cam kết một mức cải thiện phần trăm trên Vercel.

Ở lượt cuối, 10 phiên ở quiz tạo **49 GET quiz-control**, tất cả **HTTP 200**, không có GET quiz-results riêng. Median quiz API **770 ms**, p95 **1939 ms**, max **2318 ms**. Với polling 8 giây, số GET định kỳ lý thuyết cho 10 phiên giảm từ khoảng 150 xuống 75/phút, chưa tính Realtime/focus và request nền khác.

Vẫn ghi nhận 30 POST presence và 10 RSC GET `/learn` bị `ERR_ABORTED` trong lượt cuối; không có quiz request bị hủy được ghi nhận. Automation dùng cùng browser process, có navigation/reload/unload và request nền. Logs chưa tách đầy đủ beacon, heartbeat, cleanup và browser cancellation, vì vậy không khẳng định các abort là lỗi server hoặc đã loại bỏ hết abort.

Các lượt chạy cùng một máy, chia sẻ CPU/GPU và network tới Supabase; không đại diện 10 thiết bị độc lập hoặc vùng mạng Vercel. Baseline được đo sau nhóm sửa PDF/client đầu tiên, nên không đo được phần tăng tốc của nhóm sửa đó. Login API không đo WebGL và delay chủ động của landing UI. AI/Drive được kiểm chứng qua regression mocks và build; chưa benchmark live Gemini/Drive trong đợt này.

Dữ liệu tổng hợp không chứa cookie, token, passcode hoặc thông tin phiên: [performance/2026-10-09-summary.json](./performance/2026-10-09-summary.json). Raw logs/screenshots được giữ local trong `tmp/performance-10-users*`; không commit. Login test có tạo audit records và presence; không xóa dữ liệu live để dọn test.

## Chạy lại

Script: `scripts/performance-smoke.cjs`. Cần Playwright bên ngoài dependency của ứng dụng và Chromium đã cài. Đặt `PERF_PASSCODE` qua môi trường; mặc định target `http://localhost:3100`. Script tạo 10 phiên thật và audit login; chỉ chạy trên target đã được phép kiểm thử.

Các biến tùy chọn: `PERF_BASE_URL`, `PERF_PLAYWRIGHT_MODULE` (module/path Playwright), `PERF_BROWSER_PATH`, `PERF_OUTPUT_DIR`, `PERF_INCLUDE_QUIZ=1`. Script trả exit code lỗi khi không đủ 10 phiên thành công, không giữ slide hoặc có page/HTTP error. Chạy production bằng `npm run build`, `npm start -- -p 3100`, rồi `node scripts/performance-smoke.cjs`.

## Giới hạn còn lại

Phần nhớ slide chỉ ghi URL/sessionStorage nhỏ, không ghi database mỗi lần bấm; không phải điểm nghẽn chính. Catalog vẫn phải đọc dữ liệu quyền mới, và network Supabase/Drive/Gemini còn ảnh hưởng thời gian tải.

Các bước cần hạ tầng hoặc dữ liệu vận hành: xác minh index/query plan, đo Vercel–Supabase theo region, retention presence/audit, tách file lớn khỏi giới hạn payload Vercel và worker cho AI/export lớn. Không thể kết luận mọi điểm nghẽn đã hết chỉ bằng rà soát source và test local. Chi tiết phát hiện và phương án dự phòng: [PERFORMANCE_AND_FAILOVER_AUDIT_2026-10-09.md](./PERFORMANCE_AND_FAILOVER_AUDIT_2026-10-09.md).
