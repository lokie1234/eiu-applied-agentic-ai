create table if not exists public.google_drive_destinations (
  id uuid primary key default gen_random_uuid(),
  account_email text not null,
  label text not null check (char_length(label) between 1 and 100),
  folder_id text not null,
  updated_at timestamptz not null default now(),
  unique(account_email, folder_id)
);
alter table public.google_drive_destinations enable row level security;
revoke all on public.google_drive_destinations from anon, authenticated;
grant select, insert, update, delete on public.google_drive_destinations to service_role;
alter table public.course_sections add column if not exists original_content_path text;
