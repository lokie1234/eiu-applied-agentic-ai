create table if not exists public.user_section_access (
  user_email text not null references public.app_users(email) on update cascade on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  granted_by text references public.app_users(email) on update cascade on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_email, section_id)
);

create index if not exists user_section_access_email_idx
  on public.user_section_access(user_email);

alter table public.user_section_access enable row level security;
revoke all on table public.user_section_access from anon, authenticated;

-- Preserve previous course-level grants by expanding them to every active section.
insert into public.user_section_access (user_email, section_id, granted_by, granted_at)
select access.user_email, section.id, access.granted_by, access.granted_at
from public.user_course_access access
join public.course_sections section on section.course_id = access.course_id
where section.status = 'active'
on conflict (user_email, section_id) do nothing;

-- Bootstrap the requested administrator. The Auth user is linked on first OTP login.
insert into public.app_users (email, is_admin, status)
values ('son.lam@eiu.edu.vn', true, 'active')
on conflict (email) do update set
  is_admin = true,
  status = 'active',
  updated_at = now();
