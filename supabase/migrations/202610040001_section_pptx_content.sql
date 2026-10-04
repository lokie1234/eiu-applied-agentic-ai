-- Store original PowerPoint packages without conversion, in the existing private bucket.
begin;

alter table public.course_sections
  drop constraint if exists course_sections_content_type_check;

alter table public.course_sections
  add constraint course_sections_content_type_check
  check (content_type in ('builtin', 'pdf', 'tsx', 'pptx'));

update storage.buckets
set allowed_mime_types = case
  -- NULL already allows all MIME types; do not narrow an existing bucket policy.
  when allowed_mime_types is null then null
  else array(
    select distinct mime_type
    from unnest(allowed_mime_types || array[
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]) as mime_type
  )
end
where id = 'course-section-content';

commit;
