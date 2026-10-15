# Deck architecture

`components/LessonPortal.tsx` selects the built-in Section 1 deck (`components/PdfDeck.tsx`), Section 2 deck (`components/section2/SectionTwoDeck.tsx`), or uploaded content (`components/deck/UploadedSectionDeck.tsx`).

All use `components/deck/SharedDeckFrame.tsx` for navigation, zoom, and fullscreen. Section 1 content lives in `components/section1/`; the former PDF interaction overlay components have been removed because the current deck does not import them.

PPTX previews use `components/deck/PptxSectionDeck.tsx`. PDF/PPTX packages and lesson JS are stored unchanged. Interactive uploads accept JS; legacy TSX and registered project sources remain readable and export as compiled JS. Admin file replacement runs through `components/admin/DriveExport.tsx` and the section content API. `components/admin/DriveImport.tsx` previews a Drive file before connecting it to a section, with permission checks, content validation and concurrent-update protection. Registered project sources retain their local binding. Source-library API routes remain available.

Course selection uses `LearningInnovationIcon` and `SectionEnergy`: AI-themed SVG artwork, pointer-driven 3D transforms and masked electric paths. `HairlineLoading` is now a standalone SVG/CSS rocket-launch animation; the former Hairline kernel, registration adapter and loading-dot assets have been removed.

Section entry mounts the presentation shell immediately and checks the built-in section session while its display bundle loads. Background slide counting stops on entry and unchanged catalogs do not restart it. Human-readable course/section URLs support refresh restoration; legacy ID links remain valid. Explicit reentry from the course chooser starts at slide 1. Slide positions are retained in the current URL, without sessionStorage history.
