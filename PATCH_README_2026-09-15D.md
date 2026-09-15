# EIU Applied Agentic AI – Patch 2026-09-15D

Apply this patch after the previous 2026-09-15C patch. Extract into the project root and choose Replace / Overwrite.

## Updated files
- `components/section2/SectionTwoSlide.tsx`
- `components/section2/SectionTwoSlide.module.css`
- `components/ShowcaseSlide.tsx`
- `public/downloads/Gemini-Prompt.txt`

## Changes

### Gemini output is now compact
`Gemini-Prompt.txt` now asks Gemini to:
- Read all three lab files in full.
- Analyze the two example apps internally without dumping long analysis into chat.
- Show only a short reusable-core brief (max 8 bullets).
- Show a concise Gem Settings section ready to copy/paste:
  - Gem Name
  - Gem Instructions
  - Knowledge files to upload
  - Preview test prompt
- Create one compact downloadable package with exactly four `.txt` files:
  - `GEM-SETTINGS.txt`
  - `KNOWLEDGE-01-CORE-FRAMEWORK.txt`
  - `KNOWLEDGE-02-UI-DATA-WORKFLOW.txt`
  - `KNOWLEDGE-03-QUALITY-DEPLOYMENT.txt`
- Use FILE blocks only as a fallback if Gemini cannot attach/download files.

### Section 2 slide changes
- Slide 30 title: `Bước 1 · Phân tích, tách Framework, tạo Gem`.
- Slide 30 copy prompt updated for the compact output workflow.
- Slide 31 title: `Ví dụ - Nguyên tắc thiết kế`.
- Slide 32 red callouts re-aligned around `Gems` and `New Gem`.
- Slide 33 adds: `Tiến hành điền và upload các trường dữ liệu cần thiết từ hướng dẫn của Gemini.` plus Name / Instructions / Knowledge visual steps.
- Slide 35 typography aligned with the rest of the deck.

### Showcase – Section 1 and Section 2
- The form heading is standardized to `Đưa bài làm của bạn lên bảng`.
- It is kept on one line with a more suitable heading size to avoid awkward wrapping.

## Verification
- Updated TSX files passed TypeScript transpile syntax validation.
- CSS brace structure checked successfully.
