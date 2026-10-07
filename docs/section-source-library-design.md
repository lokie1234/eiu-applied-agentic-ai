# Section source library and interactive publishing

Status: local OAuth, Google Picker folder authorization and additive source
uploads/listing are implemented. Supabase migration must be applied. Selecting
sources for editing and interactive publishing remain pending.

## Source upload setup

Run supabase/migrations/202610070001_section_source_files.sql in Supabase SQL
Editor. It creates only the source catalog, with RLS enabled and browser access
revoked; existing lessons are unchanged. The source upload checks catalog
availability before creating any file on Drive.

In Course Setup, use Source files on an editable section, select PDF/PPTX/TSX
files and choose Lưu file nguồn vào Drive. Multiple files are uploaded sequentially
into the three configured type folders. Original bytes are preserved, including
TSX source; names contain the course folder, course and section. Upload never
updates the published section content. Retry reuses the source ID and recovers
a previously uploaded Drive file through appProperties if the catalog write was
interrupted. A five-minute upload lease prevents simultaneous duplicate retries.

Original archives are not executed. TSX runtime validation, editable drafts and
selection/publishing will be implemented separately. Source download and per-file
preview are not implemented yet. Keep the existing lesson upload flow operational
until those features are available.

## Local OAuth setup

Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET,
GOOGLE_DRIVE_ACCOUNT_EMAIL and GOOGLE_DRIVE_REDIRECT_URI in .env.local.
The current local callback is http://localhost:3000/api/admin/drive/callback.
Register that exact URI with the Google OAuth Web application client.
Use a stable PASSCODE_SESSION_SECRET with at least 32 characters.

Start `npm run dev`, sign in as admin and open /admin/drive. Connect using the
configured EIU Google account. The callback verifies account identity, Drive
scope, single-use OAuth state, session binding and PKCE. A successful connection
saves an AES-GCM encrypted refresh token in .local/google-drive.enc; .local is
Git-ignored. Do not rotate the session secret without reconnecting Drive.

The connection page checks each destination's read/write capabilities. Existing
folders are authorized through Google Picker for drive.file. Enable Google Picker
API in the same project and set GOOGLE_DRIVE_PICKER_API_KEY in .env.local. Restrict
the browser key to Google Picker API and website referrers
http://localhost:3000/* and https://docs.google.com/* (Google's Picker iframe).
Set GOOGLE_DRIVE_PROJECT_NUMBER if needed; otherwise the OAuth client ID's numeric
project prefix is used. The key's project must match the OAuth client project.

Open /admin/drive and choose each configured destination using its folder button.
The server validates the selected ID against the predefined destination and
re-reads its MIME type, trash status and canAddChildren capability. The browser
receives only a short-lived access token after an admin and same-origin check;
it is not written to localStorage, cookies or logs. No uploads are redirected to
Drive by this connection.

Production does not use the local encrypted file and the interactive connect
endpoint is disabled there until durable production token storage is implemented.
A server-only GOOGLE_DRIVE_REFRESH_TOKEN can be supplied for status checks; this
does not implement production reconnect or source uploads. Never expose it as a
NEXT_PUBLIC variable.

## Intended workflow

Each section owns a library of original PDF, PPTX and TSX files. Uploading adds
a source without changing the lesson students currently see. Original bytes,
including uncompiled TSX, are saved to a configured private Google Drive folder.
Supabase stores the source catalog and access rules, not a second original file.

The manager selects a source, opens a draft in the course's selected EIU layout,
edits the draft and previews it. Publishing validates and compiles the lesson,
stores the runtime artifact in Supabase Storage and changes the section's
published revision. Source selection, editing and publishing are separate actions.

PDF/PPTX preview is not an editable interactive lesson. Conversion must extract
text, slide/page ordering and relevant images first, then produce editable lesson
content. An AI-assisted mode can propose activities from this content, subject to
teacher review. Scanned PDFs need OCR. Extraction failures and unsupported objects
must be reported; conversion must not silently invent missing source content.

For TSX, retain the exact uploaded source and validate compatibility before
preview or publication. The current viewer uses a small JSX runtime, not full
React: React hooks and arbitrary module imports are not supported. A conversion
service must generate code for this runtime or a future supported lesson format.

## Manager interface

Inside a selected section:

1. Source files: upload multiple PDF/PPTX/TSX files; show name, type, size,
   Drive save status, version and upload time. Open/download through authorized
   server routes. Failed Drive writes offer retry and never appear as saved.
2. Draft workspace: select a saved source; choose/create a draft; show source
   preview beside the EIU lesson preview. Editing controls depend on the chosen
   editing mode. Show which source revision the draft references.
3. Publish: validate code, assets and content boundaries; preview before publish.
   The previous published version remains available if publishing fails.

Students see only the published lesson. Admins and teachers can manage sources
only within their existing course permissions. Folder/course hidden state and
course unlock rules also apply to source download and lesson endpoints. Students
do not receive Drive file IDs, provider credentials or unrestricted source links.

## Storage mapping

Original source destinations supplied by the owner:

| Type | Drive folder ID |
| --- | --- |
| TSX | 1J0Kudr8xTczKjujXDZ3ek7Aq2pvEz1Ir |
| PDF | 1EgGdT63Och3qucdtY7yTwzZlOfxWiNPM |
| PPTX | 1M6MLl542jzThnN0SpNPHAUAeZa0Ejcvv |

Store each original directly in its corresponding type folder. Export/upload name:

    <course folder> — <course> — <section> — <original stem> — <UTC timestamp>-<source ID>.<type>

The implementation of this policy is `lib/sectionSourceFiles.ts`. Names preserve
Vietnamese accents. Use the authoritative folder catalog name and course/section
titles fetched by the server, not client-submitted labels. Source IDs are allocated
before upload and reused on retries. Preserve the original filename separately in
the database. TSX originals keep the `.tsx` extension and original bytes; compiled
JavaScript is a separate published artifact.

IDs provide identity; names are labels. Renaming a course or section does not
require moving or rewriting historical files. Drive original versions are immutable
for the app; reuploads create new source records. Draft/history export should use
the same TSX destination and include revision identity.

Access check on 2026-10-07: all three metadata reads returned Google Drive 404 for
the connected chat identity. Destination existence, ownership and write permission
are therefore unverified. No Drive files have been uploaded. The naming/routing
helper is prepared but is not yet wired into the current content upload route.

Supabase Database proposed tables:

- section_sources: id, section_id, provider, drive_file_id, original_filename,
  mime_type, byte_size, sha256, status, uploaded_by, created_at.
- section_lesson_revisions: id, section_id, source_id, parent_revision_id,
  status, draft_drive_file_id, runtime_path, manifest_path, created_by,
  created_at, published_at.
- section_build_jobs: id, revision_id, kind, status, progress, attempt_count,
  error_message, created_at, updated_at.
- course_sections: add published_revision_id. Preserve existing content columns
  during migration so existing lessons continue to work.

Supabase Storage holds published JS, optimized lesson assets and layout assets.
Retain the current revision and a small configurable rollback window; archive
older artifacts to Drive before removing unreferenced Storage objects. Track
database, Storage and bandwidth usage independently.

If shared images are introduced, change the viewer's current data/blob-only image
policy through a controlled asset loader. Public Drive image links are not a
replacement for authenticated asset delivery. Keep large media out of embedded
base64 lesson code.

## Proposed API responsibilities

- GET/POST /api/admin/sections/[id]/sources: list/upload original sources.
- GET /api/admin/sections/[id]/sources/[sourceId]/content: authorized source read.
- POST /api/admin/sections/[id]/drafts: create draft from selected source.
- GET/PATCH /api/admin/sections/[id]/drafts/[revisionId]: read/save draft.
- POST /api/admin/sections/[id]/drafts/[revisionId]/build: validate or convert.
- POST /api/admin/sections/[id]/drafts/[revisionId]/publish: publish ready artifact.
- GET /api/admin/sections/[id]/jobs/[jobId]: retrieve build status.
- Existing learner content route resolves the published revision with existing
  access checks; it never selects a draft or arbitrary Drive file supplied by a
  client.

## Reliability and configuration

Use a server-side Drive integration configured for the actual hosting runtime.
The connected chat Drive tool is not a production credential for the website.
For Shared Drive, grant the app identity permission to the target folder. For
My Drive, use delegated user OAuth with secure refresh-token storage. Confirm
the target and organization policy before choosing either setup.

Create a pending source record before the Drive upload, using an idempotency key.
After upload, record the returned file ID and mark the source ready. On database
failure after upload, reconcile the pending record with the uploaded file rather
than repeating the upload blindly. Reconciliation also handles interrupted jobs.

Use resumable uploads and background jobs where file size/conversion duration
exceeds hosting request limits. The current 50 MB application limit does not
prove the hosting platform accepts a 50 MB request. Never report Drive success
after writing only to temporary disk or Supabase.

Publish uploads the artifact first, then atomically updates the published pointer.
If a concurrent draft publishes, require a revision check rather than overwriting
the newer pointer. Delete orphaned artifacts through a recoverable cleanup job.

## Delivery stages

1. Configure Drive destination and auth; implement source catalog and additive
   uploads. Keep existing lesson uploads operational during migration.
2. Implement selecting a saved TSX source, validation, EIU preview and explicit
   publishing. Preserve exact source and runtime output separately.
3. Implement PDF/PPTX extraction and the chosen interactive editing mode, with
   background conversion, review and version history.
4. Add portable export containing source, runtime, assets, layout and manifest;
   add retention controls and per-section transfer estimates.

Do not migrate or delete existing source/runtime files until the new Drive copy
is verified and its catalog reference is saved successfully.
