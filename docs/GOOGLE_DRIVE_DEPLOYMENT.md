# Google Drive on Vercel

1. Run supabase/migrations/202610080001_google_drive_connections.sql in the Supabase SQL Editor for the project's database.
2. Configure Vercel Production environment variables: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_ACCOUNT_EMAIL, GOOGLE_DRIVE_REDIRECT_URI, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, PASSCODE_SESSION_SECRET. Keep PASSCODE_SESSION_SECRET stable (at least 32 characters); changing it makes saved credentials unreadable and requires reconnecting. GOOGLE_DRIVE_PICKER_API_KEY is required for the folder picker.
3. Set the production redirect URI to https://eiu-interactive-space.vercel.app/api/admin/drive/callback. Keep .env.local on http://localhost:3000/api/admin/drive/callback. Register both exact URIs in the Google OAuth web client.
4. Deploy the updated code, sign in as admin on the production domain, open /admin/drive and connect the configured Google account.

Production stores AES-256-GCM encrypted refresh tokens in a server-only table. Local development keeps its existing encrypted file. An existing GOOGLE_DRIVE_REFRESH_TOKEN remains a fallback; a saved production connection takes precedence so reconnecting replaces old authorization.

For Picker, enable Google Picker API and Google Drive API and allow the production domain in the API key's website restrictions. OAuth apps with external testing status may issue refresh tokens that expire after seven days for Drive scopes; configure the consent screen appropriately for ongoing use.

## Admin Google login and document exports

Apply migration 202610080002_drive_destinations_and_originals.sql after the connection migration. This creates the server-only destination catalog and adds original TSX storage metadata.

On the landing page, choose Google, then Continue with Google for administrator sign-in. Choose Username for the existing registered-email login. Back returns to the method chooser and clears any entered password. The callback verifies the signed Google identity against both FIXED_ADMIN_EMAIL and GOOGLE_DRIVE_ACCOUNT_EMAIL before issuing an admin session. The same authorization connects Drive; no second Drive login is needed. Other users and teachers retain their existing sign-in and cannot access Drive APIs. The callback URL remains unchanged.

Google Drive appears in the horizontal admin navigation. Add a named destination by pasting a folder link or using Browse Drive. With drive.file permissions, use Browse Drive to grant access to a new folder before saving its link. API key website restrictions must allow each local/production origin where Picker is used.

Use Save to Drive beside a section, Save course to Drive for a course, or Save folder to Drive beside a web folder. Review the available documents, edit names or keep defaults, and choose a destination from the dropdown. Folder exports create/reuse a Drive folder matching the web folder name. Transfers run sequentially with per-file progress; retry skips completed files and recovers previous uploads. Published attachments and archived source documents are included; built-in sections without an uploaded source have no original file to export.

New TSX uploads retain the original source alongside their compiled runtime JavaScript. Legacy TSX documents without original source are marked unavailable until their source is re-uploaded. PDF/PPTX bytes are transferred without regeneration. Deleting/replacing section content also cleans up its saved TSX original.
