-- Supabase Auth now sends OTP through its configured Custom SMTP provider.
-- Remove the custom Next.js/GAS transport rate-limit objects if migration 002
-- was applied before the SMTP migration.
drop function if exists public.reserve_otp_request(text, text);
drop table if exists public.otp_request_log;
