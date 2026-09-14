# Section 2 · Design & Typography Format

Đây là baseline bắt buộc cho mọi patch Section 2 tiếp theo.

## Font stack

```css
font-family: "Inter", "Noto Sans", "Segoe UI", Arial, sans-serif;
```

Không dùng font trang trí. Nếu thiết bị chưa có Inter, giao diện tự chuyển sang Noto Sans hoặc Segoe UI để giữ độ rộng chữ ổn định.

## Type scale chuẩn

| Vai trò | Biến CSS | Cỡ chữ | Line-height | Weight |
|---|---|---:|---:|---:|
| Cover | `--type-cover` | 42px | 1.16 | 700 |
| Slide title | `--type-title` | 32px | 1.16 | 760 |
| Statement | `--type-statement` | 34px | 1.20 | 650–760 |
| Card title | `--type-card-title` | 20px | 1.30 | 700 |
| Large body | `--type-large-body` | 21px | 1.48 | 500–650 |
| Body | `--type-body` | 16px | 1.48 | 450–550 |
| Uppercase label | `--type-label` | 12px | 1.20 | 800 |
| Helper / progress | `--type-helper` | 13px | 1.40 | 500–700 |

## Layout rules

- Canvas gốc: `960 × 540`; portal chịu trách nhiệm scale toàn bộ slide.
- Tiêu đề bắt đầu sau corner mark, dùng cùng khoảng lề và baseline giữa các slide.
- Nội dung chính không nhỏ hơn 16px; helper text không nhỏ hơn 12px.
- Card dùng hierarchy: label → card title → body, không tự tạo thêm cỡ chữ ngoài token nếu không có lý do trình bày rõ ràng.
- Navy là màu nền chức năng; Gold chỉ dùng cho nhãn, tiến độ, trạng thái và điểm nhấn.
- Motion mặc định: fade + dịch dọc 9px trong 620ms.
- Motion mạnh chỉ dùng cho slide chuyển ý/nhấn ý: 17, 19–22, 27–28 và 30–32; vẫn phải hỗ trợ `prefers-reduced-motion`.
- Tương tác kéo-thả phải có phương án chạm: chọn thẻ, sau đó chạm vùng đích.
- Tác vụ đúng khóa thẻ tại đích; tác vụ sai báo trạng thái và đưa thẻ về vị trí ban đầu.
- Sau khi hoàn thành, kết quả đúng được giữ lại; không tự hiện nút làm lại trừ khi yêu cầu mới nói rõ.
- Mọi animation phải tắt trong `prefers-reduced-motion: reduce`.

## Phạm vi đã áp dụng

- Typography baseline: slide 1–10.
- Transition nhẹ: slide 1–18 (slide 15 giữ nguyên blank).
- Interaction pattern: slide 10, 11, 14 và 18.
- Slide 11/14 dùng lựa chọn linh hoạt: chọn từ 1 mục trở lên, bấm `Hoàn thành`, preview chỉ dựng đúng các thành phần đã chọn và đóng preview vẫn giữ nguyên slide.
- Slide 11/14 dùng đúng hai trạng thái màu: toàn bộ ô chưa chọn cùng một màu; toàn bộ ô đã chọn cùng một màu khác.
- Slide 15 chứa Requirement tổng hợp; Slide 16 là demo 4 khung đồng bộ Form → Excel → Người duyệt → Dashboard.
- Slide 29: bốn khung quay đúng 2 vòng, sau đó tự dừng ở bố cục 2 hàng theo thứ tự 1 → 4; nội dung và số thứ tự không thay đổi.
- Slide 30: một nút tải đồng thời `Gemini-Prompt.txt`, `App-01-Source.zip` và `App-02-Source.zip` từ `public/downloads`.
- Slide 30–32 dùng strong motion theo cùng nhịp, có trạng thái tĩnh đầy đủ khi bật `prefers-reduced-motion`.
