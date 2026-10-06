create table if not exists public.teacher_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  display_name text not null check (char_length(display_name) between 1 and 120),
  password_hash text not null,
  password_ciphertext text not null,
  must_change_password boolean not null default true,
  status text not null default 'active' check (status in ('active', 'suspended')),
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.teacher_accounts enable row level security;
revoke all on public.teacher_accounts from anon, authenticated;
alter table public.courses add column if not exists created_by uuid references public.teacher_accounts(id);
alter table public.course_sections add column if not exists created_by uuid references public.teacher_accounts(id);
create index if not exists course_sections_created_by_idx on public.course_sections(created_by);
create index if not exists courses_created_by_idx on public.courses(created_by);
