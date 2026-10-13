# Deck architecture

`components/LessonPortal.tsx` selects the built-in Section 1 deck (`components/PdfDeck.tsx`), Section 2 deck (`components/section2/SectionTwoDeck.tsx`), or uploaded content (`components/deck/UploadedSectionDeck.tsx`).

All use `components/deck/SharedDeckFrame.tsx` for navigation, zoom, and fullscreen. Section 1 content lives in `components/section1/`; the former PDF interaction overlay components have been removed because the current deck does not import them.

PPTX previews use `components/deck/PptxSectionDeck.tsx`. Original uploaded packages are stored unchanged. Admin file replacement runs through `components/admin/DriveExport.tsx` and the section content API. The retired batch-upload and source-library UI components have been removed; source-library API routes and their authorization checks remain available.

Course selection uses the SVG garden components documented in `docs/course-garden-assets.md`. Hairline remains in use for loading dots; its retired folder/book/page React adapters have been removed. Obsolete standalone Hairline previews and duplicate figure sources have been removed; only the loading kernel and loading-dots figure remain.
