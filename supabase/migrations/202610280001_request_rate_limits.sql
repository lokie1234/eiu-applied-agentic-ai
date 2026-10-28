-- Apply before deploying proxy.ts. All Vercel instances use these atomic counters.
begin;
create table if not exists public.request_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null,
  blocked_until timestamptz,
  expires_at timestamptz not null
);
create index if not exists request_rate_limits_expiry_idx on public.request_rate_limits(expires_at);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from public, anon, authenticated;

create or replace function public.consume_request_limits(
  p_rules jsonb, p_window_seconds integer default 60, p_block_seconds integer default 120
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  rule jsonb;
  bucket public.request_rate_limits%rowtype;
  current_time_value timestamptz;
  wait_seconds integer := 0;
  max_requests integer;
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) not between 1 and 4
    or p_window_seconds not between 1 and 3600 or p_block_seconds not between 1 and 3600 then
    raise exception 'Invalid request limit configuration';
  end if;
  -- A stable lock order avoids deadlocks between browser and shared-network rules.
  for rule in select value from jsonb_array_elements(p_rules) order by value->>'key' loop
    max_requests := (rule->>'limit')::integer;
    if (rule->>'key') is null or (rule->>'key') !~ '^[a-f0-9]{64}$'
      or max_requests is null or max_requests not between 1 and 20000 then
      raise exception 'Invalid request limit rule';
    end if;
    current_time_value := clock_timestamp();
    insert into public.request_rate_limits values
      (rule->>'key', current_time_value, 0, null, current_time_value + interval '1 hour')
      on conflict (bucket_key) do nothing;
    select * into bucket from public.request_rate_limits
      where bucket_key = rule->>'key' for update;
    current_time_value := clock_timestamp();
    if bucket.blocked_until > current_time_value then
      wait_seconds := greatest(wait_seconds, ceil(extract(epoch from bucket.blocked_until - current_time_value))::integer);
      continue; -- Retrying while blocked never extends the two-minute penalty.
    end if;
    if bucket.blocked_until is not null or bucket.window_started_at + make_interval(secs => p_window_seconds) <= current_time_value then
      bucket.window_started_at := current_time_value;
      bucket.request_count := 0;
      bucket.blocked_until := null;
    end if;
    bucket.request_count := bucket.request_count + 1;
    if bucket.request_count > max_requests then
      bucket.blocked_until := current_time_value + make_interval(secs => p_block_seconds);
      wait_seconds := greatest(wait_seconds, p_block_seconds);
    end if;
    update public.request_rate_limits set
      window_started_at = bucket.window_started_at, request_count = bucket.request_count,
      blocked_until = bucket.blocked_until,
      expires_at = current_time_value + interval '1 hour'
      where bucket_key = bucket.bucket_key;
  end loop;
  -- Bounded opportunistic cleanup; no cron/additional paid service required.
  if random() < 0.01 then
    delete from public.request_rate_limits where bucket_key in (
      select bucket_key from public.request_rate_limits where expires_at < clock_timestamp()
      order by expires_at limit 100 for update skip locked
    );
  end if;
  return jsonb_build_object('allowed', wait_seconds = 0, 'retry_after', wait_seconds);
end;
$$;
revoke all on function public.consume_request_limits(jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_request_limits(jsonb, integer, integer) to service_role;
commit;
