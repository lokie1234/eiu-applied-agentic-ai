-- Deploy the application cleanup before applying this migration.
-- Retires username/teacher accounts and the old email/section grant model.
-- Current learner/teaching codes are stored in courses.description metadata.
-- Back up these legacy tables first if their old account data must be retained.
-- No CASCADE: unexpected external dependencies abort the entire transaction.
begin;
set local lock_timeout = '5s';

-- Teacher ownership has been replaced by Google administrator management.
alter table if exists public.courses drop column if exists created_by;
alter table if exists public.course_sections drop column if exists created_by;

-- Keep session_version: Google administrator cookies still use it.
alter table if exists public.admin_credentials drop column if exists password_hash;

-- Drop child grant tables before their parent account tables.
drop table if exists public.user_section_access;
drop table if exists public.user_course_access;
drop table if exists public.course_folder_allowed_emails;
drop table if exists public.user_unlocked_courses;
drop table if exists public.course_passcodes;
drop table if exists public.teacher_accounts;
drop table if exists public.app_users;

-- Keep learner_profiles for historical reports; existing installations may
-- still contain learner records that predate the current session audit logs.
-- Keep record IDs, session IDs and timestamps used by quiz restoration,
-- submissions, presence, reset, audit tracing and admin session validation.
notify pgrst, 'reload schema';
commit;
