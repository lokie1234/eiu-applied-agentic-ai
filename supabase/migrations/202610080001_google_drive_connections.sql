-- Server-only encrypted OAuth credentials; browsers have no table access.
create table if not exists public.google_drive_connections (
  account_email text primary key,
  encrypted_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.google_drive_connections enable row level security;
revoke all on public.google_drive_connections from anon, authenticated;
grant select, insert, update on public.google_drive_connections to service_role;
