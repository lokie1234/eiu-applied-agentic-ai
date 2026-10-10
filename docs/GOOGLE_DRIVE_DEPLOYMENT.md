# Google Drive on Vercel

1. Run supabase/migrations/202610080001_google_drive_connections.sql in the Supabase SQL Editor for the project's database.
2. Configure Vercel Production environment variables: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_ACCOUNT_EMAIL, GOOGLE_DRIVE_REDIRECT_URI, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, PASSCODE_SESSION_SECRET. Keep PASSCODE_SESSION_SECRET stable (at least 32 characters); changing it makes saved credentials unreadable and requires reconnecting. GOOGLE_DRIVE_PICKER_API_KEY is required for the folder picker.
3. Set the production redirect URI to https://eiu-interactive-space.vercel.app/api/admin/drive/callback. Keep .env.local on http://localhost:3000/api/admin/drive/callback. Register both exact URIs in the Google OAuth web client.
4. Deploy the updated code, sign in as admin on the production domain, open /admin/drive and connect the configured Google account.

Production stores AES-256-GCM encrypted refresh tokens in a server-only table. Local development keeps its existing encrypted file. An existing GOOGLE_DRIVE_REFRESH_TOKEN remains a fallback; a saved production connection takes precedence so reconnecting replaces old authorization.

For Picker, enable Google Picker API and Google Drive API and allow the production domain in the API key's website restrictions. OAuth apps with external testing status may issue refresh tokens that expire after seven days for Drive scopes; configure the consent screen appropriately for ongoing use.

## Admin Google login and Drive-backed decks

Apply migration 202610080002_drive_destinations_and_originals.sql after the connection migration. It creates the server-only destination catalog and original-file metadata. The Drive-backed deck flow uses existing section columns; no additional migration is required.

Google sign-in is reserved for the administrator. Learning and Teaching users use passcodes, or browse free Learning content. The Google callback verifies the configured administrator and connects Drive with the same authorization.

In /admin/drive, connect the administrator's Google account and use Browse folders to select an export destination. Picking a folder grants drive.file access; Add destination is enabled only after selection. This setup remains necessary to authorize the app and choose where exported files are saved. Configure GOOGLE_DRIVE_PICKER_API_KEY and allow the local/production origins in its website restrictions; enable Google Picker API and Google Drive API. GOOGLE_DRIVE_PROJECT_NUMBER can explicitly identify the app project.

In Course Setup & Structure:

- Click a Drive icon to open the export popup, choose a saved Drive target, and save. There is no fixed destination selector in the course layout.
- Use the outbound Drive icon beside a section to save its current PDF/PPTX/original TSX file, or its built-in Agentic AI presentation snapshot. Legacy TSX sections with no original source can export the exact stored JavaScript used by the viewer instead. The popup identifies these as JavaScript; filenames use `.js`. Files use `Section N — Web section title.ext`.
- The course header's outbound Drive icon saves all eligible sections, reporting successes and failures separately.
- The folder's outbound Drive icon in the left sidebar exports all courses into `Drive target / Web folder / Course / Section files`. Course exports create a course folder; single-section exports save directly to the selected target. Built-in Agentic AI sections are included.
- The legacy Pandas section has a known TSX original bundled in `course-content/mis301`; exports recover that exact source when the original storage reference is absent. Other legacy sections fall back to stored `.js` only when a compiled JavaScript path is present. Exports never relabel JavaScript as TSX or change the section's web content reference.
- Saving creates an export copy without replacing section references or deleting web-storage files. Drive import/link/migration actions are disabled; the content API rejects the old JSON actions with HTTP 410.

Sections store a drive:<fileId> reference in content_path. TSX also uses that original reference in original_content_path; its JavaScript is compiled in memory for deck requests. PDF/PPTX bytes remain unchanged. The protected content API checks the current section access before using the administrator's server-side Drive credentials. Learners do not receive Google tokens or need Google accounts.

Drive files stay private. The connected account must retain access to the chosen folder. Deleting a section does not delete its exported file in Drive. Legacy stored documents up to 50 MB can be exported.

Previously connected Drive-backed sections remain viewable. Their protected content requests still pass through the web server; learners do not receive Google credentials. New exports do not change the file source of a section. Exporting a legacy Supabase document reads its bytes from Supabase Storage and uploads them to Drive; exporting an existing Drive-backed document uses Drive's copy API.
