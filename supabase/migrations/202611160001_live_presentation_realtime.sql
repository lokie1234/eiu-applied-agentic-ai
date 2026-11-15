-- Live presentation only. Learner records, presence and classroom draws are unchanged.
begin;
create table if not exists public.live_presentation_rooms (
  section_id uuid primary key references public.course_sections(id) on delete cascade,
  owner text not null, epoch text not null, active boolean not null default true,
  topic text not null unique, expires_at timestamptz not null,
  sequence bigint not null default 0, document_sequence bigint not null default 0,
  revision bigint not null default 0, document text not null default '',
  updated_at timestamptz not null default now(),
  rate_start timestamptz not null default now(), rate_count integer not null default 0,
  constraint live_document_budget check (octet_length(document) <= 900000)
);
alter table public.live_presentation_rooms enable row level security;
revoke all on public.live_presentation_rooms from public, anon, authenticated;
grant all on public.live_presentation_rooms to service_role;

-- The topic is a rotating 256-bit bearer capability issued only by the app's
-- administrator-authorized endpoint. Neither anon nor authenticated can list it.
create or replace function public.live_presentation_topic_allowed(p_topic text)
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select exists(select 1 from public.live_presentation_rooms
  where topic = p_topic and active and expires_at > now()); $$;
revoke all on function public.live_presentation_topic_allowed(text) from public;
grant execute on function public.live_presentation_topic_allowed(text) to anon, authenticated;
drop policy if exists eiu_live_receive on realtime.messages;
create policy eiu_live_receive on realtime.messages for select to anon, authenticated
  using (extension = 'broadcast' and public.live_presentation_topic_allowed(realtime.topic()));
drop policy if exists eiu_live_send on realtime.messages;
create policy eiu_live_send on realtime.messages for insert to anon, authenticated
  with check (extension = 'broadcast' and public.live_presentation_topic_allowed(realtime.topic()));

create or replace function public.live_presentation_claim(
  p_section uuid, p_owner text, p_epoch text, p_topic text, p_expires timestamptz
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.live_presentation_rooms; t timestamptz := clock_timestamp(); c integer;
begin
  if p_owner !~ '^[a-zA-Z0-9-]{16,100}$' or p_epoch !~ '^[a-zA-Z0-9-]{16,100}$'
    or p_topic !~ '^eiu-live-v2:[a-f0-9]{64}$' then raise exception 'Invalid Live owner or channel.'; end if;
  insert into public.live_presentation_rooms(section_id,owner,epoch,topic,expires_at)
    values(p_section,p_owner,p_epoch,p_topic,p_expires) on conflict(section_id) do nothing;
  select * into r from public.live_presentation_rooms where section_id=p_section for update;
  if r.active and (r.owner<>p_owner or r.epoch<>p_epoch) then
    raise exception 'Another device controls Live. Stop its Live session first.';
  end if;
  c := case when t-r.rate_start >= interval '1 second' then 1 else r.rate_count+1 end;
  if c>25 then raise exception 'Live request limit reached.'; end if;
  if not r.active then
    update public.live_presentation_rooms set owner=p_owner,epoch=p_epoch,active=true,
      topic=p_topic,expires_at=p_expires,sequence=0,document_sequence=0,revision=0,document='',updated_at=t,
      rate_start=case when c=1 then t else rate_start end,rate_count=c
      where section_id=p_section returning * into r;
  else
    update public.live_presentation_rooms set topic=p_topic,expires_at=p_expires,
      rate_start=case when c=1 then t else rate_start end,rate_count=c
      where section_id=p_section returning * into r;
  end if;
  return jsonb_build_object('owner',r.owner,'epoch',r.epoch,'active',r.active,'topic',r.topic,
    'expires_at',r.expires_at,'sequence',r.sequence,'document_sequence',r.document_sequence,
    'revision',r.revision,'updated_at',r.updated_at);
end; $$;

create or replace function public.live_presentation_save(
  p_section uuid,p_owner text,p_epoch text,p_sequence bigint,p_document_sequence bigint,
  p_document text,p_topic text,p_expires timestamptz
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.live_presentation_rooms; t timestamptz := clock_timestamp(); c integer;
begin
  select * into r from public.live_presentation_rooms where section_id=p_section for update;
  if not found or not r.active or r.owner<>p_owner or r.epoch<>p_epoch then raise exception 'This device no longer controls Live.'; end if;
  if p_sequence<=r.sequence then return jsonb_build_object('owner',r.owner,'epoch',r.epoch,'active',r.active,'topic',r.topic,
    'expires_at',r.expires_at,'sequence',r.sequence,'document_sequence',r.document_sequence,
    'revision',r.revision,'updated_at',r.updated_at); end if;
  if p_sequence>9007199254740991 or p_document_sequence<0 or p_document_sequence>p_sequence
    or p_topic !~ '^eiu-live-v2:[a-f0-9]{64}$' or octet_length(p_document)>900000 then raise exception 'Invalid Live checkpoint.'; end if;
  c := case when t-r.rate_start >= interval '1 second' then 1 else r.rate_count+1 end;
  if c>25 then raise exception 'Live request limit reached.'; end if;
  if p_document is not null and p_document_sequence < r.document_sequence then raise exception 'Stale Live checkpoint.'; end if;
  update public.live_presentation_rooms set sequence=p_sequence,topic=p_topic,expires_at=p_expires,updated_at=t,
    document=coalesce(p_document,document),
    document_sequence=case when p_document is null then document_sequence else p_document_sequence end,
    revision=revision+case when p_document is not null and p_document is distinct from document then 1 else 0 end,
    rate_start=case when c=1 then t else rate_start end,rate_count=c
    where section_id=p_section returning * into r;
  return jsonb_build_object('owner',r.owner,'epoch',r.epoch,'active',r.active,'topic',r.topic,
    'expires_at',r.expires_at,'sequence',r.sequence,'document_sequence',r.document_sequence,
    'revision',r.revision,'updated_at',r.updated_at);
end; $$;

create or replace function public.live_presentation_stop(p_section uuid,p_owner text,p_epoch text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.live_presentation_rooms set active=false,document='',updated_at=clock_timestamp(),expires_at=clock_timestamp()
    where section_id=p_section and owner=p_owner and epoch=p_epoch and active;
end; $$;
revoke all on function public.live_presentation_claim(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.live_presentation_save(uuid,text,text,bigint,bigint,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.live_presentation_stop(uuid,text,text) from public,anon,authenticated;
grant execute on function public.live_presentation_claim(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.live_presentation_save(uuid,text,text,bigint,bigint,text,text,timestamptz) to service_role;
grant execute on function public.live_presentation_stop(uuid,text,text) to service_role;
commit;
