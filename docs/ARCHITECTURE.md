# Interaction Architecture

## Layers

1. **PDF layer** — React-PDF render nguyên PDF.
2. **Interaction layer** — React component phủ trên PDF.
3. **App chrome** — header, navigation, zoom, fullscreen, login.

## Routing

`components/PdfDeck.tsx`
→ `components/interactions/InteractionLayer.tsx`
→ component riêng theo `pageNumber`.

Slide 1 được render `SlideOneAIHero` trực tiếp trong `PdfDeck.tsx`; các slide còn lại đi qua `InteractionLayer`.

## Isolation rule

Các interaction mới/phức tạp dùng cặp file:

- `SlideXxx.tsx`
- `SlideXxx.module.css`

Không thêm CSS toàn cục cho từng slide mới nếu không thật sự cần, nhằm tránh regression giữa các slide.

## Current PDF remap

Bốn trang 10–13 của PDF cũ đã bị xóa. Vì vậy nội dung từ trang 14 cũ trở đi đã dịch lên 4 trang. Mapping hiện tại trong `InteractionLayer.tsx` đã phản ánh PDF mới.

## Source of truth

Không dùng các folder interaction lồng/duplicate. Source interaction duy nhất là:

`components/interactions/`
