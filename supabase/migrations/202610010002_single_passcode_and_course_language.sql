-- Active course language metadata. Current access codes live in course JSON.
alter table public.courses
  add column if not exists language_label text not null default 'vi_en'
  check (language_label in ('vi', 'en', 'vi_en'));
