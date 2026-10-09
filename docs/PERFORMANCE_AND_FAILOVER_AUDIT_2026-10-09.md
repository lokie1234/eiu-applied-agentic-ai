# Rà soát hiệu năng và dự phòng triển khai — 09/10/2026

Phạm vi: kiểm kê 120 file TypeScript/TSX trong `app`, `lib`, `components` (30 route API), 31 file CSS, các migration Supabase và cấu hình Next.js; đối chiếu các luồng quan trọng với kết quả 10 phiên trình duyệt. Không bao gồm mã vendor trong node_modules hoặc bản sao thử nghiệm tmp/classroom-sandbox. Tài liệu ghi lại các phát hiện ban đầu; các tối ưu đã thực hiện sau đó được liệt kê bên dưới. Chưa triển khai hosting hay backup theo yêu cầu của người dùng.

## Trạng thái sau tối ưu logic

- Phát hiện 1: heartbeat, quiz-control và các API gửi idea/showcase/quiz/feedback dùng một access context mỗi request. Catalog và identity được đọc song song; truy vấn catalog giống nhau chỉ được gộp khi đang chạy, không cache kết quả quyền đã hoàn tất. Việc đổi passcode, ẩn section và thu hồi quyền vẫn được kiểm tra ở request mới.
- Phát hiện 2: transport Supabase có deadline 15 giây cho REST reads, 30 giây cho REST writes, 90 giây cho các đường còn lại. Các đường đọc presence, section-control, quiz và showcase đã truyền request.signal; khi một reader hủy, không hủy reader khác đang dùng cùng truy vấn. Không tự retry mutation. Việc client disconnect có được runtime chuyển thành request.signal hay không vẫn phụ thuộc môi trường hosting.
- Phát hiện 3: chặn request nền chồng và hủy khi unmount; quiz gộp trạng thái/kết quả thành một GET, có fallback tương thích server cũ. Các interval và Realtime hiện tại được giữ nguyên. Beacon leave được gộp để beforeunload/pagehide/cleanup không gửi trùng.
- Phát hiện 4: presence count là read-only và vẫn lọc cutoff 35 giây; expired sessions không được đánh dấu left_at từ mỗi GET nữa. Explicit leave và admin reset vẫn hoạt động. Retention/cleanup định kỳ là phần vận hành còn cần xử lý khi bảng tăng lớn.
- Phát hiện 7: tái sử dụng OAuth client/access token Drive; đọc lại token lưu trữ ở mỗi lần gọi, thay client khi token/config đổi. Vẫn xác minh tài khoản ở mỗi lần gọi, chỉ gộp xác minh đang chạy đồng thời. Giữ kiểm tra metadata, độ dài và hash file.
- Phát hiện 8–9: rules/documents được đọc song song; embedding được dùng lại trong cùng request khi input giống hệt. Lỗi network/database tạm thời không vô hiệu hóa cache/vector retrieval vĩnh viễn trên instance. Schema thiếu vẫn dùng fallback hiện tại.
- Phát hiện 10: tái sử dụng Intl.DateTimeFormat trong Excel export, tránh tạo lại formatter cho mỗi ô. Luồng tải dữ liệu và tạo workbook lớn vẫn còn chi phí bộ nhớ.
- PDF: tải thư viện PDF/PPTX theo loại nội dung; PDF Document giữ nguyên khi chuyển trang/zoom, tránh tải lại document. Giữ template, transition và nhớ slide sau refresh.

Kết quả sau thay đổi và giới hạn thực nghiệm: [PERFORMANCE_OPTIMIZATION_2026-10-09.md](./PERFORMANCE_OPTIMIZATION_2026-10-09.md). Các vấn đề cần điều chỉnh hạ tầng/schema (index thực tế, Vercel payload lớn, region, worker/retention) chưa được triển khai trong đợt tối ưu này.

## Kết quả thực nghiệm và giới hạn kết luận

Kịch bản production local trên cổng 3100: đăng nhập API thật, 10 browser context có cookie riêng, mở Agentic AI / Section 1 bằng UI, mỗi phiên 10 Next + 3 Previous + 4 jump, refresh rồi theo dõi thêm 35 giây. 10/10 phiên hoàn tất, 170 lần chuyển slide, 10/10 khôi phục đúng slide; không ghi nhận lỗi JavaScript hoặc HTTP >= 400 trong lượt chạy thành công.

| Hạng mục | Trung vị | Lâu nhất |
| --- | ---: | ---: |
| Đăng nhập | 4.035 ms | 11.955 ms |
| Tải danh sách course | 523 ms | 1.518 ms |
| Mở course | 192 ms | 524 ms |
| Mở Section 1 | 1.753 ms | 2.897 ms |
| Chuyển slide, gồm chi phí automation | 316 ms | 1.024 ms |
| Refresh và khôi phục slide | 2.042 ms | 32.594 ms |

Lượt thử đầu dừng vì selector của kịch bản, không dùng để đánh giá khả năng mở section. Dữ liệu raw của lượt thành công: `tmp/performance-10-users/results.json`. Các lượt đăng nhập thử có tạo audit log; không gửi bài, quiz hoặc feedback.

10 context cùng chạy trên một máy và một browser process, không phải 10 thiết bị độc lập. Các sự kiện focus/visibility, CPU/GPU chia sẻ và đường mạng từ máy local có thể ảnh hưởng kết quả. Có request bị hủy (`ERR_ABORTED`), đặc biệt presence và RSC `/learn`; dữ liệu hiện có chưa phân biệt đầy đủ hủy do navigation, cleanup hay timeout. Không được diễn giải tất cả request bị hủy là lỗi server.

Đo riêng Supabase bằng 3 vòng chỉ đọc, mỗi vòng 3 truy vấn song song:

- courses: 231 / 970 / 3.731 ms; 3 course, khoảng 25,7 KB JSON.
- course_sections: 151 / 312 / 450 ms; 4 section, khoảng 1,4 KB JSON.
- truy vấn rate limit đăng nhập: 1.274 / 2.297 / 2.914 ms, trả count 0.

Độ trễ upstream đáng chú ý ngay cả khi dữ liệu ít. Phép đo là tổng network + Supabase API + database; chưa có query plan, region dashboard hay telemetry Vercel để tách nguyên nhân. Không có cơ sở quy toàn bộ độ chậm cho Vercel hoặc thiếu CPU database.

## Các phát hiện ở thời điểm rà soát ban đầu

### 1. Kiểm tra quyền vẫn tải toàn bộ catalog trên đường xử lý thường xuyên — P1

`lib/auth/currentUser.ts:9`, `lib/auth/courseAccessStorage.ts:244`: mỗi lần kiểm tra quyền tải courses và course_sections, parse metadata rồi mới đọc audit identity. Admin còn kiểm tra session_version trong database. Heartbeat đã được giảm còn một lần resolve, nhưng `/learn`, section-control, quiz, file và nhiều API khác vẫn trả chi phí này cho mỗi request.

`app/api/quiz-control/route.ts:13` và `:19` gọi currentRole rồi canFacilitateSection; hai hàm đều resolve access. Các POST ideas, showcase, quiz-results, quiz-feedback cũng resolve role rồi profile riêng. `/api/templates` kiểm tra access rồi đọc cấu hình từ catalog một lần nữa.

Phương án: một access context trong mỗi request, truyền cùng kết quả qua các helper. Phân biệt metadata catalog dùng chung với trạng thái quyền từng phiên. Nếu dùng cache catalog qua nhiều request phải thiết kế invalidation đầy đủ cho đổi passcode, hidden, status, template, folder; không cache quyền người dùng chung giữa các phiên và không làm trì hoãn thu hồi quyền ngoài hành vi hiện tại.

### 2. Client hủy request nhưng server chưa truyền hủy xuống upstream — P1

`lib/supabase/server.ts` không thiết lập deadline cho fetch database; các route không truyền request.signal vào query. Client timeout/AbortController đã được bổ sung ở LessonPortal, nhưng điều đó không tự chứng minh query server đang chạy cũng dừng. Server có thể tiếp tục chờ upstream trong lúc client bắt đầu lượt kế tiếp.

Phương án: timeout theo loại tác vụ, request-scoped cancellation cho truy vấn đọc, telemetry từng giai đoạn. Với mutation cần idempotency và trạng thái hoàn tất rõ ràng; không retry mù một request ghi đã timeout vì thao tác trước có thể đã commit.

### 3. Polling và Realtime vẫn cộng dồn, quiz dễ tạo nhiều request — P1

`components/LessonPortal.tsx`: refresh catalog 30 giây, heartbeat 10 giây, termination 30 giây, thêm focus/visibility và presence 15 giây cho người dạy. Quiz (`components/QuizSlide.tsx:99`, `:141`) gọi quiz-control và quiz-results mỗi 8 giây, đồng thời nghe Realtime; loadQuizState chưa có guard in-flight/abort/cleanup kết quả bất đồng bộ. Showcase và idea results cũng vừa subscribe vừa polling, chưa chặn request chồng.

Chỉ riêng 10 học viên đang ở quiz: khoảng 150 request quiz/phút, chưa tính khoảng 60 heartbeat, 20 termination và 20 refresh catalog/phút, cũng chưa tính Realtime/focus. Đây là ước tính theo interval, không phải số request đo được của bài test chuyển slide.

Phương án: in-flight guard, gộp event, jitter giữa phiên, hủy request khi unmount; ưu tiên Realtime với fallback khi kênh mất kết nối. Phải giữ TTL presence 35 giây hợp lý; không tăng heartbeat tùy ý hoặc tắt đồng bộ trạng thái terminate/thu hồi quyền. Khôi phục quiz progress không cần tải toàn bộ lặp lại nếu dữ liệu không thay đổi; vẫn kiểm tra record hợp lệ khi khôi phục.

### 4. Request đếm presence có ghi và quét dữ liệu hết hạn — P1

`app/api/presence/route.ts:15`: GET cập nhật left_at cho mọi session hết hạn, rồi mới chạy count. Query count vốn đã lọc last_seen_at theo cutoff; phần dọn dữ liệu làm tăng thời gian, write contention và broadcast khi nhiều giáo viên cùng xem.

Phương án: count một cách chỉ đọc, chuyển cleanup sang job riêng hoặc gộp trong RPC có giới hạn. Giữ đúng ý nghĩa số người đang học và sự kiện leave. Kiểm tra retention presence/audit để bảng không tăng vô hạn.

### 5. Index audit chưa khớp bộ lọc đăng nhập và khôi phục quiz — P1 cần xác minh DB

Migration `202609300001_google_course_access.sql:56` chỉ thể hiện index created_at cho access_audit_logs. Các query lọc action + JSONB contains(fingerprint/sessionId/section) + thời gian. Không tìm thấy index chuyên biệt cho các bộ lọc đó trong migration đã kiểm tra.

Phương án: đọc index thực tế và EXPLAIN trước khi thêm composite/expression/GIN index thích hợp; có thể dùng partial index cho PASSCODE_LOGIN_FAILED. Đây là điểm nghi vấn theo source, không khẳng định live DB chưa có index hoặc đang full scan.

### 6. Đường file 50 MB không phù hợp payload Vercel Functions — P0 đối với file lớn

`lib/sectionContent.ts:44` cho phép 50 MB; `next.config.ts` cấu hình proxy 52 MB. Upload multipart đi qua API; GET content đọc toàn bộ file rồi trả Blob. Giới hạn Next proxy không tăng giới hạn nền tảng Vercel 4,5 MB. Local test upload lớn thành công không chứng minh Vercel sẽ nhận file đó.

Phương án giữ UI và quyền hiện tại: data plane riêng cho file lớn, upload có token giới hạn/quyền hoặc file proxy Node độc lập; download streaming hoặc storage riêng có URL tạm sau kiểm tra quyền. Không đưa Google refresh token/OAuth token của admin cho học viên. Nếu có mirror/cache file phải xác thực mỗi request, khóa theo file version và invalidation khi thay file.

[Vercel Functions limits](https://vercel.com/docs/functions/limitations), [hướng dẫn bypass giới hạn](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).

### 7. Một lần đọc Drive có nhiều round trip nối tiếp — P1/P2 theo loại bài

`lib/drive/connection.ts:93`: đọc encrypted token từ Supabase, tạo OAuth client mới, gọi userinfo xác minh tài khoản (và có thể refresh access token). `lib/drive/sectionContent.ts:20`: tiếp tục đọc metadata rồi tải toàn bộ media. GET content còn kiểm tra quyền và đọc section trước đó; TSX compile lại trong bộ nhớ mỗi lần GET. Upload gửi file rồi tải lại để xác minh hash, làm tăng thời gian nhưng kiểm chứng byte là chức năng cần giữ.

Phương án: reuse client/access token có TTL và cơ chế vô hiệu hóa khi reconnect; giữ xác minh identity bắt buộc ở kết nối và khi trạng thái thay đổi; cache file/compiled output có version và dung lượng tối đa, sau kiểm tra quyền hiện tại. Không bỏ bước hash verification để làm upload nhanh hơn.

### 8. AI có chuỗi chờ dài và công việc chạy trong request — P2

`app/api/ai/chat/route.ts`: kiểm tra role, tải KB/rules/docs, exact cache, semantic cache, retrieval rồi mới generation. Semantic lookup, retrieval và semantic cache write đều có đường gọi embedding riêng; khi cùng query đi qua cả ba có thể tính embedding lặp. Response/stream done còn đợi cache writes. Stream chưa có cancel handler truyền xuống SDK. Gemini fallback thử nhiều model nối tiếp mà chưa có ngân sách deadline tổng được cấu hình rõ ở client này.

`app/api/ai/upload/route.ts:296` poll indexing tối đa 45 giây, ngoài tải lên/extract/index; `app/api/ai/reindex/route.ts:69` chạy loop nhiều document trong request.

Phương án: reuse embedding trong cùng request, parallel những reads độc lập, giới hạn deadline/fallback, xử lý cancellation, chuyển ingest/reindex sang worker có trạng thái tiến độ. Giữ retrieval scope, citation guard và chất lượng fallback. Không kết luận một model trong danh sách không tồn tại nếu chưa xác minh qua API của tài khoản.

### 9. Cache AI có thể bị vô hiệu hóa lâu sau lỗi tạm thời — P2

`lib/ai/retrieval.ts:161`: khi read cache có error, responseCacheStorageAvailable=false; lần sau trả null ngay. Vector và semantic storage có cơ chế tương tự. Một lỗi kết nối tạm thời có thể dẫn đến các lượt sau bỏ cache/retrieval trên instance đó, gây nhiều request Gemini hơn.

Phương án: chỉ ghi nhớ thiếu schema khi xác định đúng error code; lỗi network dùng backoff có thời hạn và thử phục hồi. Giới hạn dung lượng memory cache ở cả đường hydrate từ DB.

### 10. Report và bulk admin đọc/ghi nhiều dữ liệu trong một request — P2

`app/api/admin/report/route.ts:174`: đọc 7 nguồn có phân trang, gom bộ nhớ rồi mới lọc section và tạo toàn bộ Excel buffer. Dataset lớn hoặc nhiều người xuất cùng lúc tăng DB traffic, RAM, CPU. Reset/bulk update/reindex có loops tuần tự; đây là thao tác quản trị, không phải chi phí mặc định mỗi lần đổi slide.

Phương án: filter/pagination ở DB càng sớm càng tốt, giữ cấu trúc learner audit có multi-section; export lớn bằng job/stream. Đảm bảo retry không ghi lặp và không thay đổi semantics reset.

### 11. Metadata hình ảnh có thể làm catalog lớn khi sử dụng thêm — P2

Catalog kéo toàn bộ description JSON chứa configuration, icon và layout data. Hiện description tổng chỉ khoảng 24,8 KB nên chưa phải lý do chính của độ trễ dài. Nếu thêm nhiều hình data URL/layout gần giới hạn 2 MB, mỗi lần resolve access sẽ kéo lại cùng dữ liệu nặng.

Phương án: tách asset và metadata trình bày khỏi đường kiểm tra quyền, giữ asset private/public theo đúng yêu cầu. Đây là nguy cơ khi tăng dữ liệu, không phải nghẽn đã đo ở catalog hiện tại.

### 12. Giao diện có chi phí GPU và delay chủ động, nhưng không giải thích mọi request chậm — P2

Landing có WebGL frameloop always khi hiển thị, environment/refraction, CSS ambient animation và overlay 1,56 giây; login UI chờ 1,5 giây sau thành công. Đã có adaptive DPR và dừng cảnh khi hidden/out of view. Bài test dùng login API nên số đo đăng nhập không gồm delay UI và WebGL landing.

Phương án giữ thiết kế: memo các subtree không thay đổi, scheduling tải scene sau nội dung tương tác, giảm phân bổ per-frame, giữ pause khi ẩn. Thay đổi thời lượng hiệu ứng là thay đổi trải nghiệm, cần tách khỏi tối ưu logic.

## Thứ tự thực hiện đề nghị

1. Gắn telemetry server theo auth/catalog/identity/query/Drive/Gemini, không log passcode hoặc token; đo request từ Vercel đến Supabase để đối chiếu với local.
2. Resolve quyền một lần mỗi request, deadline/cancellation cho reads, kiểm tra index thực tế và vùng đặt app/DB.
3. Guard/gộp request quiz, ideas, showcase; tách presence cleanup; giữ hành vi Realtime và TTL.
4. Giải quyết đường file lớn Vercel; reuse/caching Drive có version và xác thực.
5. Tối ưu worker AI/export và xử lý UI ở mức thấp hơn.

Đổi hosting đơn thuần không chữa được request bị lặp hoặc Supabase/Drive chậm. Vercel region thực tế, plan, Fluid Compute và region Supabase hiện chưa được đọc từ dashboard. Mã repo không có cấu hình preferredRegion/vercel.json; không được suy ra deployment chắc chắn đang ở region mặc định.

## Dự phòng Vercel

### Đề nghị: một web service Node luôn chạy trên Render

Ứng dụng đang dùng Next.js SSR, cookie, API, Node crypto/filesystem, Supabase, Google OAuth và Gemini. Bản production local đã chạy được bằng next start, do đó fallback Node ít yêu cầu thay đổi application logic hơn chuyển sang static hosting hoặc runtime khác. Render hỗ trợ Next.js Node web service và có region Singapore; chọn region theo latency tới Supabase, không chỉ theo vị trí học viên.

Chuẩn bị cùng release đã kiểm thử trên host dự phòng; build bằng npm ci --include=dev và npm run build, start bằng npm start với PORT của host. Chú ý lib/sectionContent.ts import typescript ở runtime trong khi package.json đặt nó ở devDependencies: không prune devDependencies tùy ý, hoặc đóng gói standalone có kiểm tra file tracing đầy đủ. Docker/VPS là lựa chọn thay thế nếu cần kiểm soát upload limits, worker và RAM nhiều hơn.

Không dùng free sleeping instance làm dự phòng cần sẵn sàng: Render Free spin down sau 15 phút không có inbound traffic. Health endpoint nên tách readiness app và status phụ thuộc; monitoring không ghi vào DB. Với Docker standalone phải copy public và .next/static, giữ handout trong tracing và kiểm tra thực tế PDF/PPTX/TSX/OAuth/SSE trước khi nhận traffic.

[Render Next.js](https://render.com/docs/deploy-nextjs-app), [Render regions](https://render.com/docs/regions), [Render free services](https://render.com/docs/free), [Render health checks](https://render.com/docs/health-checks), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

### Domain và chuyển hướng khi có sự cố

- Dùng domain riêng do mình quản lý làm domain chính, cùng một hostname có thể chuyển origin từ Vercel sang Render/VPS. Domain *.vercel.app không thể dùng như hostname tự quản để trỏ sang nhà cung cấp khác.
- Chuẩn bị sẵn hostname backup riêng để mở ngay khi domain chính chưa chuyển xong. Khi đổi hostname, cookie host-only hiện tại không đi theo và học viên có thể cần đăng nhập lại.
- Deploy cùng commit, cùng schema Supabase, cùng PASSCODE_SESSION_SECRET. Cookie trên hostname chính có thể tiếp tục được xác minh sau chuyển origin nếu keys/state vẫn khớp; sessionStorage và vị trí slide phụ thuộc origin của trình duyệt.
- Register exact Google OAuth callback cho hostname backup; thiết lập GOOGLE_DRIVE_REDIRECT_URI đúng host và whitelist domain cho Google Picker. Nếu hostname chính được chuyển origin và callback vẫn cùng hostname thì cũng phải kiểm thử OAuth state/cookie thực tế.
- NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY phải có lúc build, cùng các secret server runtime. Không đặt secret vào NEXT_PUBLIC_* hoặc commit .env.
- DNS failover không bảo đảm đổi ngay cho mọi máy; TTL và cache resolver có ảnh hưởng. Chỉ cam kết thời gian chuyển sau khi đã diễn tập và đo. Có thể dùng health-based routing, nhưng phải xác minh quy tắc proxy/payload/SSE và bảo vệ admin APIs.

Mục tiêu ban đầu hợp lý: backup luôn chạy, cùng release, có URL mở ngay và runbook chuyển thủ công đã diễn tập. Chưa có host hoặc DNS nào được tạo/chuyển trong lượt rà soát này.

### Dự phòng hosting khác với backup dữ liệu

Render/VPS dùng chung Supabase và Drive giúp khắc phục sự cố Vercel, nhưng không khắc phục sự cố Supabase/Drive/Gemini. Cần backup riêng:

- Database schema/migrations, course/section metadata, submissions, quiz/feedback, audit logs và encrypted Drive connection.
- File Drive gốc và file Supabase Storage legacy, kèm manifest ánh xạ section/file/version/hash; DB dump không chứa bytes của Storage objects.
- Bản release có thể build lại, cấu hình domain/OAuth và secrets trong kho bí mật ngoài Vercel. Giữ ổn định PASSCODE_SESSION_SECRET vì nó cũng là nền tảng giải mã Drive token.
- Kiểm thử restore trong môi trường riêng; không restore đè live chỉ để kiểm tra. Bản PDF/PPTX/handout offline giúp tiếp tục giảng dạy khi nhiều backend cùng gặp vấn đề, nhưng không có tương tác/đồng bộ đầy đủ.

[Supabase backup coverage](https://supabase.com/docs/guides/platform/backups).
