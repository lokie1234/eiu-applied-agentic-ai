# Retired OTP deployment

This project no longer uses Brevo/SMTP/GAS OTP or per-email learner grants.
Do not follow the historical OTP setup flow or recreate its retired tables.

Current authentication uses Google for the administrator and metadata-based
Learning/Teaching passcodes. Administrator quick access has a separate endpoint.
See `supabase/MIGRATIONS.md`, `supabase/CLEANUP.md`, and
`docs/interactive-data-flow.md` for the maintained schema and realtime flow.
