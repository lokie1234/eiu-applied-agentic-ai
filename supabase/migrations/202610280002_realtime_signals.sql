-- Durable results remain in their existing Supabase tables. This small change
-- feed contains no learner identities or duplicated submission payloads.
begin;
create sequence if not exists public.learning_signal_revision;
create table if not exists public.learning_realtime_signals (
  section_id text not null,
  topic text not null check (topic in ('control','quiz','showcase','ideas')),
  revision bigint not null default nextval('public.learning_signal_revision'),
  primary key (section_id, topic)
);
alter table public.learning_realtime_signals enable row level security;
revoke all on public.learning_realtime_signals from public, anon, authenticated;
grant select on public.learning_realtime_signals to service_role;

create or replace function public.mark_learning_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  source jsonb;
  detail jsonb;
  section_id_value text;
  legacy_key text;
  topics text[];
  topic_value text;
begin
  if TG_OP = 'DELETE' then source := to_jsonb(OLD); else source := to_jsonb(NEW); end if;
  detail := coalesce(source->'details', '{}'::jsonb);
  if TG_TABLE_NAME = 'access_audit_logs' then
    topics := case source->>'action'
      when 'SECTION_TERMINATED' then array['control']
      when 'QUIZ_OPENED' then array['quiz']
      when 'QUIZ_COMPLETED' then array['quiz']
      when 'FEEDBACK_SUBMITTED' then array['quiz']
      when 'SHOWCASE_SUBMITTED' then array['showcase']
      when 'IDEA_SUBMITTED' then array['ideas'] else null end;
    if topics is null then
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end if;
    section_id_value := detail->>'sectionId';
    legacy_key := detail->>'section';
  else
    legacy_key := source->>'section';
    topics := case TG_TABLE_NAME when 'section_state' then array['control','quiz']
      when 'ideas' then array['ideas'] when 'showcase_items' then array['showcase']
      else array['quiz'] end;
  end if;
  if section_id_value is null then
    select s.id::text into section_id_value from public.course_sections s join public.courses c on c.id = s.course_id
      where s.section_key = legacy_key and c.slug = 'applied-agentic-ai' limit 1;
  end if;
  if section_id_value is not null then
    foreach topic_value in array topics loop
      insert into public.learning_realtime_signals(section_id,topic) values(section_id_value,topic_value)
      on conflict(section_id,topic) do update set revision = nextval('public.learning_signal_revision');
    end loop;
  end if;
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;
revoke all on function public.mark_learning_signal() from public, anon, authenticated;
do $$ declare name text; begin
  foreach name in array array['access_audit_logs','section_state','ideas','showcase_items','quiz_results','feedback'] loop
    execute format('drop trigger if exists learning_signal_change on public.%I', name);
    execute format('create trigger learning_signal_change after insert or update or delete on public.%I for each row execute function public.mark_learning_signal()',name);
  end loop;
end $$;
insert into public.learning_realtime_signals(section_id,topic)
  select s.id::text, t.topic from public.course_sections s cross join unnest(array['control','quiz','showcase','ideas']) as t(topic)
  on conflict do nothing;
commit;
