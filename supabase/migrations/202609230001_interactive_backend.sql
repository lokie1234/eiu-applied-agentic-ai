create extension if not exists pgcrypto;

create table if not exists public.ideas (
  id text primary key default gen_random_uuid()::text,
  section text not null default 'section1' check (section in ('section1', 'section2')),
  name text check (name is null or char_length(name) between 1 and 80),
  email text check (email is null or char_length(email) <= 100),
  idea text not null check (char_length(idea) between 1 and 500),
  submitted_at timestamptz not null default now()
);

create table if not exists public.showcase_items (
  id text primary key default gen_random_uuid()::text,
  section text not null check (section in ('section1', 'section2')),
  name text not null check (char_length(name) between 1 and 80),
  email text check (email is null or char_length(email) <= 100),
  url text not null check (char_length(url) between 1 and 500),
  shared_at timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id text primary key default gen_random_uuid()::text,
  section text not null check (section in ('section1', 'section2')),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) <= 100),
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  completed_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id text primary key default gen_random_uuid()::text,
  section text not null check (section in ('section1', 'section2')),
  name text not null default '' check (char_length(name) <= 80),
  email text not null check (char_length(email) <= 100),
  feedback text not null check (char_length(feedback) between 1 and 2000),
  submitted_at timestamptz not null default now()
);

create table if not exists public.section_state (
  section text primary key check (section in ('section1', 'section2')),
  termination_token text not null default gen_random_uuid()::text,
  updated_at timestamptz not null default now()
);

create table if not exists public.presence_sessions (
  client_id text primary key check (char_length(client_id) between 1 and 120),
  section text not null check (section in ('section1', 'section2')),
  name text check (name is null or char_length(name) between 1 and 80),
  email text check (email is null or char_length(email) <= 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz
);

create table if not exists public.learner_profiles (
  email text primary key check (char_length(email) <= 100),
  name text not null check (char_length(name) between 1 and 80),
  section text not null check (section in ('section1', 'section2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.section_state (section)
values ('section1'), ('section2')
on conflict (section) do nothing;

create index if not exists ideas_submitted_at_idx on public.ideas (submitted_at desc);
create index if not exists showcase_section_shared_idx on public.showcase_items (section, shared_at desc);
create index if not exists quiz_section_completed_idx on public.quiz_results (section, completed_at desc);
create index if not exists feedback_section_submitted_idx on public.feedback (section, submitted_at desc);
create index if not exists presence_active_idx on public.presence_sessions (section, last_seen_at desc) where left_at is null;
create index if not exists learner_profiles_section_idx on public.learner_profiles (section, updated_at desc);

alter table public.ideas enable row level security;
alter table public.showcase_items enable row level security;
alter table public.quiz_results enable row level security;
alter table public.feedback enable row level security;
alter table public.section_state enable row level security;
alter table public.presence_sessions enable row level security;
alter table public.learner_profiles enable row level security;

revoke all on table public.ideas from anon, authenticated;
revoke all on table public.showcase_items from anon, authenticated;
revoke all on table public.quiz_results from anon, authenticated;
revoke all on table public.feedback from anon, authenticated;
revoke all on table public.section_state from anon, authenticated;
revoke all on table public.presence_sessions from anon, authenticated;
revoke all on table public.learner_profiles from anon, authenticated;

create or replace function public.eiu_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  section_name text;
  topic_name text;
  event_name text;
begin
  if tg_op = 'DELETE' then
    section_name := old.section;
  else
    section_name := new.section;
  end if;

  if tg_table_name = 'ideas' then
    topic_name := 'eiu:ideas';
    event_name := 'ideas_changed';
  elsif tg_table_name = 'showcase_items' then
    topic_name := 'eiu:showcase:' || section_name;
    event_name := 'showcase_changed';
  elsif tg_table_name = 'section_state' then
    topic_name := 'eiu:section:' || section_name;
    event_name := 'section_terminated';
  elsif tg_table_name = 'presence_sessions' then
    if tg_op = 'UPDATE' and old.left_at is not distinct from new.left_at then
      return new;
    end if;
    topic_name := 'eiu:presence';
    event_name := 'presence_changed';
  else
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  perform realtime.send(
    jsonb_build_object('section', section_name),
    event_name,
    topic_name,
    false
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.eiu_broadcast_change() from public, anon, authenticated;

drop trigger if exists ideas_realtime_signal on public.ideas;
create trigger ideas_realtime_signal
after insert or update or delete on public.ideas
for each row execute function public.eiu_broadcast_change();

drop trigger if exists showcase_realtime_signal on public.showcase_items;
create trigger showcase_realtime_signal
after insert or update or delete on public.showcase_items
for each row execute function public.eiu_broadcast_change();

drop trigger if exists section_realtime_signal on public.section_state;
create trigger section_realtime_signal
after insert or update or delete on public.section_state
for each row execute function public.eiu_broadcast_change();

drop trigger if exists presence_realtime_signal on public.presence_sessions;
create trigger presence_realtime_signal
after insert or update or delete on public.presence_sessions
for each row execute function public.eiu_broadcast_change();
