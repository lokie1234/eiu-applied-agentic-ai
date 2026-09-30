# EIU Applied Agentic AI — Interactive Deck

Hướng dẫn triển khai OTP bằng Google Apps Script và quản lý quyền theo từng section:
[docs/GOOGLE_AUTH_DEPLOYMENT.md](docs/GOOGLE_AUTH_DEPLOYMENT.md).

Bản project hoàn chỉnh hiện tại của Section 1.

## Runtime chính

- Next.js App Router + TypeScript.
- React-PDF render PDF từ `NEXT_PUBLIC_PDF_URL`.
- Google Apps Script gửi OTP + Supabase SSR session + quyền theo từng section.
- Previous / Next, keyboard, mouse wheel, slide number + Enter.
- Zoom, fullscreen, PDF hyperlinks.
- Interaction layer nằm phía trên PDF và không sửa nội dung PDF.

## Quy tắc interaction

- PDF là content gốc, không render lại text/hình đã có trên PDF.
- Decorative FX dùng `pointer-events: none`.
- Hotspot chỉ phủ vùng cần click.
- Modal / drag-drop / reveal là UI riêng.
- Các interaction mới ưu tiên CSS Module riêng để tránh CSS của slide này làm hỏng slide khác.
- Slide 10–13 của PDF cũ đã bị xóa; mapping hiện tại đã được remap theo PDF mới.

## Mapping interaction hiện tại

- 1: AI hero.
- 2: animated underlines.
- 3: not-coding transition FX.
- 4: animated question marks.
- 5: idea cards + workflow popup.
- 7: drag & drop software process.
- 8: human-role ambient FX.
- 9: architecture hotspots + EIU popup.
- 10: restaurant click-to-reveal.
- 11: enterprise click-to-reveal.
- 12: Lab 1 AI hero.
- 13–23: custom interactions theo nội dung từng slide hiện tại.

Mapping chính nằm tại:

`components/interactions/InteractionLayer.tsx`

## Environment Variables

Tạo `.env.local` từ `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
GAS_OTP_ENDPOINT=...
GAS_OTP_SHARED_SECRET=...
NEXT_PUBLIC_PDF_URL=...
```

Không cần Custom SMTP hoặc chỉnh Email Template của Supabase. Google Apps Script gửi mã do Supabase
tạo; hai phía xác thực request bằng `GAS_OTP_SHARED_SECRET`. Xem checklist đầy đủ trong hướng dẫn ở đầu
README.

Không commit `.env.local` lên GitHub.

## Chạy local

```bash
npm install
npm run dev
```

Nếu vừa thay toàn bộ source và giao diện vẫn cache bản cũ:

```bat
rmdir /s /q .next
npm run dev
```

Sau đó dùng `Ctrl + F5` trên trình duyệt.
