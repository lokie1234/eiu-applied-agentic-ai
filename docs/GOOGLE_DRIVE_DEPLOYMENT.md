# Google Drive on Vercel

1. Run supabase/migrations/202610080001_google_drive_connections.sql in the Supabase SQL Editor for the project's database.
2. Configure Vercel Production environment variables: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_ACCOUNT_EMAIL, GOOGLE_DRIVE_REDIRECT_URI, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, PASSCODE_SESSION_SECRET. Keep PASSCODE_SESSION_SECRET stable (at least 32 characters); changing it makes saved credentials unreadable and requires reconnecting. GOOGLE_DRIVE_PICKER_API_KEY is required for the folder picker.
3. Set the production redirect URI to https://eiu-interactive-space.vercel.app/api/admin/drive/callback. Keep .env.local on http://localhost:3000/api/admin/drive/callback. Register both exact URIs in the Google OAuth web client.
4. Deploy the updated code, sign in as admin on the production domain, open /admin/drive and connect the configured Google account.

Production stores AES-256-GCM encrypted refresh tokens in a server-only table. Local development keeps its existing encrypted file. An existing GOOGLE_DRIVE_REFRESH_TOKEN remains a fallback; a saved production connection takes precedence so reconnecting replaces old authorization.

For Picker, enable Google Picker API and Google Drive API and allow the production domain in the API key's website restrictions. OAuth apps with external testing status may issue refresh tokens that expire after seven days for Drive scopes; configure the consent screen appropriately for ongoing use.
