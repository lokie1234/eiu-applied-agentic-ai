-- Original section files live in Drive; this table only holds their catalog.
create table if not exists public.section_source_files (
  id uuid primary key,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  original_filename text not null,
  exported_filename text not null,
  file_type text not null check (file_type in ('pdf', 'pptx', 'tsx')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  sha256 text not null,
  drive_folder_id text not null,
  drive_file_id text,
  status text not null default 'uploading' check (status in ('uploading', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists section_source_files_section_idx
  on public.section_source_files(section_id, created_at desc);
alter table public.section_source_files enable row level security;
-- Custom app sessions are authorized by server routes using the service key.
-- No browser role receives direct access to the Drive source catalog.
revoke all on public.section_source_files from anon, authenticated;
grant all on public.section_source_files to service_role;
