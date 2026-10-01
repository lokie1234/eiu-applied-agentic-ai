-- One shared passcode per course folder, plus an admin-managed language label.
alter table public.courses
  add column if not exists language_label text not null default 'vi_en'
  check (language_label in ('vi', 'en', 'vi_en'));

-- If bulk passcodes existed before this change, keep the newest one per folder.
delete from public.course_passcodes older
using public.course_passcodes newer
where older.course_id = newer.course_id
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id::text < newer.id::text)
  );

create unique index if not exists course_passcodes_one_per_course_idx
  on public.course_passcodes(course_id);
