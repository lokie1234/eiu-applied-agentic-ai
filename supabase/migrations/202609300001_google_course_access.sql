create table if not exists public.app_users (
  email text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_eiu_email check (
    email = lower(email)
    and split_part(email, '@', 2) = 'eiu.edu.vn'
    and length(split_part(email, '@', 1)) > 0
  )
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  section_key text not null unique,
  title text not null,
  position integer not null default 0,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_course_access (
  user_email text not null references public.app_users(email) on update cascade on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  granted_by text references public.app_users(email) on update cascade on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_email, course_id)
);

create table if not exists public.access_audit_logs (
  id bigint generated always as identity primary key,
  actor_email text,
  action text not null,
  target_email text,
  course_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_course_access_email_idx
  on public.user_course_access(user_email);
create index if not exists access_audit_logs_created_idx
  on public.access_audit_logs(created_at desc);

alter table public.app_users enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.user_course_access enable row level security;
alter table public.access_audit_logs enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.courses from anon, authenticated;
revoke all on table public.course_sections from anon, authenticated;
revoke all on table public.user_course_access from anon, authenticated;
revoke all on table public.access_audit_logs from anon, authenticated;

insert into public.courses (id, slug, title, description, status)
values (
  '10000000-0000-0000-0000-000000000001',
  'applied-agentic-ai',
  'Applied Agentic AI',
  'Khóa học Applied Agentic AI gồm Section 1 và Section 2.',
  'active'
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  updated_at = now();

insert into public.course_sections (course_id, section_key, title, position, status)
values
  ((select id from public.courses where slug = 'applied-agentic-ai'), 'section1', 'Section 1 · Từ Prompt đến Web App', 1, 'active'),
  ((select id from public.courses where slug = 'applied-agentic-ai'), 'section2', 'Section 2 · AI Business Framework', 2, 'active')
on conflict (section_key) do update set
  course_id = excluded.course_id,
  title = excluded.title,
  position = excluded.position,
  status = excluded.status;

-- Configure this function in Authentication > Hooks > Before User Created.
-- It prevents non-EIU identities from requesting OTP and creating an Auth user.
create or replace function public.hook_restrict_signup_to_eiu(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text;
begin
  signup_email := lower(coalesce(event->'user'->>'email', ''));
  if split_part(signup_email, '@', 2) <> 'eiu.edu.vn' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Chỉ email @eiu.edu.vn được phép đăng nhập.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_restrict_signup_to_eiu(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_eiu(jsonb) from anon, authenticated, public;
