-- Privileged, bounded password-recovery lookups and persistent rate limiting.
-- Apply this migration BEFORE deploying the request-password-reset Edge Function.

create table if not exists public.password_reset_throttles (
  bucket_key text primary key,
  attempts integer not null check (attempts >= 1),
  expires_at timestamptz not null
);

alter table public.password_reset_throttles enable row level security;

revoke all on public.password_reset_throttles from public, anon, authenticated;
grant select, insert, update, delete on public.password_reset_throttles to service_role;

create index if not exists password_reset_throttles_expires_at_idx
  on public.password_reset_throttles (expires_at);

-- Only the Edge Function's service-role client can consume this RPC.
-- Both buckets are updated atomically; expiry rolls the counter to 1.
create or replace function public.consume_password_reset_quota(
  p_email_hash text,
  p_network_hash text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_email_attempts integer;
  v_network_attempts integer;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid password recovery rate-limit bucket';
  end if;

  insert into public.password_reset_throttles as throttle (
    bucket_key, attempts, expires_at
  ) values (
    'email:' || p_email_hash, 1, v_now + interval '15 minutes'
  )
  on conflict (bucket_key) do update
    set attempts = case
          when throttle.expires_at <= v_now then 1
          else throttle.attempts + 1
        end,
        expires_at = case
          when throttle.expires_at <= v_now then excluded.expires_at
          else throttle.expires_at
        end
  returning attempts into v_email_attempts;

  insert into public.password_reset_throttles as throttle (
    bucket_key, attempts, expires_at
  ) values (
    'network:' || p_network_hash, 1, v_now + interval '15 minutes'
  )
  on conflict (bucket_key) do update
    set attempts = case
          when throttle.expires_at <= v_now then 1
          else throttle.attempts + 1
        end,
        expires_at = case
          when throttle.expires_at <= v_now then excluded.expires_at
          else throttle.expires_at
        end
  returning attempts into v_network_attempts;

  -- Keep table growth bounded without a cron extension or a per-request scan.
  if random() < 0.01 then
    delete from public.password_reset_throttles
    where expires_at < v_now - interval '1 day';
  end if;

  return v_email_attempts <= 5 and v_network_attempts <= 30;
end;
$$;

revoke all on function public.consume_password_reset_quota(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_password_reset_quota(text, text)
  to service_role;

-- Avoid downloading and enumerating auth.users through the admin API.
-- This is a privileged, deliberately fail-closed legacy lookup.
-- Ambiguous recovery addresses return NULL, never an arbitrary account.
-- TODO: replace editable profileEmail metadata with verified identities.
create or replace function public.find_recovery_auth_email(
  p_recovery_email text
) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then max(match.email) else null end
  from (
    select u.email
    from auth.users as u
    where p_recovery_email is not null
      and length(p_recovery_email) <= 254
      and lower(btrim(u.raw_user_meta_data ->> 'profileEmail')) =
          lower(btrim(p_recovery_email))
    limit 2
  ) as match;
$$;

revoke all on function public.find_recovery_auth_email(text)
  from public, anon, authenticated;
grant execute on function public.find_recovery_auth_email(text)
  to service_role;
