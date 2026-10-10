# Drive as the section source

Saving a legacy uploaded section to Drive now verifies the exported bytes and then switches `course_sections.content_path` to `drive:<fileId>`. Original TSX also sets `original_content_path` to that reference. Existing Supabase files remain as backups; the export operation does not delete them. Subsequent lesson reads use Drive, not Supabase Storage. The first migration still reads the legacy source once.

Publication compares the previous source references before updating metadata. Drive verification failures, database errors and concurrent edits leave the live section unchanged. An uploaded replacement uses a new Drive file, preserving the previous Drive file. Exporting an already Drive-backed section to another destination saves a copy while retaining the existing live source.

In a custom section's Drive dialog, choose an edited `.tsx` under **Update section TSX**, choose a Drive target and click **Save updated TSX**. The existing upload endpoint validates the self-contained TSX, uploads and verifies it on Drive, then updates section metadata. The admin catalog refreshes after success. A changed source revision remounts the uploaded deck after the learning catalog refreshes, so it fetches the new content. Upload failures retain the selected file for retry.

Legacy JavaScript fallback files stay `.js` on Drive and are served unchanged; they are not passed to the TSX compiler. They still use the TSX deck viewer. Real TSX is compiled to JavaScript on Vercel when displaying it and remains available in original form on Drive.

Built-in Applied Agentic AI sections keep their native web implementation for quiz, ideas and showcase functionality. Their generated TSX exports are backups, not replacements for that implementation. Additional source-library documents remain copies and do not replace the primary section file.

## Resource usage

File content for Drive-backed sections never passes through Supabase Storage. Editing/replacing them uses Drive and Vercel. Supabase still handles metadata, access checks, Drive connection configuration and learner submissions; their small responses still consume database/API egress. Vercel handles uploads, downloads, compilation and file responses, so its compute, memory and transfer usage remain. Each view currently reads Drive; external edits to the same Drive file appear on the next content fetch/reload rather than through automatic Drive change notifications.

Do not assume zero total egress or instant cross-session updates. Supabase Storage backups continue to count toward storage capacity until explicitly removed.

Validation: 151 automated tests pass, including verified migration, failed verification, concurrent edits, legacy JS rendering, and edited-TSX upload/retry. TypeScript and targeted lint checks pass.
