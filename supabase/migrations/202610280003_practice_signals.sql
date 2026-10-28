-- Run after 202610280002_realtime_signals.sql. No learner history is removed.
begin;
create unique index if not exists practice_submission_once_idx on public.access_audit_logs
  ((details->>'sectionId'), (details->>'sessionId'), (details->>'submissionId'))
  where action = 'ACTIVITY_SUBMITTED' and details->>'practice' = 'mis301-pandas';
create or replace function public.mark_practice_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare payload jsonb; action_value text;
begin
  if TG_OP = 'DELETE' then payload := OLD.details; action_value := OLD.action;
  else payload := NEW.details; action_value := NEW.action; end if;
  if action_value <> 'ACTIVITY_SUBMITTED' then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;
  if payload->>'sectionId' is not null then
    insert into public.learning_realtime_signals(section_id, topic)
      values(payload->>'sectionId', 'quiz')
      on conflict(section_id, topic) do update
        set revision = nextval('public.learning_signal_revision');
  end if;
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;
revoke all on function public.mark_practice_signal() from public, anon, authenticated;
drop trigger if exists practice_signal_change on public.access_audit_logs;
create trigger practice_signal_change after insert or update or delete on public.access_audit_logs
for each row execute function public.mark_practice_signal();
commit;
