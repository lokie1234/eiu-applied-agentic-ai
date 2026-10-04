# PPTX section uploads

Apply `supabase/migrations/202610040001_section_pptx_content.sql` after the section-content migration. This extends the content-type constraint and adds the PowerPoint MIME type to the existing private storage bucket. Existing PDF, TSX, and built-in sections are unchanged.

An administrator can upload or replace a custom section's presentation with a `.pptx` file, up to 50 MB. The two built-in sections accept PPTX attachments, while their interactive lessons, controls, and native slide counts stay unchanged. PDF/TSX replacement of built-in sections remains blocked.

`next.config.ts` sets `experimental.proxyClientMaxBodySize` to 52 MB to accommodate a 50 MB file plus multipart headers. The Next.js default of 10 MB truncates larger requests before the route can parse FormData. Restart the development server (or rebuild/redeploy in production) after changing this setting. The file limit remains 50 MB; incomplete multipart uploads return a readable 400 error.

The upload reads the PPTX package directory to validate its structure and count slide parts. It uploads the **original bytes**, without conversion, reserialization, media extraction, or archive regeneration. Downloads return those original bytes with the PowerPoint MIME type and the original filename (including Unicode names). Existing authentication and course-unlock checks also protect PPTX downloads.

Admins upload through the shared batch-file panel; section rows retain Download. Download returns the file using its uploaded filename and format. Learners open custom PPTX sections directly in the deck; built-in sections keep their interactive lessons and offer View file for the uploaded presentation. The experimental preview renders slide content in the browser, with previous/next, zoom, and fullscreen controls. It uses @aiden0z/pptx-renderer, loaded only for PPTX previews. Audio, animations, and desktop add-ins are not reproduced by this static preview. Original PPTX bytes remain unchanged and downloadable. Complex layouts and unavailable fonts may differ from desktop PowerPoint.

Embedded audio/video, animations, and embedded add-in data remain in the file. External media, desktop-installed add-ins, licenses, and network services are dependencies of the original presentation and must still be available on the presentation machine.

Verification: `node --test tests/section-content.test.mjs` checks upload/download byte equality with a PPTX fixture containing media, animation XML, and add-in parts; invalid packages; Unicode download filenames; access restrictions; and PDF/TSX behavior. `npm run build` checks compilation and types.
