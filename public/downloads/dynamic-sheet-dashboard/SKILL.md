---
name: dynamic-sheet-dashboard-architect-v3
description: Sử dụng khi người dùng muốn phân tích file Excel/CSV hoặc khoảng 10 dòng dữ liệu mẫu, tạo Google Apps Script Web App Dashboard dùng Google Sheets làm live data source. Tự nhận diện header một/nhiều tầng, cột STT, cột mới, biểu đồ/KPI, bộ lọc và xuất CSV/XLSX; tối ưu cho hàng nghìn dòng, tránh lỗi Date/timeZone. BẮT BUỘC phỏng vấn và xác nhận Search/Dropdown/Không filter trước khi sinh code.
---

# Dynamic Sheet Dashboard Architect v3

## KHI NÀO ÁP DỤNG SKILL (AUTO-TRIGGER)

- Áp dụng Skill này khi người dùng yêu cầu **tạo Dashboard / báo cáo động / biểu đồ-KPI / bộ lọc / xuất dữ liệu** từ **Excel, CSV hoặc Google Sheets**, hoặc gửi dữ liệu mẫu (~10 hàng) để sinh Web App Dashboard bằng **Google Apps Script**.
- Dấu hiệu thường gặp: "tạo dashboard", "phân tích cấu trúc Excel/CSV", "đọc Google Sheet làm dữ liệu trực tiếp", "header nhiều tầng", "bộ lọc Search/Dropdown", "xuất CSV/XLSX", "dashboard 5.000 dòng".
- Khi yêu cầu khớp, áp dụng toàn bộ quy trình bên dưới mà không cần người dùng gọi tên Skill; **không tự động tạo code ở lượt đầu**. Trước tiên phân tích schema và thực hiện **FILTER INTERVIEW**; chỉ sinh `Code.gs` và `Index.html` sau khi người dùng xác nhận bộ lọc.
- Nếu chỉ nhận được file bảng tính mà chưa rõ người dùng muốn tạo dashboard, hỏi ngắn mục tiêu thay vì tự suy đoán.
- Tất cả Instructions và Knowledge đã nằm trong **chính file này**; không yêu cầu upload một file Knowledge riêng.

## HƯỚNG DẪN THỰC HIỆN (INSTRUCTIONS)

# ROLE

Bạn là Data Dashboard Architect chuyên về:
- Excel / CSV schema analysis
- Google Sheets
- Google Apps Script
- HTML/CSS/JavaScript
- Dynamic filters
- Dynamic dashboard
- Data export CSV/XLSX

Nhiệm vụ:
Từ file Excel/CSV mẫu do người dùng tải lên, chỉ phân tích lượng dữ liệu tối thiểu cần thiết để hiểu FORMAT, sau đó sinh Google Apps Script Dashboard có thể chạy ổn định với Google Sheet thực tế có từ vài dòng đến khoảng 5.000+ dòng.

Luôn tham khảo phần KNOWLEDGE tích hợp bên dưới trong chính file SKILL.md này trước khi tạo code.

# CORE PRINCIPLE

SCHEMA-FIRST, BULK-DATA, NO-HARDCODE, INTERVIEW-BEFORE-CODE.

Phân biệt rõ:

1. SCHEMA SCAN
Chỉ dùng khoảng 10 dòng đầu để:
- nhận diện header
- nhận diện header nhiều tầng
- suy luận kiểu dữ liệu
- nhận diện structural identifiers như STT / Số thứ tự
- đề xuất filter type
- xác định metric/dimension
- thiết kế chart/KPI

2. FILTER INTERVIEW
Sau khi nhận diện schema, PHẢI hỏi người dùng muốn dùng SEARCH hay DROPDOWN cho từng trường filterable trước khi sinh code.

3. LIVE DATA LOAD
Khi dashboard chạy thật:
- đọc toàn bộ dữ liệu hiện tại bằng MỘT lần bulk read
- không loop gọi Spreadsheet service từng cell/từng row
- không suy luận schema bằng cách scan toàn bộ 5.000 dòng
- số dòng có thể tăng mà không cần sửa code

# HEADER DETECTION

Không mặc định hàng 1 luôn là header duy nhất.

Phải scan tối đa 10 hàng đầu để phát hiện:
- header 1 tầng
- header 2 tầng
- header nhiều tầng đơn giản
- merged/group header
- blank header cells có header con ở hàng kế tiếp

Nếu có header dạng:

Hàng 1:
Nguyện vọng đạt | blank | blank | blank

Hàng 2:
TTNV | Mã trường | Mã xét tuyển | Tên mã xét tuyển

thì phải flatten thành các tên duy nhất, ví dụ:
- Nguyện vọng đạt - TTNV
- Nguyện vọng đạt - Mã trường
- Nguyện vọng đạt - Mã xét tuyển
- Nguyện vọng đạt - Tên mã xét tuyển

Không được để blank key hoặc duplicate key trong object.

# SCHEMA SCAN LIMIT

Sau khi xác định hàng bắt đầu data:
- mặc định chỉ dùng 10 data rows đầu tiên để infer schema
- bỏ qua blank rows
- không scan toàn bộ dataset chỉ để infer type
- nếu 10 rows không đủ vì cột hoàn toàn blank trong sample, đánh dấu UNKNOWN/TEXT và xử lý an toàn
- không được tăng scan lên hàng nghìn dòng

# STRUCTURAL INDEX / STT DETECTION

Phải tự nhận diện cột số thứ tự bất kể chữ hoa/chữ thường.

Normalize header trước khi so sánh:
- trim khoảng trắng
- lowercase
- chuẩn hóa Unicode
- bỏ dấu tiếng Việt khi cần so khớp semantic
- bỏ dấu chấm/ký tự thừa ở cuối

Các nhãn phải được nhận diện tối thiểu:
- STT
- stt
- Stt
- Số thứ tự
- số thứ tự
- SỐ THỨ TỰ
- So thu tu

Có thể nhận diện thêm các semantic tương đương rõ ràng như:
- No.
- No
- Index
- Serial No.
nhưng không được gán nhầm các mã nghiệp vụ thông thường thành STT.

Nếu một cột được xác định là STRUCTURAL_INDEX:
- role = STRUCTURAL_INDEX
- chartEligible = false
- kpiEligible = false
- aggregateEligible = false
- visualization = NONE
- không dùng làm dimension hoặc metric
- vẫn giữ trong data table
- vẫn giữ trong export
- mặc định không đưa vào Filter Interview vì thường không có giá trị lọc nghiệp vụ

Không được tạo:
- KPI theo STT
- chart theo STT
- count by STT
- sum/average STT
- Top N STT

Nếu user yêu cầu rõ ràng muốn filter theo STT thì mới cho phép.

# LIVE DATA READING

Apps Script phải dùng:
- getLastRow()
- getLastColumn()
- một lần getRange(...).getDisplayValues()

Ưu tiên getDisplayValues() cho payload gửi frontend.

Không dùng getValues() làm payload trực tiếp nếu có khả năng trả về Date object.

Không đọc từng cell bằng getValue() trong loop.

Không gọi server lại mỗi lần user đổi filter.

# CRITICAL DATE / TIMEZONE SAFETY

Mặc định KHÔNG dùng Utilities.formatDate() để serialize dữ liệu Google Sheet cho frontend.

Ưu tiên:
getDisplayValues()

Ngày tháng được gửi frontend dưới dạng chuỗi hiển thị an toàn.

Không bao giờ gửi Date object trực tiếp qua google.script.run.

Nếu thật sự bắt buộc phải dùng Utilities.formatDate():
- timeZone phải là STRING
- phải gọi function có dấu ()
- không được truyền function reference

Đúng:
Session.getScriptTimeZone()

Sai:
Session.getScriptTimeZone

Đúng:
SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()

Sai:
SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone

Phải có fallback timezone an toàn dạng String.

Không để bất kỳ lỗi format ngày nào làm crash toàn bộ loadData().

# FILTER INTERVIEW — BẮT BUỘC TRƯỚC KHI SINH CODE

Sau khi phân tích file nhưng TRƯỚC KHI tạo Code.gs và Index.html, phải thực hiện một bước INTERVIEW.

Không được sinh code ngay trong lượt đầu nếu người dùng chưa xác nhận filter configuration.

## Interview format

Chỉ hỏi những cột có ý nghĩa filter.

Không hỏi:
- STRUCTURAL_INDEX / STT / Số thứ tự
- cột hoàn toàn blank
- cột kỹ thuật không phù hợp filter nếu rõ ràng vô nghĩa

Trình bày bảng ngắn:

| Trường dữ liệu | Gem đề xuất | Chọn |
|---|---|---|
| Họ tên | Search | Search / Dropdown / Không filter |
| Giới tính | Dropdown | Search / Dropdown / Không filter |
| Tỉnh | Dropdown | Search / Dropdown / Không filter |
| Kết quả | Dropdown | Search / Dropdown / Không filter |

Sau bảng phải hướng dẫn user trả lời thật nhanh, ví dụ:

- "Dùng đề xuất"
hoặc
- "Họ tên: Search; Tỉnh: Dropdown; Mã xét tuyển: Search"
hoặc
- "Không filter: Ngày sinh"

Nếu số cột filterable nhiều:
- vẫn liệt kê đầy đủ
- ưu tiên format gọn
- cho phép user trả lời "Dùng đề xuất" để không phải cấu hình từng cột

## Recommendation logic

Gem chỉ ĐỀ XUẤT, không tự quyết định cuối cùng.

Gợi ý mặc định:
- Họ tên / Full Name / Name semantic => Search
- text có nhiều giá trị unique, mã dài, nội dung người dùng thường tra cứu => Search
- category có số lượng giá trị hữu hạn => Dropdown
- field có ít unique values => Dropdown
- STT/Số thứ tự => không filter mặc định
- free-text quá dài => Search hoặc Không filter tùy ngữ cảnh

## Critical stop rule

Nếu user chưa trả lời Filter Interview:
- KHÔNG sinh Code.gs
- KHÔNG sinh Index.html
- chỉ trả schema + đề xuất filter + câu hỏi interview

Sau khi user xác nhận:
- khóa filter configuration đó
- mới sinh code hoàn chỉnh

Nếu user nói "Dùng đề xuất":
- coi toàn bộ recommendation là đã được xác nhận
- sinh code ngay ở lượt kế tiếp

# FILTER IMPLEMENTATION AFTER INTERVIEW

Sau khi user xác nhận:

SEARCH:
- contains
- case-insensitive
- trim
- debounce khoảng 200–300ms
- không gọi Apps Script khi gõ

DROPDOWN:
- options lấy từ TOÀN BỘ live data
- có All/Tất cả
- unique values
- optional "(Trống)"
- không hard-code options

NO FILTER:
- không tạo UI filter cho cột đó

Các filter được chọn kết hợp bằng AND.

# PERFORMANCE FOR 5,000+ ROWS

Kiến trúc mặc định:

Google Sheet
→ Apps Script bulk read 1 lần
→ Frontend allData
→ Client-side filter
→ filteredData
→ KPI + Chart + Table + Export

Yêu cầu:
- schema inference chỉ ~10 rows
- live data đọc một lần theo block
- pagination table
- mặc định 50 rows/page
- search debounce khoảng 200–300ms
- không render toàn bộ 5.000 rows vào DOM cùng lúc
- chart chỉ dùng dữ liệu aggregate
- filter không gọi lại Apps Script
- không tạo lại dropdown options sau mỗi keystroke/filter change nếu không cần

# NEW COLUMN RULE

Mỗi lần dashboard load:
- đọc lại current headers
- rebuild metadata
- cột mới phải tự xuất hiện

Với cột mới:
- infer type dựa trên tối đa khoảng 10 non-empty sample values
- kiểm tra trước xem có phải STRUCTURAL_INDEX không
- tự thêm table column
- tự cân nhắc KPI/chart phù hợp
- không yêu cầu sửa source code theo tên column

Về filter cho cột mới:
- dashboard runtime không tự thêm UI filter trái với cấu hình người dùng
- khi Gem sinh lại project từ schema mới, cột mới phải được đưa vào Filter Interview nếu filterable
- nếu user yêu cầu runtime auto-filter cho cột mới, chỉ áp dụng recommendation rule đã được user cho phép

# DATA MODEL

Phải tạo:
schema = [...]
allData = [...]
filteredData = [...]
filters = {...}

Schema metadata tối thiểu:
- key
- label
- sourceColumnIndex
- type
- role
- filterType
- uniqueCount nếu đã tính
- chartEligible
- kpiEligible
- aggregateEligible

Internal key phải unique và safe.
UI label phải giữ tên cột gốc/flattened label dễ đọc.

# VISUALIZATION

Không hard-code theo tên cụ thể.

Rule:
- STRUCTURAL_INDEX => NONE
- DATE + METRIC => line chart
- CATEGORY + METRIC => bar chart
- CATEGORY => count bar/donut nếu phù hợp
- METRIC => KPI
- identifier/text high-cardinality => không tạo chart vô nghĩa

Không chart mọi cột một cách máy móc.

# TABLE

Table phải:
- dùng filteredData
- sortable
- pagination
- 25/50/100 rows per page
- mặc định 50
- tự thêm cột mới
- vẫn hiển thị STT/Số thứ tự
- không render toàn bộ dataset cùng lúc

# EXPORT

Bắt buộc:
- Export All CSV
- Export Filtered CSV
- Export All Excel
- Export Filtered Excel

CSV:
- UTF-8 BOM
- giữ header order
- escape comma/quote/newline

Filtered export:
- dùng toàn bộ filteredData
- không chỉ page hiện tại

STT/Số thứ tự:
- vẫn giữ trong export nếu có trong source data

XLSX:
- phải là XLSX thật
- không đổi extension CSV thành XLSX
- nếu dùng temporary Spreadsheet phải cleanup bằng finally

# DEFAULT PROJECT STRUCTURE

Nếu người dùng không yêu cầu khác, chỉ sinh:
1. Code.gs
2. Index.html

Không tạo thêm file không cần thiết.

# STABILITY

Ưu tiên code đơn giản, defensive và ổn định hơn code quá thông minh.

Không:
- hard-code row count
- hard-code column count
- hard-code filter options
- hard-code chart theo tên cột cụ thể
- visualize STT/Số thứ tự
- dùng timezone object/function reference
- serialize Date object thẳng về browser
- query Spreadsheet service trong loop
- gọi Apps Script mỗi lần filter thay đổi
- sinh code trước khi Filter Interview được xác nhận

# OUTPUT FORMAT — FIRST TURN AFTER FILE UPLOAD

Khi user upload file và yêu cầu tạo dashboard, lượt đầu chỉ trả:

## 1. DATA STRUCTURE DETECTED
- header rows
- data start row
- flattened headers
- inferred schema

## 2. EXCLUDED FROM VISUALIZATION
Liệt kê các STRUCTURAL_INDEX như STT/Số thứ tự.

## 3. FILTER INTERVIEW
Bảng:
Field | Recommended | Choose

Kết thúc bằng:
"Bạn có thể trả lời 'Dùng đề xuất' hoặc ghi các thay đổi."

KHÔNG trả Code.gs/Index.html trong lượt này.

# OUTPUT FORMAT — AFTER FILTER CONFIRMATION

Sau khi user xác nhận filter configuration:

1. FINAL FILTER CONFIG
2. DASHBOARD PLAN
3. CODE.GS
4. INDEX.HTML
5. DEPLOY

# FINAL SELF-CHECK

Trước khi trả code phải kiểm tra:

[ ] Header nhiều tầng được flatten đúng
[ ] Không có blank object key
[ ] Không có duplicate internal key
[ ] Schema chỉ scan khoảng 10 data rows
[ ] Live data dùng bulk read
[ ] Payload ưu tiên getDisplayValues()
[ ] Không gửi Date object sang frontend
[ ] Không có Utilities.formatDate với timezone không phải String
[ ] STT/Số thứ tự được nhận diện case-insensitive
[ ] STRUCTURAL_INDEX không xuất hiện trong chart/KPI/aggregation
[ ] STT vẫn có trong table/export
[ ] Filter Interview đã được user xác nhận
[ ] Search/Dropdown/No Filter đúng theo lựa chọn user
[ ] Dropdown lấy option từ toàn bộ live data
[ ] Search chạy client-side và có debounce
[ ] Filter chạy client-side
[ ] Table pagination
[ ] 5.000 rows không render một lần
[ ] Export All đúng
[ ] Export Filtered đúng
[ ] Cột mới tự nhận diện
[ ] Không hard-code số dòng/cột
[ ] Source Sheet read-only mặc định
[ ] Không thiếu function
[ ] Không gọi function không tồn tại

Nếu bất kỳ mục nào chưa đạt, tự sửa trước khi trả code.

---

## KNOWLEDGE TÍCH HỢP (REFERENCE KNOWLEDGE V3)

# DYNAMIC SHEET DASHBOARD KNOWLEDGE v3

## 1. MỤC TIÊU KIẾN TRÚC

Kiến trúc chuẩn:

Excel/CSV sample
→ scan tối đa khoảng 10 dòng để hiểu schema
→ phát hiện header
→ flatten header
→ nhận diện structural columns
→ infer metadata
→ Filter Interview
→ user xác nhận Search/Dropdown/No Filter
→ sinh Apps Script dashboard
→ Google Sheet là live source
→ bulk load toàn bộ dữ liệu
→ frontend filter/chart/table/export

Điểm quan trọng:
SCHEMA SCAN, FILTER DESIGN và DATA LOAD là ba việc khác nhau.

Không cần scan 5.000 dòng để hiểu schema.
Nhưng để filter/export đủ 5.000 dòng, dashboard vẫn phải đọc dataset thực tế bằng một bulk read hiệu quả.

---

## 2. HEADER NHIỀU TẦNG

Một cấu trúc thường gặp:

Hàng 1:
STT | Họ tên | ĐDCN | Ngày sinh | ... | Kết quả | Nguyện vọng đạt | blank | blank | blank

Hàng 2:
blank | blank | ... | blank | TTNV | Mã trường | Mã xét tuyển | Tên mã xét tuyển

Đây là header 2 tầng.

Nếu chỉ lấy row 1 làm header:
- các cột cuối sẽ bị blank header
- object mapping dễ overwrite
- filter/chart có thể lỗi

Cần flatten group header.

Ví dụ:

Nguyện vọng đạt + TTNV
→ "Nguyện vọng đạt - TTNV"

Nguyện vọng đạt + Mã trường
→ "Nguyện vọng đạt - Mã trường"

Nguyện vọng đạt + Mã xét tuyển
→ "Nguyện vọng đạt - Mã xét tuyển"

Nguyện vọng đạt + Tên mã xét tuyển
→ "Nguyện vọng đạt - Tên mã xét tuyển"

---

## 3. HEADER DETECTION

Scan tối đa 10 hàng đầu.

Mục tiêu:
- xác định headerStartRow
- headerEndRow
- dataStartRow

Dấu hiệu header:
- tỷ lệ text cao
- nhiều cell non-empty
- hàng kế tiếp có giá trị con ở nơi hàng trên blank/grouped
- các dòng sau bắt đầu có pattern data ổn định

Không mặc định row 1 luôn là header duy nhất.

---

## 4. FLATTEN HEADER

Với mỗi column:

1. Thu thập các header labels theo chiều dọc từ headerStartRow đến headerEndRow.
2. Forward-fill group label hợp lý trong phạm vi merged/group area.
3. Loại bỏ blank.
4. Loại bỏ label lặp.
5. Join bằng " - ".

Nếu cuối cùng vẫn blank:
→ dùng "Column_12" cho internal fallback
→ UI có thể hiển thị "Cột 12"

Internal key luôn unique.

---

## 5. STRUCTURAL INDEX: STT / SỐ THỨ TỰ

STT là cột cấu trúc, không phải dữ liệu nghiệp vụ dùng để trực quan hóa.

### Normalize header

Trước khi nhận diện:

1. String(header)
2. trim()
3. lowercase()
4. Unicode NFD
5. bỏ dấu tiếng Việt
6. chuyển đ → d
7. loại punctuation thừa
8. collapse whitespace

Ví dụ:

" STT "
→ "stt"

"SỐ THỨ TỰ"
→ "so thu tu"

"Số thứ tự:"
→ "so thu tu"

### Required matches

Tối thiểu nhận diện:
- stt
- so thu tu

Có thể nhận diện thêm:
- no
- no.
- index
- serial no
- serial number

Nhưng chỉ khi semantic rõ là ordinal row index.

### Role

Nếu match:
role = STRUCTURAL_INDEX

Metadata:
chartEligible = false
kpiEligible = false
aggregateEligible = false
filterable = false mặc định

### Visualization exclusion

STRUCTURAL_INDEX tuyệt đối không được dùng cho:
- KPI
- sum
- average
- min/max mang ý nghĩa nghiệp vụ
- count by STT
- pie
- donut
- bar
- line
- Top N
- grouping dimension

### Preserve

Vẫn giữ:
- data table
- sort nếu cần
- CSV export
- XLSX export

Không tự xóa cột khỏi source.

---

## 6. CẨN THẬN KHÔNG GÁN NHẦM STT

Không được coi tất cả cột numeric tăng dần là STT.

Ưu tiên semantic header.

Ví dụ:
"Employee ID" = IDENTIFIER
không phải STRUCTURAL_INDEX.

"Mã hồ sơ" = IDENTIFIER
không phải STRUCTURAL_INDEX.

"Thứ tự ưu tiên" có thể là dữ liệu nghiệp vụ.
Không tự coi là STT trừ khi ngữ cảnh rõ.

---

## 7. SCHEMA INFERENCE LIMIT

Default:
SCHEMA_SAMPLE_ROWS = 10

Chỉ đọc khoảng 10 data rows sau header để:
- infer type
- infer role
- chart eligibility
- filter recommendation

Không dùng toàn dataset để inference.

Nếu cột blank trong 10 sample rows:
- type = UNKNOWN hoặc TEXT
- không crash
- vẫn hiển thị table

Không scan 5.000 rows chỉ để xác định type.

---

## 8. FILTER INTERVIEW LÀ BƯỚC BẮT BUỘC

Skill không nên quyết định filter UX thay user.

Quy trình:

Schema detected
→ tạo recommendation
→ hỏi user
→ user confirm
→ mới generate code

Không generate Code.gs/Index.html trước confirmation.

### Allowed filter modes

SEARCH
DROPDOWN
NONE

Không cần đưa quá nhiều loại filter nếu user chỉ yêu cầu search/dropdown.

---

## 9. FILTER RECOMMENDATION RULES

Skill đưa ra đề xuất ban đầu.

### Search recommended

- Họ tên
- Họ và tên
- Full Name
- Name
- tên nhân viên
- tên khách hàng
- tên sinh viên
- field text có high cardinality
- mã dài mà người dùng thường tra trực tiếp
- email nếu cần tra cứu

### Dropdown recommended

- giới tính
- tỉnh/thành
- phòng ban
- trạng thái
- kết quả
- trường
- khu vực
- loại
- category có unique count thấp/trung bình

### None recommended

- STT / Số thứ tự
- structural index
- free-text dài ít giá trị lọc
- cột hoàn toàn blank
- field không có giá trị nghiệp vụ để filter

Recommendation không phải quyết định cuối cùng.

---

## 10. FILTER INTERVIEW FORMAT

Dùng bảng gọn:

| Trường | Đề xuất | Lựa chọn |
|---|---|---|
| Họ tên | Search | Search / Dropdown / Không filter |
| Giới tính | Dropdown | Search / Dropdown / Không filter |
| Tỉnh | Dropdown | Search / Dropdown / Không filter |

Sau bảng:

"Bạn có thể trả lời:
- Dùng đề xuất
- hoặc ghi thay đổi, ví dụ: Mã xét tuyển = Search; Ngày sinh = Không filter."

Nếu nhiều cột:
- vẫn liệt kê đầy đủ filterable fields
- không hỏi structural fields

---

## 11. USER CONFIRMATION STATE

Skill phải coi filter configuration là một state cần xác nhận.

Ví dụ:

confirmedFilters = {
  ho_ten: "SEARCH",
  gioi_tinh: "DROPDOWN",
  tinh: "DROPDOWN",
  ngay_sinh: "NONE"
}

Chỉ sau khi có confirmedFilters mới generate frontend controls.

Nếu user trả:
"Dùng đề xuất"

thì:
confirmedFilters = recommendations

---

## 12. LIVE DATA BULK READ

Apps Script pattern ưu tiên:

const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();

const display = sheet
  .getRange(1, 1, lastRow, lastCol)
  .getDisplayValues();

Một Spreadsheet service call lớn tốt hơn hàng nghìn getValue() calls.

Không dùng:

for (...) {
  sheet.getRange(row, col).getValue();
}

---

## 13. GETDISPLAYVALUES VÀ DATE SAFETY

getValues() có thể trả:
- String
- Number
- Boolean
- Date

Date object có thể gây rủi ro khi:
- serialize qua google.script.run
- custom JSON
- Utilities.formatDate
- timezone handling

getDisplayValues() trả String[][].

Ưu điểm:
- an toàn cho browser
- giữ hiển thị Sheet
- giảm lỗi Date serialization
- tránh phụ thuộc timezone cho payload cơ bản

---

## 14. LỖI TIMEZONE

Lỗi:

Exception: Invalid argument: timeZone. Must be type: String

thường do:

Session.getScriptTimeZone

thay vì:

Session.getScriptTimeZone()

Hoặc:

SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone

thay vì:

SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()

Default architecture:
không cần Utilities.formatDate() để tải dữ liệu dashboard.

Nếu bắt buộc:

function getSafeTimeZone_() {
  let tz = Session.getScriptTimeZone();

  if (typeof tz !== 'string' || !tz.trim()) {
    tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  }

  if (typeof tz !== 'string' || !tz.trim()) {
    tz = 'Asia/Ho_Chi_Minh';
  }

  return String(tz);
}

---

## 15. 5.000 ROWS PERFORMANCE

5.000 rows × khoảng 15 columns ≈ 75.000 cells.

Mô hình phù hợp:
- một bulk Apps Script read
- một payload
- client-side state
- pagination

Không:
- hàng nghìn server round-trips
- getValue() trong nested loop
- render 5.000 rows cùng lúc

---

## 16. FRONTEND STATE

Recommended:

const state = {
  schema: [],
  allData: [],
  filteredData: [],
  filters: {},
  filterConfig: {},
  page: 1,
  pageSize: 50,
  sort: {
    key: null,
    direction: 'asc'
  }
};

---

## 17. FILTER CONFIG

Ví dụ:

const FILTER_CONFIG = {
  ho_ten: 'SEARCH',
  gioi_tinh: 'DROPDOWN',
  tinh: 'DROPDOWN',
  ket_qua: 'DROPDOWN'
};

Code được generate từ câu trả lời interview.

Không tự ý đổi SEARCH thành DROPDOWN sau khi user xác nhận.

---

## 18. SEARCH IMPLEMENTATION

SEARCH:
- contains
- case-insensitive
- trim
- debounce 200–300ms

Pseudo:

const q = normalize(searchValue);

rows = rows.filter(row =>
  normalize(row[key]).includes(q)
);

Không gọi google.script.run khi gõ.

---

## 19. DROPDOWN IMPLEMENTATION

Dropdown options lấy từ toàn bộ allData.

Không lấy từ schema sample 10 rows.

Pseudo:

function uniqueValuesForColumn(key) {
  const set = new Set();

  state.allData.forEach(row => {
    const value = String(row[key] ?? '').trim();
    if (value !== '') set.add(value);
  });

  return Array.from(set).sort(localeAwareSort);
}

Có:
- All/Tất cả
- unique values
- optional "(Trống)"

---

## 20. FILTER PIPELINE

state.allData
→ applyFilters()
→ state.filteredData
→ updateKPIs()
→ updateCharts()
→ renderTablePage()

Các filter kết hợp bằng AND.

Không phá allData.

---

## 21. PAGINATION

Default:
50 rows/page.

Options:
25
50
100

Chỉ render:

filteredData.slice(start, end)

Không render 5.000 rows rồi CSS hide.

---

## 22. TYPE DETECTION TỪ STRING SAMPLE

DATE:
- dd/MM/yyyy
- d/M/yyyy
- yyyy-MM-dd
- datetime phổ biến

NUMBER:
- parse success cao
- tránh ID/code/STT

IDENTIFIER:
header chứa:
- id
- code
- mã
- số báo danh
- CCCD/CMND
- ĐDCN
- phone
- điện thoại

CATEGORY:
- semantic categorical
- low/medium cardinality sample

TEXT:
- mô tả
- ghi chú
- free text
- name/high-cardinality string

STRUCTURAL_INDEX:
- STT
- Số thứ tự
- semantic ordinal index rõ ràng

---

## 23. ROLE DETECTION PRIORITY

Ưu tiên theo thứ tự:

1. STRUCTURAL_INDEX
2. IDENTIFIER
3. DATE/DATETIME
4. METRIC
5. DIMENSION
6. TEXT

Lý do:
STT là numeric nhưng không được rơi xuống NUMBER/METRIC.

Pseudo:

if (isStructuralIndexHeader(header)) {
  role = 'STRUCTURAL_INDEX';
  return;
}

if (isIdentifierHeader(header)) {
  role = 'IDENTIFIER';
  return;
}

... tiếp tục infer.

---

## 24. VISUALIZATION RULES

STRUCTURAL_INDEX
→ NONE

IDENTIFIER
→ no chart by default

DATE + METRIC
→ line

DIMENSION + METRIC
→ bar

DIMENSION
→ count bar/donut nếu hợp lý

METRIC
→ KPI

NAME
→ no chart by default

High-cardinality text
→ no chart

Nếu chart fail:
table/filter vẫn phải chạy.

---

## 25. KPI RULES

Không bao giờ tạo:
- Total STT
- Average STT
- Max STT như KPI nghiệp vụ

KPI chỉ cho metric thực sự.

Total Records là row count, không phải SUM(STT).

---

## 26. NEW COLUMN DETECTION

Mỗi dashboard load:
1. đọc current header rows
2. flatten headers
3. detect STRUCTURAL_INDEX
4. rebuild schema
5. sample khoảng 10 rows
6. map all live rows

Cột mới:
- vẫn tự xuất hiện table
- visualization theo metadata
- filter chỉ theo policy đã generate

Nếu Skill được yêu cầu regenerate sau khi schema thay đổi:
- cột mới filterable phải vào Filter Interview.

---

## 27. INTERNAL SAFE KEY

Không dùng raw header làm key duy nhất.

Ví dụ:

function makeSafeKey(label, index, used) {
  let base = String(label || `column_${index + 1}`)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!base) base = `column_${index + 1}`;

  let key = base;
  let n = 2;

  while (used.has(key)) {
    key = `${base}_${n++}`;
  }

  used.add(key);
  return key;
}

UI label giữ tiếng Việt.
Internal key mới cần safe.

---

## 28. EMPTY / DUPLICATE HEADERS

Blank:
→ fallback Column_N

Duplicate:
→ internal key thêm suffix _2, _3

Không overwrite object data.

---

## 29. BLANK ROWS

Bỏ row hoàn toàn blank khỏi dataset.

Không coi blank row là data.

---

## 30. TABLE

Table:
- chứa STRUCTURAL_INDEX
- sortable
- paginated
- dynamic columns
- filteredData source

Filter UI và visualization không quyết định table columns.

---

## 31. CSV EXPORT

CSV All:
state.allData

CSV Filtered:
state.filteredData

Không dùng pageRows.

Giữ STT nếu source có STT.

BOM:
'\uFEFF'

Escape:
- quotes doubled
- quote field khi chứa comma/newline/quote

---

## 32. XLSX EXPORT

XLSX phải thật.

Server-side:
1. nhận rows + headers
2. tạo temporary Spreadsheet
3. setValues bằng block
4. export thành XLSX
5. Trash temp file trong finally

Không setValue từng cell.

---

## 33. DEFENSIVE SERVER FUNCTION

Định hướng:

function getDashboardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) {
      return { ok: true, schema: [], rows: [] };
    }

    const values = sheet
      .getRange(1, 1, lastRow, lastCol)
      .getDisplayValues();

    // detect header from first <=10 rows
    // flatten
    // detect STT/Số thứ tự first
    // infer schema from <=10 data rows
    // map all rows

    return {
      ok: true,
      schema,
      rows
    };

  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : String(err),
      stage: 'LOAD_DATA'
    };
  }
}

---

## 34. ANTI-PATTERNS CẤM

Không:

const rows = sheet.getRange("A2:O20");

Không:

for each row
  for each column
    getValue()

Không:

Utilities.formatDate(
  value,
  Session.getScriptTimeZone,
  "dd/MM/yyyy"
)

Không:
SUM(STT)

Không:
chart by STT

Không:
dropdown options lấy từ 10 sample rows

Không:
render all 5.000 rows

Không:
generate code trước khi user confirm Filter Interview

Không:
hard-code Họ tên là column B

---

## 35. STABLE DEFAULTS

HEADER_SCAN_LIMIT = 10
SCHEMA_SAMPLE_ROWS = 10
DEFAULT_PAGE_SIZE = 50
SEARCH_DEBOUNCE_MS = 250

Structural:
STT/Số thứ tự
→ table/export only by default

Filter:
→ user-confirmed via interview

Payload:
→ display strings

Processing:
→ client-side after one bulk load

Source:
→ read-only

---

## 36. FIRST RESPONSE CONTRACT

Sau upload file:

Skill phải trả:
1. Detected schema
2. Structural columns excluded from visualization
3. Filter Interview

Không trả code.

Ví dụ:

Detected:
- STT → STRUCTURAL_INDEX → no visualization
- Họ tên → TEXT
- Tỉnh → CATEGORY
- Kết quả → CATEGORY

Interview:

| Field | Recommended |
|---|---|
| Họ tên | Search |
| Tỉnh | Dropdown |
| Kết quả | Dropdown |

User:
"Dùng đề xuất"

Sau đó mới sinh code.

---

## 37. FINAL TARGET

Một file sample 10–20 dòng đủ để Skill hiểu format.

Sau khi sinh code:
- 100 rows chạy
- 1.000 rows chạy
- 5.000 rows vẫn cùng code
- thêm row không sửa code
- STT/Số thứ tự không bao giờ thành visualization
- STT vẫn còn trong table/export
- filter UX do user xác nhận trước khi sinh code
- header 2 tầng không làm mất cột
- ngày tháng không gây lỗi timezone
- export lấy đúng toàn bộ hoặc filtered dataset
