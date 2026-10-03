-- Course section presentation content.
-- The viewer chrome remains application-owned; uploaded files only provide slide content.

alter table public.course_sections
  add column if not exists content_type text not null default 'builtin'
    check (content_type in ('builtin', 'pdf', 'tsx')),
  add column if not exists content_path text,
  add column if not exists source_filename text,
  add column if not exists slide_count integer
    check (slide_count is null or slide_count > 0),
  add column if not exists updated_at timestamptz not null default now();

update public.course_sections
set content_type = 'builtin',
    slide_count = case section_key
      when 'section1' then 41
      when 'section2' then 37
      else slide_count
    end
where section_key in ('section1', 'section2');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-section-content',
  'course-section-content',
  false,
  52428800,
  array['application/pdf', 'text/plain', 'text/typescript', 'application/typescript', 'text/javascript', 'application/javascript', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

