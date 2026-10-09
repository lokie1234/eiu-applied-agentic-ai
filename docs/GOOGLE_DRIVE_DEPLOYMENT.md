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

In /admin/drive, add a named upload destination. Use Browse Drive to grant drive.file access to a folder before saving its link. Configure GOOGLE_DRIVE_PICKER_API_KEY and allow the local/production origins in its website restrictions; enable Google Picker API and Google Drive API. GOOGLE_DRIVE_PROJECT_NUMBER can explicitly identify the app project.

In Course Setup & Structure:

- **Load from Drive** appears for folders, courses, and sections. Browse Drive to choose files and grant app access, or paste an already-authorized file link/ID. Assign one file to each existing section and click Load selected files into deck. Linking replaces the section's current file.
- **Upload files to Drive** sends local PDF/PPTX/TSX files to the selected destination, verifies their bytes by reading them back, then links them to sections. New uploads do not persist binary files in Supabase Storage.
- **Move existing file to Drive** copies a legacy file from web storage, verifies the Drive copy, saves its section reference, then schedules removal of obsolete web-storage copies. Existing legacy decks keep working until moved or replaced.

Sections store a drive:<fileId> reference in content_path. TSX also uses that original reference in original_content_path; its JavaScript is compiled in memory for deck requests. PDF/PPTX bytes remain unchanged. The protected content API checks the current section access before using the administrator's server-side Drive credentials. Learners do not receive Google tokens or need Google accounts.

Drive files stay private. The connected account must retain download access. Deleting a section or replacing a Drive link does not delete the original file in Drive. Native Google Docs/Slides files are not accepted; select PDF/PPTX/TSX files up to 50 MB.

If section metadata cannot be saved, the old lesson remains linked and the new Drive file stays available for retry with Load from Drive. Removing old Supabase copies occurs only after successful verification and metadata update. Live files are not automatically migrated during deployment.

Drive is the file source; requests still pass through the web server. The content API retains private/no-store responses and does not persist a server file cache.
