alter table public.section_state
  add column if not exists session_started_at timestamptz not null default '1970-01-01 00:00:00+00';

create or replace function public.eiu_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  section_name text;
  topic_name text;
  event_name text;
begin
  if tg_op = 'DELETE' then
    section_name := old.section;
  else
    section_name := new.section;
  end if;

  if tg_table_name = 'ideas' then
    topic_name := 'eiu:ideas';
    event_name := 'ideas_changed';
  elsif tg_table_name = 'showcase_items' then
    topic_name := 'eiu:showcase:' || section_name;
    event_name := 'showcase_changed';
  elsif tg_table_name = 'quiz_results' then
    topic_name := 'eiu:quiz:' || section_name;
    event_name := 'quiz_results_changed';
  elsif tg_table_name = 'section_state' then
    if tg_op = 'UPDATE' and old.termination_token is distinct from new.termination_token then
      perform realtime.send(
        jsonb_build_object('section', section_name),
        'section_terminated',
        'eiu:section:' || section_name,
        false
      );
    end if;
    if tg_op = 'UPDATE' and (
      old.quiz_open is distinct from new.quiz_open
      or old.quiz_opened_at is distinct from new.quiz_opened_at
    ) then
      perform realtime.send(
        jsonb_build_object('section', section_name),
        'quiz_state_changed',
        'eiu:quiz:' || section_name,
        false
      );
    end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  elsif tg_table_name = 'presence_sessions' then
    if tg_op = 'UPDATE' and old.left_at is not distinct from new.left_at then
      return new;
    end if;
    topic_name := 'eiu:presence';
    event_name := 'presence_changed';
  else
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  perform realtime.send(
    jsonb_build_object('section', section_name),
    event_name,
    topic_name,
    false
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.eiu_broadcast_change() from public, anon, authenticated;
