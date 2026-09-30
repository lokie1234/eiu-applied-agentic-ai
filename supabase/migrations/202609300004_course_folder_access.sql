-- Course folders are now the permission boundary. Preserve every existing
-- section grant by promoting it to access for the containing course.
insert into public.user_course_access (user_email, course_id, granted_by, granted_at)
select
  section_access.user_email,
  section.course_id,
  max(section_access.granted_by),
  min(section_access.granted_at)
from public.user_section_access section_access
join public.course_sections section on section.id = section_access.section_id
group by section_access.user_email, section.course_id
on conflict (user_email, course_id) do nothing;

create index if not exists user_course_access_course_idx
  on public.user_course_access(course_id);
