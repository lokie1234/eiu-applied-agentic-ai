create table if not exists public.admin_credentials (
  id boolean primary key default true check (id),
  password_hash text not null,
  session_version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.admin_credentials enable row level security;
revoke all on public.admin_credentials from anon, authenticated;
