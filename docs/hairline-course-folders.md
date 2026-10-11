# Hairline course selection

## Current folder / book / page set

The folder level uses the original course-folder drawing: a tabbed folder with three sheets fanning upward from the middle. The application enlarges its viewport and artwork, centers it within its reserved column, and places the original EIU PNG on the broad front cover. Branding follows the cover transform. Folder names remain centered, with course counts in bordered badges at the lower-right. Selection retains its gold outline, left bar, check mark and native pressed state.

The course level opens a bound book cover up to 76 degrees, with two inner leaves following. The section level turns up a page corner and lifts the paper slightly. Both cues remain in the lower-right of their cards. As the artwork opens, an upright HTML Click label emerges diagonally outward and grows to full size. It uses the opening progress, rather than a second animation loop, and is never projected onto the paper. Leaving reverses the opening and hides the label. Keyboard focus triggers the same answer; touch devices show the opened state and readable action immediately. Native buttons remain usable and a static label is available if artwork fails to load.

EIU navy/gold remain primary, with small sage accents. Library, folder, course and section titles use distinct open-book, book-stack, bound-book and page icons. Summaries retain a gentle entry effect. Reduced motion settles Hairline changes immediately and disables CSS movement.

Title and summary text share sage color tokens. Titles arrive once with a 3px rise, followed by summaries rising 4px after a 70ms delay. Hover/focus brightens the title, expands its short green underline and raises title/summary by just 1px. Selected folder titles retain a brighter green and expanded underline. Touch uses the static palette; reduced motion disables text transforms and animations. These effects use CSS only, with no added animation dependency or JavaScript frame loop.

## Navigation and tools

Folders and courses each paginate at six items, with the seventh starting page two. The folder sidebar reserves six rows and a pagination footer; mobile uses a dropdown that can scroll on short screens. Courses use two columns on desktop and one on mobile. Course names remain on one line with ellipsis and full-title tooltips. Section count, language and status share a badge row.

Course tool icons remain passive with native hover labels, in one horizontal row under the summary. The first eight icons can float vertically by 2px; hovering pauses them. Viewport/document visibility gates their CSS movement. Touch and reduced-motion devices show static icons.

The course action still replaces the right pane with inline sections. Back/Escape restores its course page, scroll and action-button focus. Sections open the existing presentation directly. Search, deep links, slide restoration, uploaded/built-in decks, authorization, file preview/download, admin actions and section-loading cancellation/retry behavior are preserved.

## Runtime and previews

One cached kernel and serialized figure registration serve all figures. Paths cache their last pose; the shared clock sleeps when settled or offscreen. The action-label observer watches only opening progress and disconnects on unmount. There are no new dependencies, APIs or per-frame React updates. Canonical sources are served unchanged from public/hairline; the fixed skill kernel and bench are unchanged. Requested color, logo and action lettering are application adapters; canonical previews remain monochrome and word-free.

Standalone previews:

- [Folder](../hairline-course-folder.html): three sheets fan upward; rules 01, 02, 05, 07, 08, 09 and 10; tour [140,140], [260,180], then leave.
- [Book](../hairline-course-book.html): cover opens and leaves follow; rules 01, 02, 03, 05, 07, 08, 09 and 10; tour [205,145], [285,215], then leave.
- [Page](../hairline-section-page.html): rounded corner opens with a delayed lift; the same rules as the book; tour [175,140], [265,208], then leave.
- [Loading dots](../hairline-loading-dots.html): existing indicator remains unchanged.

Press Play in a standalone preview to review its tour. Tours have not been judged by the user and never autoplay in the course selector.

## Verification

Book/page validators and look checks pass frame bounds, read-outs, console cleanliness and settled motion. Their look, blind and motion sheets were inspected. The book rest pose occupies 20% of the canonical frame because its camera reserves room for the tall opened cover. The original folder source is unchanged; its existing look sheet was reviewed again.

Desktop, compact and mobile portal layouts were visually reviewed with local sample data, including six folders, seven tool icons and inline sections. No page errors were observed. The temporary review route is removed before the production build. These are visual checks, not a concurrent-user simulation or production account verification.

Cleanup removes obsolete Enter-key, mouse and material-box sources/previews, 45 unused CSS classes (78 rules), the unused marquee keyframes and obsolete projected-label metadata. Production build and TypeScript pass. Targeted lint has no errors; its two existing raw-image warnings apply to uploaded tool icons.
