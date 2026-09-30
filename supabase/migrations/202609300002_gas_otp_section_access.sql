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

create table if not exists public.otp_request_log (
  id bigint generated always as identity primary key,
  email text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists otp_request_log_email_created_idx
  on public.otp_request_log(email, created_at desc);
create index if not exists otp_request_log_ip_created_idx
  on public.otp_request_log(ip_hash, created_at desc);

alter table public.otp_request_log enable row level security;
revoke all on table public.otp_request_log from anon, authenticated;

create or replace function public.reserve_otp_request(p_email text, p_ip_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
begin
  if split_part(normalized_email, '@', 2) <> 'eiu.edu.vn' then
    return 'invalid_domain';
  end if;

  perform pg_advisory_xact_lock(hashtext(normalized_email));

  delete from public.otp_request_log
  where created_at < now() - interval '24 hours';

  if exists (
    select 1 from public.otp_request_log
    where email = normalized_email and created_at > now() - interval '60 seconds'
  ) then
    return 'cooldown';
  end if;

  if (select count(*) from public.otp_request_log
      where email = normalized_email and created_at > now() - interval '1 hour') >= 6 then
    return 'email_limit';
  end if;

  if (select count(*) from public.otp_request_log
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 30 then
    return 'ip_limit';
  end if;

  insert into public.otp_request_log(email, ip_hash)
  values (normalized_email, p_ip_hash);
  return 'ok';
end;
$$;

revoke execute on function public.reserve_otp_request(text, text) from public, anon, authenticated;
grant execute on function public.reserve_otp_request(text, text) to service_role;
