-- Migration: Remember unlocked courses per learner account
-- Allows learners who have unlocked a course once (via passcode or free access)
-- to retain permanent access without having to re-enter passcodes on subsequent logins.

create table if not exists public.user_unlocked_courses (
  email text not null check (email = lower(trim(email)) and length(email) > 3),
  course_id uuid not null references public.courses(id) on delete cascade,
  unlocked_via text not null default 'passcode' check (unlocked_via in ('passcode', 'free_access', 'admin_grant')),
  unlocked_at timestamptz not null default now(),
  constraint user_unlocked_courses_pk primary key (email, course_id)
);

create index if not exists user_unlocked_courses_email_idx
  on public.user_unlocked_courses(email);

create index if not exists user_unlocked_courses_course_idx
  on public.user_unlocked_courses(course_id);

alter table public.user_unlocked_courses enable row level security;
revoke all on table public.user_unlocked_courses from anon, authenticated;
