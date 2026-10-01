-- Migration: Section passcodes & Folder-level bulk email access
-- Cho phép nhiều mã passcode (cho từng section) và cấp quyền truy cập email theo folder

-- 1. Bỏ index giới hạn 1 passcode mỗi course
drop index if exists public.course_passcodes_one_per_course_idx;

-- 2. Bổ sung section_key vào course_passcodes nếu chưa có
alter table public.course_passcodes
  add column if not exists section_key text;

-- 3. Tạo bảng lưu danh sách email được cấp quyền theo folder khóa học
create table if not exists public.course_folder_allowed_emails (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and length(email) > 3),
  granted_by text,
  granted_at timestamptz not null default now(),
  constraint course_folder_email_unique unique (course_id, email)
);

create index if not exists course_folder_emails_course_idx
  on public.course_folder_allowed_emails(course_id);

create index if not exists course_folder_emails_email_idx
  on public.course_folder_allowed_emails(email);

alter table public.course_folder_allowed_emails enable row level security;
revoke all on table public.course_folder_allowed_emails from anon, authenticated;

-- Thêm quyền mặc định cho admin cố định son.lam@eiu.edu.vn vào các khóa học hiện tại
insert into public.course_folder_allowed_emails (course_id, email, granted_by)
select id, 'son.lam@eiu.edu.vn', 'system'
from public.courses
where status = 'active'
on conflict (course_id, email) do nothing;
