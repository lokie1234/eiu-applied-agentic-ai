# Deck architecture

`components/LessonPortal.tsx` selects the built-in Section 1 deck (`components/PdfDeck.tsx`), Section 2 deck (`components/section2/SectionTwoDeck.tsx`), or uploaded content (`components/deck/UploadedSectionDeck.tsx`).

All use `components/deck/SharedDeckFrame.tsx` for navigation, zoom, and fullscreen. Section 1 content lives in `components/section1/`; the former PDF interaction overlay components have been removed because the current deck does not import them.

PPTX previews use `components/deck/PptxSectionDeck.tsx`. Original uploaded packages are stored unchanged. Admin uploads run through `components/admin/SectionBatchUpload.tsx`, with one file assigned to each section.
