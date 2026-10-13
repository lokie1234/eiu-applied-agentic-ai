# Section slide totals

Section cards show `N slides` in a rounded bordered badge. Until a total is verified, they show `… slides`; file-format labels and fixed counts are not used.

Built-in sections share their deck item definitions in `lib/builtinDeckItems.ts` with the selector. Section 1 includes the facilitator/admin results slide only for users who can see it. Adding or removing a deck item changes the selector count and viewer navigation together.

When a course's section list opens, `useSectionSlideCounts` reads its uploaded sections through the existing authenticated content API, with at most two concurrent requests. This uses the same source as the viewer: registered project TSX, Drive content, or legacy stored content. Changing the source revision, refreshing the catalog, or reopening the course rechecks the totals. Closing the list or opening a deck cancels remaining requests.

- TSX: the shared document builder evaluates the actual exported slide array in an invisible opaque-origin sandbox and reports its length without rendering slides. No uploaded code runs on the server. Messages must come from that iframe and include its unique request ID; errors, timeouts and aborted reads remove the iframe.
- PDF: PDF.js reports the document's actual page count and its loading task is disposed afterward.
- PPTX: the presentation's slide ID list determines the count; leftover slide XML files outside that list are ignored.

This applies automatically to existing and future sections of these types. There is no manual total or database migration. Stored `slide_count` can still initialize a viewer while it loads, but the selector always verifies the displayed source. Failed reads retain `… slides` instead of presenting an unverified number. Counts for uploaded files are read when their course is open, not for the entire catalog in advance.
