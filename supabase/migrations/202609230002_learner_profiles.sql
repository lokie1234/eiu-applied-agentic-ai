alter table public.ideas
  add column if not exists name text,
  add column if not exists email text;

alter table public.showcase_items
  add column if not exists email text;

alter table public.presence_sessions
  add column if not exists name text,
  add column if not exists email text;

create table if not exists public.learner_profiles (
  email text primary key check (char_length(email) <= 100),
  name text not null check (char_length(name) between 1 and 80),
  section text not null check (section in ('section1', 'section2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learner_profiles_section_idx
  on public.learner_profiles (section, updated_at desc);

alter table public.learner_profiles enable row level security;
revoke all on table public.learner_profiles from anon, authenticated;
