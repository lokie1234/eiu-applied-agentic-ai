-- Replaces learner email/OTP grants with revocable course passcodes.
create table if not exists public.course_passcodes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null check (char_length(code_hint) between 2 and 12),
  label text check (label is null or char_length(label) <= 80),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists course_passcodes_course_status_idx
  on public.course_passcodes(course_id, status, created_at desc);

alter table public.course_passcodes enable row level security;
revoke all on table public.course_passcodes from anon, authenticated;
